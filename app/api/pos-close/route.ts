import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const admin = createAdminClient();
  const companyId = ctx.profile.company_id;

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  // 1. Fetch Invoices from today
  const { data: invoices } = await admin.from('invoices')
    .select('id, total, status, document_type')
    .eq('company_id', companyId)
    .gte('issued_at', startOfDay);

  const issued = (invoices || []).filter(i => i.status === 'issued');
  const cancelled = (invoices || []).filter(i => i.status === 'cancelled');

  const totalInvoiced = issued.reduce((sum, inv) => sum + Number(inv.total || 0), 0);

  // 2. Fetch Payments from today
  const { data: payments } = await admin.from('payments')
    .select('id, amount, method, payment_date')
    .eq('company_id', companyId)
    .gte('payment_date', startOfDay);

  const paymentTotals = {
    Dinheiro: 0,
    Multicaixa: 0,
    Transferência: 0,
    Cheque: 0,
    Outro: 0,
  };

  let totalReceived = 0;
  (payments || []).forEach(p => {
    const amt = Number(p.amount || 0);
    totalReceived += amt;
    const method = p.method as keyof typeof paymentTotals;
    if (paymentTotals[method] !== undefined) {
      paymentTotals[method] += amt;
    } else {
      paymentTotals['Outro'] += amt;
    }
  });

  return NextResponse.json({
    date: startOfDay,
    invoices: {
      total_issued: issued.length,
      total_cancelled: cancelled.length,
      total_amount: totalInvoiced,
    },
    payments: {
      total_received: totalReceived,
      breakdown: paymentTotals
    }
  });
}
