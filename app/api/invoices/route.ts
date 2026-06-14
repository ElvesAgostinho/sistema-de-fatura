import { ApiResponse } from '@/lib/api-response';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';
import { generateInvoiceHash } from '@/lib/hash';
import { buildInvoiceSignaturePayload, signWithPrivateKey } from '@/lib/crypto-keys';
import { getCachedOrFetch, redis } from '@/lib/redis';
import { CacheKeys, CacheTTL } from '@/lib/cache-keys';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return ApiResponse.unauthorized();

  const url = new URL(req.url);
  const search = url.searchParams.get('search') ?? '';
  const clientId = url.searchParams.get('client_id');
  const type = url.searchParams.get('type');
  const page = Math.max(parseInt(url.searchParams.get('page') ?? '1'), 1);
  const pageSize = Math.min(parseInt(url.searchParams.get('page_size') ?? '20'), 100);

  const useCache = !search && !clientId && !type && page === 1;
  const cacheKey = CacheKeys.invoiceList(ctx.profile.company_id, 'default');

  const fetchInvoices = async () => {
    const admin = createAdminClient();
    let query = admin
      .from('invoices')
      .select('id, invoice_number, total, subtotal, tax, retention_tax, retention_rate, status, created_at, issued_at, payment_status, amount_paid, document_type, client:clients(name, nif)', { count: 'exact' })
      .eq('company_id', ctx.profile.company_id);

    if (clientId) query = query.eq('client_id', clientId);
    if (type) query = query.eq('document_type', type);
    
    // limit search to 100 chars to avoid expensive ILIKE DOS
    const safeSearch = search.slice(0, 100);
    if (safeSearch) query = query.ilike('invoice_number', `%${safeSearch}%`);

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.order('created_at', { ascending: false }).range(from, to);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    return { invoices: data ?? [], total: count ?? 0, page, pageSize };
  };

  try {
    const result = useCache 
      ? await getCachedOrFetch(cacheKey, fetchInvoices, CacheTTL.invoiceList)
      : await fetchInvoices();
    return ApiResponse.success(result);
  } catch (err: any) {
    return ApiResponse.error(err.message, 500);
  }
}

