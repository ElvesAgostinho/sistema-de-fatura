import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/pos-close?session_id=XXX
 * Returns the complete closing report for a POS session.
 * If session_id is provided, uses session data (precise).
 * If not, falls back to today's date aggregation (legacy).
 */
export async function GET(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const companyId = ctx.profile.company_id;
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('session_id');

  try {
    let session: any = null;
    let startTime: string;
    let endTime: string;

    if (sessionId) {
      // Fetch session with opener info
      const { data: sess } = await admin
        .from('pos_sessions')
        .select(`
          id, terminal_name, status, opening_balance, closing_balance,
          opened_at, closed_at, notes,
          total_cash, total_multicaixa, total_tpa, total_credit, total_sales, sales_count,
          opened_by, closed_by
        `)
        .eq('id', sessionId)
        .eq('company_id', companyId)
        .maybeSingle();

      if (!sess) return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 });

      // Get opener email
      let openedByEmail = '';
      if (sess.opened_by) {
        const { data: opener } = await admin
          .from('users')
          .select('email')
          .eq('id', sess.opened_by)
          .maybeSingle();
        openedByEmail = opener?.email ?? '';
      }

      session = { ...sess, opened_by_email: openedByEmail };
      startTime = sess.opened_at;
      endTime = sess.closed_at ?? new Date().toISOString();
    } else {
      // Legacy: today's date
      const now = new Date();
      startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      endTime = now.toISOString();
    }

    // Fetch invoices in the session
    let invoiceQuery = admin
      .from('invoices')
      .select('id, total, subtotal, tax, status, document_type, payment_status')
      .eq('company_id', companyId);

    if (sessionId) {
      invoiceQuery = invoiceQuery.eq('session_id', sessionId);
    } else {
      invoiceQuery = invoiceQuery.gte('issued_at', startTime);
      if (endTime) invoiceQuery = invoiceQuery.lte('issued_at', endTime);
    }

    const { data: invoices } = await invoiceQuery;

    const issued    = (invoices || []).filter(i => i.status !== 'cancelled');
    const cancelled = (invoices || []).filter(i => i.status === 'cancelled');

    const totalInvoiced = issued.reduce((s, i) => s + Number(i.total || 0), 0);
    const taxTotal      = issued.reduce((s, i) => s + Number(i.tax || 0), 0);
    const subtotalSum   = issued.reduce((s, i) => s + Number(i.subtotal || 0), 0);

    // Fetch payments in session
    let payQuery = admin
      .from('payments')
      .select('id, amount, method')
      .eq('company_id', companyId);

    if (sessionId) {
      payQuery = payQuery.eq('session_id', sessionId);
    } else {
      payQuery = payQuery.gte('payment_date', startTime);
      if (endTime) payQuery = payQuery.lte('payment_date', endTime);
    }

    const { data: payments } = await payQuery;

    const breakdown: Record<string, number> = {
      Dinheiro: 0, Multicaixa: 0, Transferência: 0, Cheque: 0,
      TPA: 0, Crédito: 0, Misto: 0, Outro: 0,
    };
    let totalReceived = 0;
    (payments || []).forEach(p => {
      const amt = Number(p.amount || 0);
      totalReceived += amt;
      const method = p.method as string;
      if (method in breakdown) breakdown[method] += amt;
      else breakdown['Outro'] += amt;
    });

    // Fetch cash events (Reforços e Sangrias)
    let eventsQuery = admin.from('pos_cash_events').select('type, amount').eq('company_id', companyId);
    if (sessionId) {
      eventsQuery = eventsQuery.eq('session_id', sessionId);
    } else {
      eventsQuery = eventsQuery.gte('created_at', startTime);
      if (endTime) eventsQuery = eventsQuery.lte('created_at', endTime);
    }
    const { data: cashEvents } = await eventsQuery;

    let totalIn = 0;
    let totalOut = 0;
    (cashEvents || []).forEach(ev => {
      if (ev.type === 'IN') totalIn += Number(ev.amount || 0);
      if (ev.type === 'OUT') totalOut += Number(ev.amount || 0);
    });

    // If session has stored totals (from increment_pos_session RPC), prefer those
    const sessionTotals = session ? {
      total_cash:       Number(session.total_cash ?? 0),
      total_multicaixa: Number(session.total_multicaixa ?? 0),
      total_tpa:        Number(session.total_tpa ?? 0),
      total_credit:     Number(session.total_credit ?? 0),
      total_sales:      Number(session.total_sales ?? 0),
      sales_count:      Number(session.sales_count ?? issued.length),
    } : {
      total_cash:       breakdown['Dinheiro'],
      total_multicaixa: breakdown['Multicaixa'],
      total_tpa:        breakdown['TPA'],
      total_credit:     breakdown['Crédito'],
      total_sales:      totalInvoiced,
      sales_count:      issued.length,
    };

    const openingBalance  = Number(session?.opening_balance ?? 0);
    const closingBalance  = Number(session?.closing_balance ?? 0);
    const expectedInCash  = openingBalance + sessionTotals.total_cash + totalIn - totalOut;
    const difference      = closingBalance - expectedInCash;

    // Next Z-Report number for this company
    const { data: lastZ } = await admin
      .from('pos_z_reports')
      .select('z_number')
      .eq('company_id', companyId)
      .order('z_number', { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextZNumber = (lastZ?.z_number ?? 0) + 1;

    return NextResponse.json({
      session: session ?? null,
      next_z_number: nextZNumber,
      period: { from: startTime, to: endTime },
      invoices: {
        total_issued:    issued.length,
        total_cancelled: cancelled.length,
        total_amount:    totalInvoiced,
        subtotal:        subtotalSum,
        tax_total:       taxTotal,
      },
      payments: {
        total_received: totalReceived,
        breakdown,
      },
      session_totals:   sessionTotals,
      cash_events: {
        total_in: totalIn,
        total_out: totalOut,
      },
      reconciliation: {
        opening_balance:  openingBalance,
        closing_balance:  closingBalance,
        expected_in_cash: expectedInCash,
        difference,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Erro interno' }, { status: 500 });
  }
}
