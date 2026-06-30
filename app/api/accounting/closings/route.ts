import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const companyId = ctx.profile.company_id;
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') || 'DAILY'; // DAILY, MONTHLY, YEARLY

  try {
    const { data, error } = await admin
      .from('macro_closings')
      .select('*')
      .eq('company_id', companyId)
      .eq('type', type)
      .order('reference_date', { ascending: false })
      .limit(50);

    if (error) throw error;
    
    return NextResponse.json({ closings: data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Erro interno' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const companyId = ctx.profile.company_id;

  try {
    const body = await req.json();
    const { type, reference_date, notes } = body;
    
    if (!type || !reference_date) {
      return NextResponse.json({ error: 'Tipo e data são obrigatórios' }, { status: 400 });
    }

    // Calcular totais
    let start, end;
    const ref = new Date(reference_date);
    if (type === 'DAILY') {
      start = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate()).toISOString();
      end = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 23, 59, 59, 999).toISOString();
    } else if (type === 'MONTHLY') {
      start = new Date(ref.getFullYear(), ref.getMonth(), 1).toISOString();
      end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
    } else {
      start = new Date(ref.getFullYear(), 0, 1).toISOString();
      end = new Date(ref.getFullYear(), 11, 31, 23, 59, 59, 999).toISOString();
    }

    // Aggregates for invoices
    const { data: invoices } = await admin
      .from('invoices')
      .select('total, tax, status')
      .eq('company_id', companyId)
      .gte('issued_at', start)
      .lte('issued_at', end)
      .neq('status', 'cancelled');
      
    const totalRev = invoices?.reduce((s, i) => s + Number(i.total), 0) ?? 0;
    const totalTax = invoices?.reduce((s, i) => s + Number(i.tax), 0) ?? 0;
    const salesCount = invoices?.length ?? 0;

    // Aggregates for sessions
    const { data: sessions } = await admin
      .from('pos_sessions')
      .select('total_cash, total_multicaixa, total_tpa, total_credit')
      .eq('company_id', companyId)
      .gte('opened_at', start)
      .lte('opened_at', end);
      
    const totalCash = sessions?.reduce((s, c) => s + Number(c.total_cash), 0) ?? 0;
    const totalMC = sessions?.reduce((s, c) => s + Number(c.total_multicaixa), 0) ?? 0;
    const totalTPA = sessions?.reduce((s, c) => s + Number(c.total_tpa), 0) ?? 0;
    const totalCredit = sessions?.reduce((s, c) => s + Number(c.total_credit), 0) ?? 0;
    const sessionsCount = sessions?.length ?? 0;

    // Insert macro closing
    const { data: inserted, error: insertError } = await admin.from('macro_closings').insert({
      company_id: companyId,
      type,
      reference_date,
      total_revenue: totalRev,
      total_tax: totalTax,
      total_cash: totalCash,
      total_multicaixa: totalMC,
      total_tpa: totalTPA,
      total_credit: totalCredit,
      sales_count: salesCount,
      sessions_count: sessionsCount,
      closed_by: ctx.user.id,
      notes
    }).select().single();

    if (insertError) throw insertError;

    return NextResponse.json({ success: true, closing: inserted });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Erro interno' }, { status: 500 });
  }
}
