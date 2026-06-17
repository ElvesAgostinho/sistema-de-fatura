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
  const { payment_date, method, reference, notes } = body ?? {};
  
  // Normalizar entrada para array de alocações
  let allocations: { invoice_id: string, amount: number }[] = [];
  if (body.allocations && Array.isArray(body.allocations) && body.allocations.length > 0) {
    allocations = body.allocations;
  } else if (body.invoice_id && body.amount) {
    allocations = [{ invoice_id: body.invoice_id, amount: Number(body.amount) }];
  }

  if (allocations.length === 0) {
    return NextResponse.json({ error: 'Nenhuma factura fornecida para pagamento' }, { status: 400 });
  }

  const admin = createAdminClient();
  const companyId = ctx.profile.company_id;
  
  let totalAmount = 0;
  const invoicesToPay: any[] = [];
  let clientId = null;
  let clientName = null;
  let clientNif = null;
  let clientAddress = null;

  // 1. Validar todas as facturas
  for (const alloc of allocations) {
    const amt = Number(alloc.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return NextResponse.json({ error: `Valor inválido para a factura ${alloc.invoice_id}` }, { status: 400 });
    }
    
    const { data: inv, error: invErr } = await admin.from('invoices')
      .select('id, invoice_number, total, amount_paid, status, payment_status, client_id, client_name, client_nif, client_address, document_type')
      .eq('id', alloc.invoice_id).eq('company_id', companyId).single();
      
    if (invErr || !inv) return NextResponse.json({ error: `Fatura ${alloc.invoice_id} não encontrada` }, { status: 404 });
    if (inv.status !== 'issued') return NextResponse.json({ error: `A factura ${inv.invoice_number} não está emitida` }, { status: 400 });

    const remaining = Number(inv.total ?? 0) - Number(inv.amount_paid ?? 0);
    if (amt > remaining + 0.01) {
      return NextResponse.json({ error: `Valor excede o remanescente na factura ${inv.invoice_number} (${remaining.toFixed(2)} AOA)` }, { status: 400 });
    }

    if (!clientId) {
      clientId = inv.client_id;
      clientName = inv.client_name;
      clientNif = inv.client_nif;
      clientAddress = inv.client_address;
    } else if (clientId !== inv.client_id) {
      return NextResponse.json({ error: 'Todas as facturas liquidadas de uma vez devem pertencer ao mesmo cliente' }, { status: 400 });
    }

    totalAmount += amt;
    invoicesToPay.push({ inv, amount: amt });
  }

  let newReceiptInvoice: any = null;
  const isMultiple = invoicesToPay.length > 1;
  const relatedDocStr = invoicesToPay.map(i => i.inv.invoice_number).join(', ');

  // Se tem facturas tipo FT ou ND, geramos RC
  const hasPayableDocs = invoicesToPay.some(i => ['FT', 'ND'].includes(i.inv.document_type));
  
  if (hasPayableDocs) {
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
        invoice_number: sequence, client_nif: clientNif, total: totalAmount, issued_at: issuedAt, previous_hash: prevHash 
      });

      let signature: string | null = null;
      let signatureKeyId: string | null = null;
      try {
        const { data: config } = await admin.from('fiscal_config').select('chave_privada').eq('company_id', companyId).maybeSingle();
        if (config?.chave_privada) {
          const payload = buildInvoiceSignaturePayload({ invoice_number: sequence, issued_at: issuedAt, total: totalAmount, previous_hash: prevHash });
          signature = signWithPrivateKey(config.chave_privada, payload);

          const { data: keyRow } = await admin.from('fiscal_keys').select('id').eq('company_id', companyId).order('created_at', { ascending: false }).limit(1).maybeSingle();
          if (keyRow?.id) signatureKeyId = keyRow.id;
        }
      } catch (sigErr) { console.error('Signing failed for receipt', sigErr); }

      // Truncate relatedDocStr to 100 chars se a base de dados tiver limite
      const safeRelatedDoc = relatedDocStr.length > 100 ? relatedDocStr.substring(0, 97) + '...' : relatedDocStr;

      const { data: ins, error: insErr } = await admin.from('invoices').insert({
        company_id: companyId, client_id: clientId, invoice_number: sequence, document_type: 'RC',
        subtotal: totalAmount, tax: 0, total: totalAmount, status: 'issued', hash, signature,
        signature_key_id: signatureKeyId, previous_hash: prevHash || null,
        tax_exempt: true, tax_exemption_reason: 'M00',
        related_document: safeRelatedDoc, created_by: ctx.profile.id, issued_at: issuedAt,
        client_name: clientName, client_nif: clientNif, client_address: clientAddress,
        amount_paid: totalAmount, payment_status: 'pago'
      }).select().single();

      if (insErr) {
        if (insErr.code === '23505') continue;
        return NextResponse.json({ error: insErr.message }, { status: 500 });
      }
      newReceiptInvoice = ins;
      break;
    }

    if (!newReceiptInvoice) return NextResponse.json({ error: 'Falha ao gerar Recibo (concorrência)' }, { status: 500 });

    // Inserir linhas do recibo (uma por factura)
    for (const item of invoicesToPay) {
      await admin.from('invoice_items').insert({
        invoice_id: newReceiptInvoice.id,
        description: `Liquidação da Factura ${item.inv.invoice_number}`,
        quantity: 1,
        price: item.amount,
        tax_rate: 0,
        total: item.amount
      });

      try {
        await admin.from('receipt_allocations').insert({
          receipt_id: newReceiptInvoice.id,
          invoice_id: item.inv.id,
          amount: item.amount
        });
      } catch (e) {}
    }

    await admin.from('audit_logs').insert({
      user_id: ctx.profile.id, company_id: companyId,
      action: 'invoice.create', entity: 'invoice', entity_id: newReceiptInvoice.id,
      details: { invoice_number: newReceiptInvoice.invoice_number, total: totalAmount, client_nif: clientNif, hash: newReceiptInvoice.hash, multiple: isMultiple },
    });
  }

  const processedPayments = [];

  // Actualizar Facturas Originais e Registar Pagamentos
  for (const item of invoicesToPay) {
    const { inv, amount } = item;
    
    // Create payment record
    const paymentPayload: any = {
      company_id: companyId,
      invoice_id: inv.id,
      amount: amount,
      payment_date: payment_date || new Date().toISOString(),
      method: method || null,
      reference: reference || null,
      notes: notes || (isMultiple ? `Pagamento múltiplo c/ ${relatedDocStr}` : null),
      created_by: ctx.profile.id,
    };
    
    if (newReceiptInvoice) {
      paymentPayload.receipt_id = newReceiptInvoice.id;
    }

    let { data: payment, error: payErr } = await admin.from('payments').insert(paymentPayload).select().single();
    if (payErr) {
        // Fallback: se receipt_id não existir na DB removemos e tentamos de novo
        delete paymentPayload.receipt_id;
        const fallback = await admin.from('payments').insert(paymentPayload).select().single();
        payment = fallback.data;
        payErr = fallback.error;
    }
    
    if (payErr) {
       console.error("Payment insert error:", payErr);
       continue;
    }

    processedPayments.push(payment);

    // Update invoice amount_paid + payment_status
    const newPaid = Number(inv.amount_paid ?? 0) + amount;
    const newStatus = newPaid >= Number(inv.total) - 0.01 ? 'pago' : 'parcial';
    
    await admin.from('invoices')
      .update({ amount_paid: newPaid, payment_status: newStatus })
      .eq('id', inv.id);

    await admin.from('audit_logs').insert({
      company_id: companyId,
      user_id: ctx.profile.id,
      action: 'payment.create',
      entity: 'payment',
      entity_id: payment?.id || inv.id,
      details: { invoice_id: inv.id, amount, method },
    });
  }

  if (redis) {
    redis.del(CacheKeys.dashboardStats(companyId)).catch(() => {});
    redis.del(CacheKeys.invoiceList(companyId, 'default')).catch(() => {});
  }

  return NextResponse.json({ 
    payments: processedPayments, 
    receipt: newReceiptInvoice 
  });
}
