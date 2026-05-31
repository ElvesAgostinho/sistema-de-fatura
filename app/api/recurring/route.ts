import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const ctx = await getCurrentUserContext();
    if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('recurring_invoices')
      .select('id, frequency, amount, currency, next_issue_date, is_active, description, client:clients(id, name, nif)')
      .eq('company_id', ctx.profile.company_id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getCurrentUserContext();
    if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { client_id, frequency, amount, next_issue_date, description } = body;

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('recurring_invoices')
      .insert({
        company_id: ctx.profile.company_id,
        client_id,
        frequency,
        amount,
        next_issue_date,
        description
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ message: 'Success', data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
