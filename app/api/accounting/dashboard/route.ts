import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const companyId = ctx.profile.company_id;

  try {
    // 1. Receivables (Dívidas de Clientes - Faturas não pagas)
    const { data: invoices } = await admin
      .from('invoices')
      .select('id, total, amount_paid, payment_status, issued_at')
      .eq('company_id', companyId)
      .eq('status', 'issued')
      .neq('payment_status', 'pago');

    let totalReceivables = 0;
    const aging = { current: 0, days30: 0, days60: 0, days90plus: 0 };
    const now = Date.now();

    (invoices || []).forEach(inv => {
      const debt = Number(inv.total) - Number(inv.amount_paid || 0);
      if (debt <= 0) return;
      totalReceivables += debt;
      
      const days = Math.floor((now - new Date(inv.issued_at).getTime()) / 86400000);
      if (days > 90) aging.days90plus += debt;
      else if (days > 60) aging.days60 += debt;
      else if (days > 30) aging.days30 += debt;
      else aging.current += debt;
    });

    // 2. Payables (Faturas de Fornecedores)
    // Assumimos que todas as purchases são contas a pagar, pois não há coluna amount_paid
    const { data: purchases } = await admin
      .from('purchases')
      .select('total')
      .eq('company_id', companyId)
      .eq('status', 'completed');
      
    const totalPayables = (purchases || []).reduce((sum, p) => sum + Number(p.total), 0);

    // 3. Billing (Faturação Global - Mês Atual)
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const { data: monthlyInvoices } = await admin
      .from('invoices')
      .select('total, tax')
      .eq('company_id', companyId)
      .eq('status', 'issued')
      .gte('issued_at', startOfMonth);
      
    const monthlyRevenue = (monthlyInvoices || []).reduce((sum, i) => sum + Number(i.total), 0);
    const monthlyTax = (monthlyInvoices || []).reduce((sum, i) => sum + Number(i.tax), 0);

    // 4. Treasury (Caixas)
    const { data: sessions } = await admin
      .from('pos_sessions')
      .select('closing_balance, status')
      .eq('company_id', companyId)
      .eq('status', 'OPEN');
      
    // Caixas abertas
    const currentDrawerCash = (sessions || []).reduce((sum, s) => sum + Number(s.closing_balance || 0), 0);

    return NextResponse.json({
      receivables: {
        total: totalReceivables,
        aging
      },
      payables: {
        total: totalPayables
      },
      billing: {
        monthly_revenue: monthlyRevenue,
        monthly_tax: monthlyTax
      },
      treasury: {
        active_drawers_cash: currentDrawerCash,
        active_sessions: sessions?.length || 0
      }
    });

  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Erro interno' }, { status: 500 });
  }
}
