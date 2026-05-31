import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';

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
    .select('id, total, amount_paid, status, payment_status')
    .eq('id', invoice_id).eq('company_id', companyId).single();
  if (invErr || !inv) return NextResponse.json({ error: 'Fatura não encontrada' }, { status: 404 });
  if (inv.status !== 'issued') return NextResponse.json({ error: 'Apenas facturas emitidas podem receber pagamentos' }, { status: 400 });

  const total = Number(inv.total ?? 0);
  const alreadyPaid = Number(inv.amount_paid ?? 0);
  const remaining = total - alreadyPaid;
  if (amt > remaining + 0.01) return NextResponse.json({ error: `Valor excede o remanescente (${remaining.toFixed(2)} AOA)` }, { status: 400 });

  // Create payment
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

  // Audit log
  await admin.from('audit_logs').insert({
    company_id: companyId,
    user_id: ctx.profile.id,
    action: 'payment.create',
    entity: 'payment',
    entity_id: payment.id,
    details: { invoice_id, amount: amt, method },
  });

  return NextResponse.json({ payment, invoice: { amount_paid: newPaid, payment_status: newStatus } });
}
