import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function PATCH(_: Request, { params }: { params: { id: string } }) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', params.id)
      .eq('company_id', ctx.profile.company_id);

    if (error && error.code !== '42P01') {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