export async function POST(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return ApiResponse.unauthorized();
  const companyId = ctx.profile.company_id;

  try {
    const body = await req.json();
    const { client_id, items, tax_exempt, tax_exemption_reason, document_type, related_document, payment_method, valid_until, transport_details } = body ?? {};

    if (!client_id) return ApiResponse.error('Cliente obrigatório');
    if (!Array.isArray(items) || items.length === 0) return ApiResponse.error('Adicione pelo menos um item');
    const docType = document_type || 'FT';
    if (!['FT', 'FR', 'NC', 'ND', 'RC', 'PP', 'OR', 'GT'].includes(docType)) return ApiResponse.error('Tipo de documento inválido');

    const admin = createAdminClient();

    // Fetch Fiscal Config for defaults
    const { data: fc } = await admin.from('fiscal_config').select('default_tax_exemption_reason, default_retention_rate').eq('company_id', companyId).maybeSingle();

    // Verify client
    const { data: client } = await admin.from('clients').select('*').eq('id', client_id).eq('company_id', companyId).maybeSingle();
    if (!client) return ApiResponse.error('Cliente não encontrado', 404);

    // Compute totals
    let subtotal = 0, tax = 0, total = 0, totalDiscount = 0;
    const cleanItems: any[] = [];
    const finalTaxExemptReason = tax_exempt ? (tax_exemption_reason || fc?.default_tax_exemption_reason || 'M00') : null;

    for (const it of items) {
      const qty = Number(it?.quantity);
      const price = Number(it?.price);
      const rate = tax_exempt ? 0 : Number(it?.tax_rate ?? 14);
      const discountPct = Number(it?.discount ?? 0);
      const desc = String(it?.description ?? '').trim();
      
      if (!desc) return ApiResponse.error('Descrição do item em falta');
      if (!Number.isFinite(qty) || qty <= 0) return ApiResponse.error('Quantidade inválida');
      if (!Number.isFinite(price) || price < 0) return ApiResponse.error('Preço inválido');

      const lineSubtotal = +(qty * price).toFixed(2);
      const discountAmt = +(lineSubtotal * (discountPct / 100)).toFixed(2);
      const lineNet = lineSubtotal - discountAmt;
      const lineTax = +(lineNet * (rate / 100)).toFixed(2);
      const lineTotal = +(lineNet + lineTax).toFixed(2);
      
      subtotal += lineSubtotal;
      totalDiscount += discountAmt;
      tax += lineTax; 
      total += lineTotal;
      
      cleanItems.push({ 
        description: desc, 
        quantity: qty, 
        price, 
        tax_rate: rate, 
        discount: discountAmt,
        total: lineTotal,
        product_id: it?.product_id ?? null
      });
    }
    subtotal = +subtotal.toFixed(2); tax = +tax.toFixed(2); total = +total.toFixed(2);

    let retentionRate = 0;
    let retentionTax = 0;
    if (body.apply_retention) {
      retentionRate = Number(fc?.default_retention_rate ?? 6.5);
      // Retenção é calculada sobre o valor líquido (subtotal - descontos)
      retentionTax = +((subtotal - totalDiscount) * (retentionRate / 100)).toFixed(2);
    }

    // Enterprise ERP Logic: Credit Note Strict Validation
    if (docType === 'NC') {
      if (!related_document) {
        return ApiResponse.error('Nota de Crédito exige a Fatura Original (related_document) obrigatória.');
      }
      const { data: origInv } = await admin.from('invoices').select('id, total, status, invoice_number').eq('id', related_document).eq('company_id', companyId).maybeSingle();
      if (!origInv) return ApiResponse.error('Fatura original não encontrada.', 404);
      if (origInv.status === 'cancelled') return ApiResponse.error('Não é possível emitir Nota de Crédito para uma Fatura anulada.');

      const { data: previousNCs } = await admin.from('invoices').select('total')
        .eq('related_document', related_document).eq('document_type', 'NC').neq('status', 'cancelled');
      
      const alreadyCredited = (previousNCs || []).reduce((sum, nc) => sum + Number(nc.total || 0), 0);
      const maxAllowedCredit = Number(origInv.total) - alreadyCredited;
      
      if (total > maxAllowedCredit) {
        return ApiResponse.error(`Valor da Nota de Crédito (${total} Kz) excede o limite disponível da Fatura Original ${origInv.invoice_number} (${maxAllowedCredit.toFixed(2)} Kz).`);
      }
    }

    // 1. Batch fetch all relevant products to avoid N queries
    const productIds = cleanItems.map(it => it.product_id).filter(Boolean);
    const { data: products } = productIds.length > 0 
      ? await admin.from('products').select('id, quantity_in_stock, track_stock').in('id', productIds)
      : { data: [] };
    const productMap = new Map((products || []).map(p => [p.id, p]));

    // Sequential numbering with lock/retry logic
    const year = new Date().getFullYear();
    const maxAttempts = 3;
    let attempt = 0;
    let invoice: any = null;

    while (attempt < maxAttempts) {
      attempt++;
      const { data: sequence, error: sErr } = await admin.rpc('get_next_invoice_number', { 
        p_company_id: companyId, p_doc_type: docType, p_year: year 
      });
      if (sErr) return ApiResponse.error('Erro ao gerar numeração: ' + sErr.message);

      const { data: lastInvoice } = await admin.from('invoices')
        .select('hash').eq('company_id', companyId).order('created_at', { ascending: false }).limit(1).maybeSingle();
      
      const prevHash = lastInvoice?.hash || '';
      const issuedAt = new Date().toISOString();
      const hash = generateInvoiceHash({ 
        invoice_number: sequence, client_nif: client.nif, total, issued_at: issuedAt, previous_hash: prevHash 
      });

      let signature: string | null = null;
      let signatureKeyId: string | null = null;
      try {
        // Fetch both private key AND the fiscal_key archive id so we record
        // exactly which key was used — critical for verify-signature after key rotation
        const { data: config } = await admin
          .from('fiscal_config')
          .select('chave_privada')
          .eq('company_id', companyId)
          .maybeSingle();

        if (config?.chave_privada) {
          const payload = buildInvoiceSignaturePayload({ invoice_number: sequence, issued_at: issuedAt, total, previous_hash: prevHash });
          signature = signWithPrivateKey(config.chave_privada, payload);

          // Look up the archived key row whose public key matches the current config
          // (fiscal_keys stores the public key; we match by company + most recent row)
          const { data: keyRow } = await admin
            .from('fiscal_keys')
            .select('id')
            .eq('company_id', companyId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (keyRow?.id) signatureKeyId = keyRow.id;
        }
      } catch (sigErr) { console.error('Signing failed', sigErr); }

      const { data: ins, error: insErr } = await admin.from('invoices').insert({
        company_id: companyId, client_id, invoice_number: sequence, document_type: docType,
        subtotal, tax, total, status: 'issued', hash, signature,
        signature_key_id: signatureKeyId, previous_hash: prevHash || null,
        tax_exempt: !!tax_exempt, tax_exemption_reason: tax_exempt ? finalTaxExemptReason : null,
        retention_tax: retentionTax, retention_rate: retentionRate,
        related_document: related_document || null, created_by: ctx.user.id, issued_at: issuedAt,
        client_name: client.name, client_nif: client.nif, client_address: client.address,
        valid_until: (docType === 'PP' || docType === 'OR') ? valid_until : null,
        transport_details: docType === 'GT' ? transport_details : null,
        amount_paid: (docType === 'FR' || docType === 'RC') ? total : 0,
        payment_status: (docType === 'FR' || docType === 'RC') ? 'pago' : 'pendente'
      }).select().single();

      if (insErr) {
        if (insErr.code === '23505') continue;
        return ApiResponse.error(insErr.message);
      }
      invoice = ins;
      break;
    }

    if (!invoice) return ApiResponse.error('Falha ao gerar documento (concorrência)');

    // 2. Optimized Data Persistence (Batching)
    const itemsToInsert = cleanItems.map((c) => ({ ...c, invoice_id: invoice.id }));
    const stockMovements: any[] = [];
    const stockUpdatePromises: any[] = [];

    if (['FT', 'FR'].includes(docType)) {
      for (const item of cleanItems) {
        const p = item.product_id ? productMap.get(item.product_id) : null;
        if (p && p.track_stock) {
          const newBalance = Number(p.quantity_in_stock ?? 0) - Number(item.quantity);
          stockUpdatePromises.push(admin.from('products').update({ quantity_in_stock: newBalance }).eq('id', p.id));
          stockMovements.push({
            company_id: companyId, product_id: p.id, invoice_id: invoice.id,
            movement_type: 'venda', quantity: -item.quantity, balance_after: newBalance,
            notes: `Venda via ${invoice.invoice_number}`,
          });
        }
      }
    }

    // Execute items insert, stock updates, and movements in parallel
    const p1 = admin.from('invoice_items').insert(itemsToInsert);
    const p2 = stockMovements.length > 0 ? admin.from('stock_movements').insert(stockMovements) : Promise.resolve();
    const p3 = (docType === 'FR' || docType === 'RC') ? admin.from('payments').insert({
      company_id: companyId,
      invoice_id: invoice.id,
      amount: total,
      payment_date: invoice.issued_at,
      method: payment_method || 'Dinheiro',
      created_by: ctx.user.id,
      notes: `Recebimento automático (${docType})`
    }) : Promise.resolve();
    
    await Promise.all([
      p1, p2, p3,
      ...stockUpdatePromises,
    ]);

    // 3. Fire-and-forget: Audit Log + Cache Invalidation (Non-blocking)
    admin.from('audit_logs').insert({
      user_id: ctx.user.id, company_id: companyId,
      action: 'invoice.create', entity: 'invoice', entity_id: invoice.id,
      details: { invoice_number: invoice.invoice_number, total, client_nif: client.nif, hash: invoice.hash },
    }).then(({ error }) => { if (error) console.error('Audit log failed', error); });

    // Invalidate dashboard and invoice list caches
    if (redis) {
      redis.del(CacheKeys.dashboardStats(companyId)).catch(() => {});
      redis.del(CacheKeys.invoiceList(companyId, 'default')).catch(() => {});
    }

    return ApiResponse.success({ invoice });
  } catch (err: any) {
    return ApiResponse.error(err?.message ?? 'Erro interno no servidor', 500);
  }
}
