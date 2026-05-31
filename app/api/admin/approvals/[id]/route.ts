import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/approvals/:id
 * body: { action: 'approve' | 'reject', reason?: string }
 * Platform-admin only. Approves or rejects a pending signup.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const isSuperAdmin = ctx.profile?.email === 'elvessacapuri57@gmail.com' || ctx.user?.email === 'elvessacapuri57@gmail.com' || ctx.profile?.is_platform_admin === true;
  if (!isSuperAdmin) return NextResponse.json({ error: 'Forbidden: Apenas o administrador principal pode gerir aprovações' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const action = body?.action as 'approve' | 'reject' | undefined;
  const reason = (body?.reason ?? '').toString().trim();

  if (!action || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Acção inválida' }, { status: 400 });
  }
  if (action === 'reject' && reason.length < 5) {
    return NextResponse.json({ error: 'Motivo de rejeição é obrigatório (mín 5 caracteres)' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: target } = await admin
    .from('users')
    .select('id, email, status, company_id, is_platform_admin')
    .eq('id', params.id)
    .maybeSingle();

  if (!target) return NextResponse.json({ error: 'Utilizador não encontrado' }, { status: 404 });
  if (target.is_platform_admin) return NextResponse.json({ error: 'Não é possível alterar um platform admin' }, { status: 403 });

  if (target.status !== 'pending' && target.status !== 'rejected' && action === 'approve') {
    // Allow re-approving a rejected account, but a non-pending+non-rejected cannot be re-approved
    if (target.status === 'approved') return NextResponse.json({ error: 'Já está aprovada' }, { status: 400 });
  }

  const before = { status: target.status };
  const now = new Date().toISOString();

  if (action === 'approve') {
    const { error } = await admin.from('users').update({
      status: 'approved',
      approved_at: now,
      approved_by: ctx.profile.id,
      rejection_reason: null,
    }).eq('id', params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await admin.from('users').update({
      status: 'rejected',
      rejection_reason: reason,
      approved_at: null,
      approved_by: null,
    }).eq('id', params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await admin.from('audit_logs').insert({
    user_id: ctx.profile.id,
    company_id: target.company_id,
    action: action === 'approve' ? 'signup.approved' : 'signup.rejected',
    entity: 'user',
    entity_id: params.id,
    details: {
      target_email: target.email,
      before,
      after: { status: action === 'approve' ? 'approved' : 'rejected' },
      reason: action === 'reject' ? reason : undefined,
      actor_email: ctx.profile.email,
    },
  });

  return NextResponse.json({ success: true });
}
