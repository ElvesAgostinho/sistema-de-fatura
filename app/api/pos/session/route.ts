import { ApiResponse } from '@/lib/api-response';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/pos/session
 * Returns the open session for THIS user on THIS terminal.
 * Multiple cashiers can have simultaneous open sessions (one per user).
 * Query param: ?terminal_name=Caixa+1 to scope by terminal.
 */
export async function GET(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return ApiResponse.unauthorized();

  const url    = new URL(req.url);
  const terminal = url.searchParams.get('terminal_name');

  try {
    const admin = createAdminClient();
    let query = admin
      .from('pos_sessions')
      .select('*')
      .eq('company_id', ctx.profile.company_id)
      .eq('status', 'open')
      .order('opened_at', { ascending: false });

    // Scope to current user — each user has their own session
    query = query.eq('opened_by', ctx.profile.id);

    // Optionally filter by terminal (for multi-display setups)
    if (terminal) query = query.eq('terminal_name', terminal);

    const { data: session } = await query.limit(1).maybeSingle();
    return ApiResponse.success({ session: session ?? null });
  } catch (err: any) {
    return ApiResponse.error(err?.message, 500);
  }
}

/**
 * POST /api/pos/session
 * Open or close a session. Multiple cashiers can have open sessions simultaneously.
 * Each user can only have ONE open session at a time.
 */
export async function POST(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return ApiResponse.unauthorized();

  try {
    const body = await req.json();
    const { action, session_id, terminal_name, opening_balance, closing_balance, notes } = body ?? {};

    const admin     = createAdminClient();
    const companyId = ctx.profile.company_id;
    const userId    = ctx.profile.id;

    if (action === 'open') {
      // Each USER can only have one open session — but different users can run simultaneously
      const { data: existing } = await admin
        .from('pos_sessions')
        .select('id, terminal_name')
        .eq('company_id', companyId)
        .eq('opened_by', userId)      // scoped to THIS user only
        .eq('status', 'open')
        .maybeSingle();

      if (existing) {
        // Return the existing session rather than blocking — allows page refreshes
        const { data: sess } = await admin
          .from('pos_sessions')
          .select('*')
          .eq('id', existing.id)
          .single();
        return ApiResponse.success({ session: sess, resumed: true });
      }

      const { data: session, error } = await admin.from('pos_sessions').insert({
        company_id:      companyId,
        opened_by:       userId,
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
        closed_by:       userId,
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
