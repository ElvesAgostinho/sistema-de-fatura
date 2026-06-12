import { ApiResponse } from '@/lib/api-response';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/pos/z-report
 * Persists a Z-Report to the database with a sequential number.
 * Called when the cashier confirms the end-of-day closing.
 */
export async function POST(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return ApiResponse.unauthorized();

  const companyId = ctx.profile.company_id;
  const admin = createAdminClient();

  try {
    const body = await req.json();
    const {
      session_id,
      terminal_name,
      opened_at,
      closed_at,
      opened_by_email,
      opening_balance,
      closing_balance,
      total_cash,
      total_multicaixa,
      total_tpa,
      total_credit,
      total_sales,
      sales_count,
      tax_total,
      difference,
      notes,
    } = body ?? {};

    // Get next sequential Z-Report number for this company
    const { data: lastZ } = await admin
      .from('pos_z_reports')
      .select('z_number')
      .eq('company_id', companyId)
      .order('z_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    const zNumber = (lastZ?.z_number ?? 0) + 1;

    // Build a simple hash for integrity
    const hashPayload = `${companyId}|${zNumber}|${total_sales}|${new Date().toISOString()}`;
    const hashBytes = new TextEncoder().encode(hashPayload);
    // Simple checksum for the receipt (not crypto — just for display)
    const hash = Array.from(hashBytes.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join('');

    const { data: zReport, error } = await admin
      .from('pos_z_reports')
      .insert({
        company_id:       companyId,
        session_id:       session_id ?? null,
        z_number:         zNumber,
        generated_by:     ctx.user.id,
        terminal_name:    terminal_name ?? 'Caixa 1',
        opened_at:        opened_at ?? null,
        closed_at:        closed_at ?? new Date().toISOString(),
        opened_by_email:  opened_by_email ?? '',
        opening_balance:  Number(opening_balance ?? 0),
        closing_balance:  Number(closing_balance ?? 0),
        total_cash:       Number(total_cash ?? 0),
        total_multicaixa: Number(total_multicaixa ?? 0),
        total_tpa:        Number(total_tpa ?? 0),
        total_credit:     Number(total_credit ?? 0),
        total_sales:      Number(total_sales ?? 0),
        sales_count:      Number(sales_count ?? 0),
        tax_total:        Number(tax_total ?? 0),
        difference:       Number(difference ?? 0),
        notes:            notes ?? null,
        hash,
      })
      .select()
      .single();

    if (error) return ApiResponse.error(error.message, 500);

    // Audit log
    void admin.from('audit_logs').insert({
      user_id:    ctx.user.id,
      company_id: companyId,
      action:     'pos.z_report',
      entity:     'pos_z_reports',
      entity_id:  zReport.id,
      details:    { z_number: zNumber, total_sales, session_id },
    });

    return ApiResponse.success({ z_report: zReport, z_number: zNumber, hash });
  } catch (err: any) {
    return ApiResponse.error(err?.message ?? 'Erro ao guardar Z-Report', 500);
  }
}

/**
 * GET /api/pos/z-report?limit=10
 * Returns recent Z-Reports for this company.
 */
export async function GET(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return ApiResponse.unauthorized();

  const admin = createAdminClient();
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get('limit') ?? 20), 100);

  try {
    const { data, error } = await admin
      .from('pos_z_reports')
      .select('*')
      .eq('company_id', ctx.profile.company_id)
      .order('z_number', { ascending: false })
      .limit(limit);

    if (error) return ApiResponse.error(error.message, 500);
    return ApiResponse.success({ z_reports: data ?? [] });
  } catch (err: any) {
    return ApiResponse.error(err?.message, 500);
  }
}
