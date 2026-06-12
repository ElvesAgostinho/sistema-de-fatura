import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** Lists pending/approved/rejected accounts. Platform-admin only. */
export async function GET(req: Request) {
  try {
    const ctx = await getCurrentUserContext();
    if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // Use only the DB column — never hardcode emails in source code
    const isPlatformAdmin = ctx.profile?.is_platform_admin === true;
    if (!isPlatformAdmin) return NextResponse.json({ error: 'Forbidden: Apenas o administrador principal pode gerir aprovações' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'pending';
    if (!['pending', 'approved', 'rejected', 'all'].includes(status)) {
      return NextResponse.json({ error: 'Status inválido' }, { status: 400 });
    }

    const admin = createAdminClient();
    let q = admin
      .from('users')
      .select('id, email, status, is_platform_admin, full_name, role, approved_at, rejection_reason, created_at, company_id')
      .order('created_at', { ascending: false });
    if (status !== 'all') q = q.eq('status', status);
    const { data: users, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Attach company info
    const ids = Array.from(new Set((users ?? []).map(u => u.company_id).filter(Boolean)));
    const { data: companies } = ids.length > 0
      ? await admin.from('companies').select('id, name, nif, email, phone, address, created_at').in('id', ids)
      : { data: [] };
    const byId = new Map((companies ?? []).map(c => [c.id, c]));

    const items = (users ?? []).map(u => ({
      ...u,
      company: u.company_id ? byId.get(u.company_id) ?? null : null,
    }));

    return NextResponse.json({ items });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Erro interno' }, { status: 500 });
  }
}
