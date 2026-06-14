import { ApiResponse } from '@/lib/api-response';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/pos/cash-events
 * Registar entrada ou saída de dinheiro da gaveta (Reforço ou Sangria)
 */
export async function POST(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return ApiResponse.unauthorized();

  try {
    const body = await req.json();
    const { session_id, type, amount, notes } = body ?? {};

    if (!session_id || !type || !amount || amount <= 0) {
      return ApiResponse.error('Dados inválidos para movimento de caixa');
    }

    if (!['IN', 'OUT'].includes(type)) {
      return ApiResponse.error('O tipo de movimento deve ser IN (Reforço) ou OUT (Sangria)');
    }

    const admin = createAdminClient();
    const companyId = ctx.profile.company_id;

    // Verificar se a sessão está aberta
    const { data: session } = await admin
      .from('pos_sessions')
      .select('status')
      .eq('id', session_id)
      .eq('company_id', companyId)
      .single();

    if (!session || session.status !== 'open') {
      return ApiResponse.error('A sessão de caixa não está aberta.');
    }

    // Registar o evento
    const { error } = await admin.from('pos_cash_events').insert({
      company_id: companyId,
      session_id,
      type,
      amount: Number(amount),
      notes: notes ?? null,
      created_by: ctx.profile.id,
    });

    if (error) throw error;

    return ApiResponse.success({ message: 'Movimento registado com sucesso' });
  } catch (err: any) {
    return ApiResponse.error(err?.message, 500);
  }
}

/**
 * GET /api/pos/cash-events?session_id=...
 * Retorna os eventos da sessão
 */
export async function GET(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return ApiResponse.unauthorized();

  const url = new URL(req.url);
  const sessionId = url.searchParams.get('session_id');

  if (!sessionId) return ApiResponse.error('session_id obrigatório');

  try {
    const admin = createAdminClient();
    const { data: events, error } = await admin
      .from('pos_cash_events')
      .select('id, type, amount, notes, created_at')
      .eq('session_id', sessionId)
      .eq('company_id', ctx.profile.company_id)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return ApiResponse.success({ events });
  } catch (err: any) {
    return ApiResponse.error(err?.message, 500);
  }
}
