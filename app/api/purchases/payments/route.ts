import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';
import { getCachedOrFetch, redis } from '@/lib/redis';
import { CacheKeys } from '@/lib/cache-keys';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const url = new URL(req.url);
  const purchaseId = url.searchParams.get('purchase_id');
  const admin = createAdminClient();
  let q = admin.from('purchase_payments').select('*').eq('company_id', ctx.profile.company_id).order('payment_date', { ascending: false });
  if (purchaseId) q = q.eq('purchase_id', purchaseId);
  const { data, error } = await q.limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ payments: data ?? [] });
}

export async function POST(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const body = await req.json().catch(() => ({}));
  const { payment_date, method, reference, notes } = body ?? {};
  
  let allocations: { purchase_id: string, amount: number }[] = [];
  if (body.allocations && Array.isArray(body.allocations) && body.allocations.length > 0) {
    allocations = body.allocations;
  } else if (body.purchase_id && body.amount) {
    allocations = [{ purchase_id: body.purchase_id, amount: Number(body.amount) }];
  }

  if (allocations.length === 0) {
    return NextResponse.json({ error: 'Nenhuma despesa fornecida para pagamento' }, { status: 400 });
  }

  const admin = createAdminClient();
  const companyId = ctx.profile.company_id;
  
  let totalAmount = 0;
  const purchasesToPay: any[] = [];
  let supplierId = null;

  for (const alloc of allocations) {
    const amt = Number(alloc.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return NextResponse.json({ error: `Valor inválido para a despesa ${alloc.purchase_id}` }, { status: 400 });
    }
    
    const { data: pur, error: purErr } = await admin.from('purchases')
      .select('id, purchase_number, total, amount_paid, status, payment_status, supplier_id')
      .eq('id', alloc.purchase_id).eq('company_id', companyId).single();
      
    if (purErr || !pur) return NextResponse.json({ error: `Despesa não encontrada` }, { status: 404 });

    const remaining = Number(pur.total ?? 0) - Number(pur.amount_paid ?? 0);
    if (amt > remaining + 0.01) {
      return NextResponse.json({ error: `Valor excede o remanescente na factura ${pur.purchase_number}` }, { status: 400 });
    }

    if (!supplierId) {
      supplierId = pur.supplier_id;
    } else if (supplierId !== pur.supplier_id) {
      return NextResponse.json({ error: 'Todas as liquidações num lote devem ser do mesmo fornecedor' }, { status: 400 });
    }

    totalAmount += amt;
    purchasesToPay.push({ pur, amount: amt });
  }

  const isMultiple = purchasesToPay.length > 1;
  const relatedDocStr = purchasesToPay.map(p => p.pur.purchase_number).join(', ');
  const processedPayments = [];

  for (const item of purchasesToPay) {
    const { pur, amount } = item;
    
    const paymentPayload: any = {
      company_id: companyId,
      purchase_id: pur.id,
      amount: amount,
      payment_date: payment_date || new Date().toISOString(),
      method: method || null,
      reference: reference || null,
      notes: notes || (isMultiple ? `Parte de pagamento múltiplo ao fornecedor` : null),
      created_by: ctx.profile.id,
    };
    
    const { data: payment, error: payErr } = await admin.from('purchase_payments').insert(paymentPayload).select().single();
    if (payErr) {
       console.error("Purchase payment error:", payErr);
       continue;
    }

    processedPayments.push(payment);

    const newPaid = Number(pur.amount_paid ?? 0) + amount;
    const newStatus = newPaid >= Number(pur.total) - 0.01 ? 'pago' : 'parcial';
    
    await admin.from('purchases')
      .update({ amount_paid: newPaid, payment_status: newStatus })
      .eq('id', pur.id);

    await admin.from('audit_logs').insert({
      company_id: companyId,
      user_id: ctx.profile.id,
      action: 'purchase.payment',
      entity: 'purchase_payment',
      entity_id: payment.id,
      details: { purchase_id: pur.id, amount, method },
    });
  }

  return NextResponse.json({ 
    payments: processedPayments 
  });
}
