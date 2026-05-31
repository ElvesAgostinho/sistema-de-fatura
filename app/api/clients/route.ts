import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const search = url.searchParams.get('search') ?? '';
  const includeInactive = url.searchParams.get('include_inactive') === '1';
  const admin = createAdminClient();
  // Minimal payload: fetch only the fields the UI displays for listing.
  let query = admin
    .from('clients')
    .select('id, name, nif, address, phone, email, is_active, created_at')
    .eq('company_id', ctx.profile.company_id)
    .order('created_at', { ascending: false })
    .limit(1000);
  if (!includeInactive) query = query.eq('is_active', true);
  if (search) query = query.or(`name.ilike.%${search}%,nif.ilike.%${search}%,email.ilike.%${search}%`);
  try {
    const { data, error } = await query;
    if (error) {
      console.error('[API CLIENTS] Supabase Error:', error);
      return ApiResponse.error(`Erro na base de dados: ${error.message}`, 500);
    }
    return ApiResponse.success({ clients: data ?? [] });
  } catch (err: any) {
    console.error('[API CLIENTS] Runtime Error:', err);
    return ApiResponse.error(err?.message ?? 'Erro interno no servidor', 500);
  }
}

export async function POST(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return ApiResponse.unauthorized();

  try {
    const body = await req.json();
    const { name, nif, address, phone, email } = body ?? {};
    if (!name || !nif) return ApiResponse.error('Nome e NIF obrigatórios', 400);

    const admin = createAdminClient();
    const { data, error } = await admin.from('clients').insert({
      company_id: ctx.profile.company_id,
      name, nif, address: address ?? null, phone: phone ?? null, email: email ?? null,
    }).select().single();
    if (error) return ApiResponse.error(error.message, 400);

    await admin.from('audit_logs').insert({
      user_id: ctx.user.id, company_id: ctx.profile.company_id,
      action: 'client.create', entity: 'client', entity_id: data.id,
      details: { name, nif },
    });

    return ApiResponse.success({ client: data });
  } catch (err: any) {
    return ApiResponse.error(err?.message ?? 'Erro', 500);
  }
}
