import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.profile.role !== 'admin') return NextResponse.json({ error: 'Apenas administradores' }, { status: 403 });
  if (!ctx.profile.company_id) return NextResponse.json({ error: 'Sem empresa associada' }, { status: 400 });

  const url = new URL(req.url);
  const integrationId = url.searchParams.get('integration_id');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);

  const admin = createAdminClient();
  let q = admin
    .from('erp_sync_log')
    .select('id, integration_id, direction, entity, status, message, created_at')
    .eq('company_id', ctx.profile.company_id)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (integrationId) q = q.eq('integration_id', integrationId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ logs: data ?? [] });
}
