import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ company: ctx.company });
}

export async function PUT(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.profile.role !== 'admin') return NextResponse.json({ error: 'Apenas administradores podem alterar definições da empresa' }, { status: 403 });
  try {
    const body = await req.json();
    const { name, address, phone, email, logo_url } = body ?? {};
    const admin = createAdminClient();
    const update: any = {};
    if (name !== undefined) update.name = name;
    if (address !== undefined) update.address = address;
    if (phone !== undefined) update.phone = phone;
    if (email !== undefined) update.email = email;
    if (logo_url !== undefined) update.logo_url = logo_url;
    const { data, error } = await admin.from('companies').update(update).eq('id', ctx.profile.company_id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await admin.from('audit_logs').insert({
      user_id: ctx.user.id, company_id: ctx.profile.company_id,
      action: 'company.update', entity: 'company', entity_id: ctx.profile.company_id,
      details: update,
    });
    return NextResponse.json({ company: data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Erro' }, { status: 500 });
  }
}
