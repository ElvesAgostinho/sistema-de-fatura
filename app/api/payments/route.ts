import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';
import { generateInvoiceHash } from '@/lib/hash';
import { buildInvoiceSignaturePayload, signWithPrivateKey } from '@/lib/crypto-keys';
import { getCachedOrFetch, redis } from '@/lib/redis';
import { CacheKeys, CacheTTL } from '@/lib/cache-keys';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const url = new URL(req.url);
  const invoiceId = url.searchParams.get('invoice_id');
  const admin = createAdminClient();
  let q = admin.from('payments').select('*').eq('company_id', ctx.profile.company_id).order('payment_date', { ascending: false });
  if (invoiceId) q = q.eq('invoice_id', invoiceId);
  const { data, error } = await q.limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ payments: data ?? [] });
}

export async function POST(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { invoice_id, amount, payment_date, method, reference, notes } = body ?? {};
  if (!invoice_id) return NextResponse.json({ error: 'invoice_id obrigatório' }, { status: 400 });
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) return NextResponse.json({ error: 'Valor inválido' }, { status: 400 });
  const admin = createAdminClient();
  const companyId = ctx.profile.company_id;

  // Load invoice
  const { data: inv, error: invErr } = await admin.from('invoices')
    .select('id, invoice_number, total, amount_paid, status, payment_status, client_id, client_name, client_nif, client_address, document_type')
    .eq('id', invoice_id).eq('company_id', companyId).single();
  if (invErr || !inv) return NextResponse.json({ error: 'Fatura não encontrada' }, { status: 404 });
  if (inv.status !== 'issued') return NextResponse.json({ error: 'Apenas facturas emitidas podem receber pagamentos' }, { status: 400 });

  const total = Number(inv.total ?? 0);
  const alreadyPaid = Number(inv.amount_paid ?? 0);
  const remaining = total - alreadyPaid;
  if (amt > remaining + 0.01) return NextResponse.json({ error: `Valor excede o remanescente (${remaining.toFixed(2)} AOA)` }, { status: 400 });

  let newReceiptInvoice: any = null;

  // Se for Factura (FT) ou Nota de Débito (ND), geramos um Recibo (RC)
  if (['FT', 'ND'].includes(inv.document_type)) {
    const year = new Date().getFullYear();
    const maxAttempts = 3;
    let attempt = 0;

    while (attempt < maxAttempts) {
      attempt++;
      const { data: sequence, error: sErr } = await admin.rpc('get_next_invoice_number', { 
        p_company_id: companyId, p_doc_type: 'RC', p_year: year 
      });
      if (sErr) return NextResponse.json({ error: 'Erro ao gerar numeração do recibo: ' + sErr.message }, { status: 500 });

      const { data: lastInvoice } = await admin.from('invoices')
        .select('hash').eq('company_id', companyId).order('created_at', { ascending: false }).limit(1).maybeSingle();
      
      const prevHash = lastInvoice?.hash || '';
      const issuedAt = payment_date || new Date().toISOString();
      const hash = generateInvoiceHash({ 
        invoice_number: sequence, client_nif: inv.client_nif, total: amt, issued_at: issuedAt, previous_hash: prevHash 
      });

      let signature: string | null = null;
      let signatureKeyId: string | null = null;
      try {
        const { data: config } = await admin.from('fiscal_config').select('chave_privada').eq('company_id', companyId).maybeSingle();
        if (config?.chave_privada) {
          const payload = buildInvoiceSignaturePayload({ invoice_number: sequence, issued_at: issuedAt, total: amt, previous_hash: prevHash });
          signature = signWithPrivateKey(config.chave_privada, payload);

          const { data: keyRow } = await admin.from('fiscal_keys').select('id').eq('company_id', companyId).order('created_at', { ascending: false }).limit(1).maybeSingle();
          if (keyRow?.id) signatureKeyId = keyRow.id;
        }
      } catch (sigErr) { console.error('Signing failed for receipt', sigErr); }

      const { data: ins, error: insErr } = await admin.from('invoices').insert({
        company_id: companyId, client_id: inv.client_id, invoice_number: sequence, document_type: 'RC',
        subtotal: amt, tax: 0, total: amt, status: 'issued', hash, signature,
        signature_key_id: signatureKeyId, previous_hash: prevHash || null,
        tax_exempt: true, tax_exemption_reason: 'M00', // Pagamentos não são tributáveis
        related_document: inv.invoice_number, created_by: ctx.profile.id, issued_at: issuedAt,
        client_name: inv.client_name, client_nif: inv.client_nif, client_address: inv.client_address,
        amount_paid: amt, payment_status: 'pago'
      }).select().single();

      if (insErr) {
        if (insErr.code === '23505') continue;
        return NextResponse.json({ error: insErr.message }, { status: 500 });
      }
      newReceiptInvoice = ins;
      break;
    }

    if (!newReceiptInvoice) return NextResponse.json({ error: 'Falha ao gerar Recibo (concorrência)' }, { status: 500 });

    // Item do recibo
    await admin.from('invoice_items').insert({
      invoice_id: newReceiptInvoice.id,
      description: `Liquidação da Factura ${inv.invoice_number}`,
      quantity: 1,
      price: amt,
      tax_rate: 0,
      total: amt
    });

    // Audit log para recibo
    await admin.from('audit_logs').insert({
      user_id: ctx.profile.id, company_id: companyId,
      action: 'invoice.create', entity: 'invoice', entity_id: newReceiptInvoice.id,
      details: { invoice_number: newReceiptInvoice.invoice_number, total: amt, client_nif: inv.client_nif, hash: newReceiptInvoice.hash },
    });
  }

  // Create payment record
  const { data: payment, error: payErr } = await admin.from('payments').insert({
    company_id: companyId,
    invoice_id,
    amount: amt,
    payment_date: payment_date || new Date().toISOString(),
    method: method || null,
    reference: reference || null,
    notes: notes || null,
    created_by: ctx.profile.id,
  }).select().single();
  if (payErr) return NextResponse.json({ error: payErr.message }, { status: 500 });

  // Update invoice amount_paid + payment_status
  const newPaid = alreadyPaid + amt;
  const newStatus = newPaid >= total - 0.01 ? 'pago' : 'parcial';
  const { error: updErr } = await admin.from('invoices')
    .update({ amount_paid: newPaid, payment_status: newStatus })
    .eq('id', invoice_id);
  if (updErr) {
    // Rollback payment
    await admin.from('payments').delete().eq('id', payment.id);
    return NextResponse.json({ error: 'Falha ao actualizar factura: ' + updErr.message }, { status: 500 });
  }

  // Audit log for payment
  await admin.from('audit_logs').insert({
    company_id: companyId,
    user_id: ctx.profile.id,
    action: 'payment.create',
    entity: 'payment',
    entity_id: payment.id,
    details: { invoice_id, amount: amt, method },
  });

  // Invalidate cache
  if (redis) {
    redis.del(CacheKeys.dashboardStats(companyId)).catch(() => {});
    redis.del(CacheKeys.invoiceList(companyId, 'default')).catch(() => {});
  }

  return NextResponse.json({ 
    payment, 
    invoice: { amount_paid: newPaid, payment_status: newStatus },
    receipt: newReceiptInvoice 
  });
}
