import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const isSuperAdmin = ctx.profile.email === 'elvessacapuri57@gmail.com';
  if (ctx.profile.role !== 'admin' && !isSuperAdmin) return NextResponse.json({ error: 'Apenas administradores podem aceder à auditoria' }, { status: 403 });
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '200'), 500);
  const action = url.searchParams.get('action') || '';
  const entity = url.searchParams.get('entity') || '';
  const from = url.searchParams.get('date_from') || '';
  const to = url.searchParams.get('date_to') || '';
  const search = (url.searchParams.get('search') || '').trim();

  const admin = createAdminClient();
  let q = admin
    .from('audit_logs')
    .select('id, action, entity, entity_id, details, created_at')
    .eq('company_id', ctx.profile.company_id)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (action) q = q.eq('action', action);
  if (entity) q = q.eq('entity', entity);
  if (from) q = q.gte('created_at', from);
  if (to) q = q.lte('created_at', to + 'T23:59:59Z');
  if (search) q = q.ilike('entity_id', `%${search}%`);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ logs: data ?? [] });
}
