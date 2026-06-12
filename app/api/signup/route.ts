import { NextResponse } from 'next/server';
import { createAdminClient, createServerSupabaseClient } from '@/lib/supabase/server';
import { sendPendingConfirmationEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    // Extract userId from the authenticated Supabase session, NOT from client body
    const supabase = createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado. Faça login primeiro.' }, { status: 401 });
    }

    const body = await req.json();
    const { email, companyName, nif, address, phone, fullName } = body ?? {};
    if (!email || !companyName || !nif) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    // Validate NIF length (Angola NIFs: 9-10 digits)
    const cleanNif = String(nif).trim();
    if (!/^\d{9,14}$/.test(cleanNif)) {
      return NextResponse.json({ error: 'NIF inválido (deve ter entre 9 e 14 dígitos)' }, { status: 400 });
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
    }

    // Validate field lengths
    if (String(companyName).trim().length < 2 || String(companyName).trim().length > 200) {
      return NextResponse.json({ error: 'Nome da empresa deve ter entre 2 e 200 caracteres' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Check if company with NIF exists
    const { data: existing } = await admin.from('companies').select('id').eq('nif', cleanNif).maybeSingle();
    if (existing) {
      return NextResponse.json({ error: 'Já existe uma empresa com este NIF' }, { status: 400 });
    }

    // Check if user already has a profile
    const { data: existingUser } = await admin.from('users').select('id, status').eq('id', user.id).maybeSingle();
    if (existingUser) {
      return NextResponse.json({ error: 'Este utilizador já tem uma conta registada', status: existingUser.status }, { status: 400 });
    }

    // Create company
    const { data: company, error: cErr } = await admin.from('companies').insert({
      name: String(companyName).trim(),
      nif: cleanNif,
      address: address ? String(address).trim().slice(0, 500) : null,
      phone: phone ? String(phone).trim().slice(0, 50) : null,
      email,
    }).select().single();
    if (cErr || !company) {
      return NextResponse.json({ error: cErr?.message ?? 'Erro ao criar empresa' }, { status: 500 });
    }

    // Create user row linking auth user to company — status='pending' (awaits platform admin approval)
    const { error: uErr } = await admin.from('users').insert({
      id: user.id,
      email,
      company_id: company.id,
      role: 'admin',
      status: 'pending',
      full_name: fullName ? String(fullName).trim().slice(0, 200) : null,
    });
    if (uErr) {
      // Rollback company creation
      await admin.from('companies').delete().eq('id', company.id);
      return NextResponse.json({ error: uErr.message }, { status: 500 });
    }

    // Audit log (visible to platform admin)
    await admin.from('audit_logs').insert({
      user_id: user.id, company_id: company.id,
      action: 'signup.pending', entity: 'user', entity_id: user.id,
      details: { email, companyName: String(companyName).trim(), nif: cleanNif, fullName: fullName ?? null },
    });

    // 🔔 Send confirmation email to the user — fire and forget
    sendPendingConfirmationEmail({
      to: email,
      fullName: fullName ? String(fullName).trim() : email,
      companyName: String(companyName).trim(),
      nif: cleanNif,
    }).then(result => {
      if (!result.ok) console.warn('[Signup Email] Failed:', result.error);
    });

    return NextResponse.json({ success: true, company, pending: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Erro interno' }, { status: 500 });
  }
}
