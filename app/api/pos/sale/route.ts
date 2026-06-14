import { ApiResponse } from '@/lib/api-response';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';
import { generateInvoiceHash } from '@/lib/hash';
import { buildInvoiceSignaturePayload, signWithPrivateKey } from '@/lib/crypto-keys';
import { redis } from '@/lib/redis';
import { CacheKeys } from '@/lib/cache-keys';

export const dynamic = 'force-dynamic';

/**
 * POST /api/pos/sale
 * Creates a fast POS sale (Factura Recibo = FR, already paid).
 * Optimized for high-speed retail — minimal validation overhead.
 */
export async function POST(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return ApiResponse.unauthorized();
  const companyId = ctx.profile.company_id;

  try {
    const body = await req.json();
    const {
      session_id,
      client_id,
      items,
      payment_method,
      amount_tendered,
      notes,
      tax_exempt = false,
    } = body ?? {};

    if (!Array.isArray(items) || items.length === 0) {
      return ApiResponse.error('Carrinho vazio');
    }

    const admin = createAdminClient();

    // ── Resolve client (optional for POS) ──────────────────────────────
    let client: any = null;
    if (client_id) {
      const { data } = await admin
        .from('clients')
        .select('id, name, nif, address')
        .eq('id', client_id)
        .eq('company_id', companyId)
        .maybeSingle();
      client = data;
    }

    // ── Compute totals ──────────────────────────────────────────────────
    let subtotal = 0, tax = 0, total = 0;
    const cleanItems: any[] = [];

    for (const it of items) {
      const qty      = Number(it.quantity);
      const price    = Number(it.price);
      const disc     = Number(it.discount_pct ?? 0) / 100;
      const rate     = tax_exempt ? 0 : Number(it.tax_rate ?? 14);
      const desc     = String(it.name ?? it.description ?? '').trim();

      if (!desc || qty <= 0 || price < 0) continue;

      const effectivePrice  = +(price * (1 - disc)).toFixed(4);
      const lineSubtotal    = +(effectivePrice * qty).toFixed(2);
      const lineTax         = +(lineSubtotal * (rate / 100)).toFixed(2);
      const lineTotal       = +(lineSubtotal + lineTax).toFixed(2);

      subtotal += lineSubtotal;
      tax      += lineTax;
      total    += lineTotal;

      cleanItems.push({
        description: desc,
        quantity: qty,
        price: effectivePrice,
        tax_rate: rate,
        total: lineTotal,
        product_id: it.product_id ?? null,
      });
    }

    subtotal = +subtotal.toFixed(2);
    tax      = +tax.toFixed(2);
    total    = +total.toFixed(2);

    // ── Sequential invoice number ────────────────────────────────────────
    const year = new Date().getFullYear();
    const maxAttempts = 3;
    let invoice: any = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const { data: sequence, error: sErr } = await admin.rpc('get_next_invoice_number', {
        p_company_id: companyId, p_doc_type: 'FR', p_year: year,
      });
      if (sErr) return ApiResponse.error('Erro ao gerar numeração: ' + sErr.message);

      const { data: lastInvoice } = await admin
        .from('invoices')
        .select('hash')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const prevHash  = lastInvoice?.hash || '';
      const issuedAt  = new Date().toISOString();
      const hash      = generateInvoiceHash({
        invoice_number: sequence,
        client_nif: client?.nif ?? '000000000',
        total,
        issued_at: issuedAt,
        previous_hash: prevHash,
      });

      // Signing (optional — continues if key not configured)
      let signature: string | null = null;
      let signatureKeyId: string | null = null;
      try {
        const { data: config } = await admin
          .from('fiscal_config')
          .select('chave_privada')
          .eq('company_id', companyId)
          .maybeSingle();
        if (config?.chave_privada) {
          const payload = buildInvoiceSignaturePayload({ invoice_number: sequence, issued_at: issuedAt, total, previous_hash: prevHash });
          signature = signWithPrivateKey(config.chave_privada, payload);
          const { data: keyRow } = await admin.from('fiscal_keys').select('id').eq('company_id', companyId).order('created_at', { ascending: false }).limit(1).maybeSingle();
          if (keyRow?.id) signatureKeyId = keyRow.id;
        }
      } catch {}

      const { data: ins, error: insErr } = await admin.from('invoices').insert({
        company_id:    companyId,
        client_id:     client?.id ?? null,
        client_name:   client?.name ?? 'Consumidor Final',
        client_nif:    client?.nif ?? '000000000',
        client_address: client?.address ?? null,
        invoice_number: sequence,
        document_type: 'FR',
        subtotal, tax, total,
        status:        'issued',
        payment_status: 'pago',
        amount_paid:   total,
        hash, signature, signature_key_id: signatureKeyId,
        previous_hash: prevHash || null,
        tax_exempt:    !!tax_exempt,
        tax_exemption_reason: null,
        created_by:    ctx.user.id,
        issued_at:     issuedAt,
        notes:         notes ?? null,
      }).select().single();

      if (insErr) {
        if (insErr.code === '23505') continue; // duplicate number → retry
        return ApiResponse.error(insErr.message);
      }
      invoice = ins;
      break;
    }

    if (!invoice) return ApiResponse.error('Falha ao gerar documento (conflito de numeração)');

    // ── Pre-validate stock BEFORE committing items ────────────────────────
    // Prevents overselling — check happens before any DB writes for items
    const productIds = cleanItems.map(c => c.product_id).filter(Boolean);
    if (productIds.length > 0) {
      const { data: products } = await admin.from('products')
        .select('id, name, quantity_in_stock, track_stock')
        .in('id', productIds);
      const productMap = new Map((products ?? []).map(p => [p.id, p]));

      for (const item of cleanItems) {
        if (!item.product_id) continue;
        const p = productMap.get(item.product_id);
        if (p?.track_stock && (p.quantity_in_stock ?? 0) < item.quantity) {
          // Rollback: mark invoice as cancelled if stock insufficient
          await admin.from('invoices').update({ status: 'cancelled', cancellation_reason: 'Stock insuficiente (validação POS)' }).eq('id', invoice.id);
          return ApiResponse.error(`Stock insuficiente: ${p.name ?? item.product_id} (disponível: ${p.quantity_in_stock ?? 0}, pedido: ${item.quantity})`);
        }
      }
    }

    // ── Atomic: items + payment + stock in ONE transaction ────────────────
    // Uses stored procedure process_pos_sale() — all or nothing (ACID)
    const { error: rpcErr } = await admin.rpc('process_pos_sale', {
      p_company_id:      companyId,
      p_invoice_id:      invoice.id,
      p_items:           cleanItems,
      p_payment_amount:  total,
      p_payment_method:  payment_method ?? 'Dinheiro',
      p_session_id:      session_id ?? null,
      p_user_id:         ctx.user.id,
      p_invoice_number:  invoice.invoice_number,
    });

    if (rpcErr) {
      // Rollback invoice if atomic operation failed
      await admin.from('invoices').update({
        status: 'cancelled',
        cancellation_reason: `Falha transacção POS: ${rpcErr.message}`,
      }).eq('id', invoice.id);
      return ApiResponse.error(`Erro ao processar venda: ${rpcErr.message}`);
    }

    // ── Audit + Cache invalidation ────────────────────────────────────────
    void admin.from('audit_logs').insert({
      user_id: ctx.user.id, company_id: companyId,
      action: 'pos.sale', entity: 'invoice', entity_id: invoice.id,
      details: { invoice_number: invoice.invoice_number, total, payment_method, items: cleanItems.length },
    });

    if (redis) {
      redis.del(CacheKeys.dashboardStats(companyId)).catch(() => {});
      redis.del(CacheKeys.invoiceList(companyId, 'default')).catch(() => {});
    }

    return ApiResponse.success({
      invoice_id:     invoice.id,
      invoice_number: invoice.invoice_number,
      total,
      change: Math.max(0, (amount_tendered ?? total) - total),
      issued_at:      invoice.issued_at,
      client_name:    client?.name ?? null,
      items:          cleanItems,
    });
  } catch (err: any) {
    return ApiResponse.error(err?.message ?? 'Erro interno no POS', 500);
  }
}
