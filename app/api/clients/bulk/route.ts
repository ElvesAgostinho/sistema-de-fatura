import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  try {
    const { clients } = await req.json();
    if (!Array.isArray(clients) || clients.length === 0) {
      return NextResponse.json({ error: 'Nenhum cliente fornecido' }, { status: 400 });
    }

    const admin = createAdminClient();
    const companyId = ctx.profile.company_id;

    // Validate and prepare
    const toInsert = clients.map(c => ({
      company_id: companyId,
      name: String(c.name || '').trim(),
      nif: String(c.nif || '999999999').trim(),
      email: c.email ? String(c.email).trim() : null,
      phone: c.phone ? String(c.phone).trim() : null,
      address: c.address ? String(c.address).trim() : null,
      is_active: true
    })).filter(c => c.name.length > 0);

    if (toInsert.length === 0) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
    }

    const { data, error } = await admin.from('clients').insert(toInsert).select('id');
    if (error) throw error;

    await admin.from('audit_logs').insert({
      user_id: ctx.user.id,
      company_id: companyId,
      action: 'client.bulk_import',
      entity: 'client',
      details: { count: toInsert.length }
    });

    return NextResponse.json({ success: true, count: toInsert.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao importar' }, { status: 500 });
  }
}
