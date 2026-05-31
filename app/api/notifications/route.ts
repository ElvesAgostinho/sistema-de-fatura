import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('notifications')
      .select('*')
      .eq('company_id', ctx.profile.company_id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      // Table may not exist yet — return empty gracefully
      if (error.code === '42P01') {
        return NextResponse.json({ notifications: [], unread_count: 0 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const notifications = data ?? [];
    const unread_count = notifications.filter((n: any) => !n.read_at).length;

    return NextResponse.json({ notifications, unread_count });
  } catch {
    return NextResponse.json({ notifications: [], unread_count: 0 });
  }
}

export async function PATCH(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const admin = createAdminClient();
  const now = new Date().toISOString();

  try {
    if (body.all === true) {
      const { error } = await admin
        .from('notifications')
        .update({ read_at: now })
        .eq('company_id', ctx.profile.company_id)
        .is('read_at', null);

      if (error && error.code !== '42P01') {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else if (Array.isArray(body.ids) && body.ids.length > 0) {
      const { error } = await admin
        .from('notifications')
        .update({ read_at: now })
        .in('id', body.ids)
        .eq('company_id', ctx.profile.company_id);

      if (error && error.code !== '42P01') {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
