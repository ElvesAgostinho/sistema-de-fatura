import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: invoice, error } = await admin
    .from('invoices')
    .select('id, public_token')
    .eq('id', params.id)
    .eq('company_id', ctx.profile.company_id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!invoice) return NextResponse.json({ error: 'Fatura não encontrada' }, { status: 404 });

  if (!invoice.public_token) {
    return NextResponse.json({ url: null });
  }

  const origin = req.headers.get('origin') || new URL(req.url).origin;
  return NextResponse.json({ url: `${origin}/f/${invoice.public_token}` });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  // Check invoice belongs to company
  const { data: invoice, error: fetchErr } = await admin
    .from('invoices')
    .select('id, public_token')
    .eq('id', params.id)
    .eq('company_id', ctx.profile.company_id)
    .maybeSingle();

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!invoice) return NextResponse.json({ error: 'Fatura não encontrada' }, { status: 404 });

  // Re-use existing token if already generated
  let token = invoice.public_token;

  if (!token) {
    token = randomBytes(16).toString('hex');
    const { error: updateErr } = await admin
      .from('invoices')
      .update({ public_token: token })
      .eq('id', params.id);

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  const origin = req.headers.get('origin') || new URL(req.url).origin;
  return NextResponse.json({ url: `${origin}/f/${token}` });
}
