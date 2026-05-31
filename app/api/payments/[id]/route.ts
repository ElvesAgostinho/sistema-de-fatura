import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const admin = createAdminClient();
  const companyId = ctx.profile.company_id;

  const { data: p, error } = await admin.from('payments').select('*').eq('id', params.id).eq('company_id', companyId).single();
  if (error || !p) return NextResponse.json({ error: 'Pagamento não encontrado' }, { status: 404 });

  const { data: inv } = await admin.from('invoices').select('total, amount_paid').eq('id', p.invoice_id).single();
  if (inv) {
    const newPaid = Math.max(0, Number(inv.amount_paid ?? 0) - Number(p.amount ?? 0));
    const newStatus = newPaid <= 0.01 ? 'pendente' : (newPaid >= Number(inv.total ?? 0) - 0.01 ? 'pago' : 'parcial');
    await admin.from('invoices').update({ amount_paid: newPaid, payment_status: newStatus }).eq('id', p.invoice_id);
  }

  await admin.from('payments').delete().eq('id', params.id);

  await admin.from('audit_logs').insert({
    company_id: companyId,
    user_id: ctx.profile.id,
    action: 'payment.delete',
    entity: 'payment',
    entity_id: params.id,
    details: { invoice_id: p.invoice_id, amount: p.amount },
  });
  return NextResponse.json({ ok: true });
}
