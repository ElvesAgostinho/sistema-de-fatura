import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const ctx = await getCurrentUserContext();
    if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { is_active } = body;

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('recurring_invoices')
      .update({ is_active })
      .eq('id', params.id)
      .eq('company_id', ctx.profile.company_id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ message: 'Success', data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
