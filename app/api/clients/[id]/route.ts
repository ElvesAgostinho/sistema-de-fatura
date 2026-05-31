import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const admin = createAdminClient();
  const { data, error } = await admin.from('clients')
    .select('*')
    .eq('id', params.id)
    .eq('company_id', ctx.profile.company_id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
  return NextResponse.json({ client: data });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const admin = createAdminClient();

  try {
    const body = await req.json();
    const { name, address, phone, email } = body ?? {};
    if (!name) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 });

    // Verify ownership
    const { data: existing } = await admin.from('clients')
      .select('id, name').eq('id', params.id).eq('company_id', ctx.profile.company_id).maybeSingle();
    if (!existing) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });

    // NIF cannot be changed (used in fiscal docs)
    const { data, error } = await admin.from('clients').update({
      name, address: address ?? null, phone: phone ?? null, email: email ?? null,
    }).eq('id', params.id).eq('company_id', ctx.profile.company_id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await admin.from('audit_logs').insert({
      user_id: ctx.user.id, company_id: ctx.profile.company_id,
      action: 'client.update', entity: 'client', entity_id: data.id,
      details: { before: existing.name, after: name },
    });
    return NextResponse.json({ client: data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Erro' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const admin = createAdminClient();

  // Verify ownership
  const { data: existing } = await admin.from('clients')
    .select('id, name').eq('id', params.id).eq('company_id', ctx.profile.company_id).maybeSingle();
  if (!existing) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });

  // Check if client has invoices — if so, soft delete (keep for fiscal records)
  const { count: invCount } = await admin.from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', params.id).eq('company_id', ctx.profile.company_id);

  if ((invCount ?? 0) > 0) {
    // Soft delete
    const { error } = await admin.from('clients').update({ is_active: false })
      .eq('id', params.id).eq('company_id', ctx.profile.company_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await admin.from('audit_logs').insert({
      user_id: ctx.user.id, company_id: ctx.profile.company_id,
      action: 'client.archive', entity: 'client', entity_id: params.id,
      details: { name: existing.name, reason: `tem ${invCount} fatura(s)`, soft: true },
    });
    return NextResponse.json({ success: true, archived: true, message: `Cliente arquivado (tem ${invCount} fatura(s) associadas)` });
  }

  // Hard delete (no invoices)
  const { error } = await admin.from('clients').delete()
    .eq('id', params.id).eq('company_id', ctx.profile.company_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await admin.from('audit_logs').insert({
    user_id: ctx.user.id, company_id: ctx.profile.company_id,
    action: 'client.delete', entity: 'client', entity_id: params.id,
    details: { name: existing.name },
  });
  return NextResponse.json({ success: true, archived: false });
}
