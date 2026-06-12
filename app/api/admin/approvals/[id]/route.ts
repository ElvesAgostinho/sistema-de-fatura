import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';
import { sendApprovalEmail, sendRejectionEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/approvals/:id
 * body: { action: 'approve' | 'reject', reason?: string }
 * Platform-admin only. Approves or rejects a pending signup.
 * Sends email notification to the user after action.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const ctx = await getCurrentUserContext();
    if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // Use only the DB column — never hardcode emails in source code
    const isPlatformAdmin = ctx.profile?.is_platform_admin === true;
    if (!isPlatformAdmin) return NextResponse.json({ error: 'Forbidden: Apenas o administrador principal pode gerir aprovações' }, { status: 403 });

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

    // Fetch user + company name for email notification
    const { data: target } = await admin
      .from('users')
      .select('id, email, full_name, status, company_id, is_platform_admin')
      .eq('id', params.id)
      .maybeSingle();

    if (!target) return NextResponse.json({ error: 'Utilizador não encontrado' }, { status: 404 });
    if (target.is_platform_admin) return NextResponse.json({ error: 'Não é possível alterar um platform admin' }, { status: 403 });

    if (target.status !== 'pending' && target.status !== 'rejected' && action === 'approve') {
      if (target.status === 'approved') return NextResponse.json({ error: 'Já está aprovada' }, { status: 400 });
    }

    // Fetch company name for email
    const { data: company } = target.company_id
      ? await admin.from('companies').select('name').eq('id', target.company_id).maybeSingle()
      : { data: null };
    const companyName = company?.name ?? 'Empresa';

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

    // Audit log
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

    // 🔔 Send email notification — fire and forget (non-blocking)
    const emailData = {
      to: target.email,
      fullName: target.full_name ?? '',
      companyName,
    };

    if (action === 'approve') {
      sendApprovalEmail(emailData).then(result => {
        if (!result.ok) console.warn('[Approval Email] Failed:', result.error);
        else console.log('[Approval Email] Sent to', target.email);
      });
    } else {
      sendRejectionEmail({ ...emailData, reason }).then(result => {
        if (!result.ok) console.warn('[Rejection Email] Failed:', result.error);
        else console.log('[Rejection Email] Sent to', target.email);
      });
    }

    return NextResponse.json({ success: true, emailQueued: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Erro interno' }, { status: 500 });
  }
}
