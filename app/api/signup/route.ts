import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, email, companyName, nif, address, phone, fullName } = body ?? {};
    if (!userId || !email || !companyName || !nif) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }
    const admin = createAdminClient();

    // Check if company with NIF exists
    const { data: existing } = await admin.from('companies').select('id').eq('nif', nif).maybeSingle();
    if (existing) {
      return NextResponse.json({ error: 'Já existe uma empresa com este NIF' }, { status: 400 });
    }

    // Create company
    const { data: company, error: cErr } = await admin.from('companies').insert({
      name: companyName, nif, address: address ?? null, phone: phone ?? null, email,
    }).select().single();
    if (cErr || !company) {
      return NextResponse.json({ error: cErr?.message ?? 'Erro ao criar empresa' }, { status: 500 });
    }

    // Create user row linking auth user to company — status='pending' (awaits platform admin approval)
    const { error: uErr } = await admin.from('users').insert({
      id: userId, email, company_id: company.id, role: 'admin',
      status: 'pending', full_name: fullName ?? null,
    });
    if (uErr) {
      await admin.from('companies').delete().eq('id', company.id);
      return NextResponse.json({ error: uErr.message }, { status: 500 });
    }

    // Audit log (visible to platform admin)
    await admin.from('audit_logs').insert({
      user_id: userId, company_id: company.id,
      action: 'signup.pending', entity: 'user', entity_id: userId,
      details: { email, companyName, nif, fullName: fullName ?? null },
    });

    return NextResponse.json({ success: true, company, pending: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Erro interno' }, { status: 500 });
  }
}
