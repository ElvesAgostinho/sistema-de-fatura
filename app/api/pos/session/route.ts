import { ApiResponse } from '@/lib/api-response';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** GET /api/pos/session — returns the current open session for this company */
export async function GET() {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return ApiResponse.unauthorized();

  try {
    const admin = createAdminClient();
    const { data: session } = await admin
      .from('pos_sessions')
      .select('*')
      .eq('company_id', ctx.profile.company_id)
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return ApiResponse.success({ session: session ?? null });
  } catch (err: any) {
    return ApiResponse.error(err?.message, 500);
  }
}

/** POST /api/pos/session — open or close a session */
export async function POST(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return ApiResponse.unauthorized();

  try {
    const body = await req.json();
    const { action, session_id, terminal_name, opening_balance, closing_balance, notes } = body ?? {};

    const admin = createAdminClient();
    const companyId = ctx.profile.company_id;

    if (action === 'open') {
      // Check no open session exists
      const { data: existing } = await admin
        .from('pos_sessions')
        .select('id, terminal_name')
        .eq('company_id', companyId)
        .eq('status', 'open')
        .maybeSingle();

      if (existing) {
        return ApiResponse.error(`Já existe uma sessão aberta: ${existing.terminal_name}`, 400);
      }

      const { data: session, error } = await admin.from('pos_sessions').insert({
        company_id:      companyId,
        opened_by:       ctx.profile.id,
        terminal_name:   terminal_name ?? 'Caixa 1',
        opening_balance: Number(opening_balance ?? 0),
        status:          'open',
      }).select().single();

      if (error) return ApiResponse.error(error.message, 500);
      return ApiResponse.success({ session });
    }

    if (action === 'close') {
      if (!session_id) return ApiResponse.error('session_id obrigatório');

      const { data: session, error } = await admin.from('pos_sessions').update({
        status:          'closed',
        closed_by:       ctx.profile.id,
        closed_at:       new Date().toISOString(),
        closing_balance: Number(closing_balance ?? 0),
        notes:           notes ?? null,
      }).eq('id', session_id).eq('company_id', companyId).select().single();

      if (error) return ApiResponse.error(error.message, 500);
      return ApiResponse.success({ session });
    }

    return ApiResponse.error('Acção inválida. Use "open" ou "close".');
  } catch (err: any) {
    return ApiResponse.error(err?.message, 500);
  }
}
