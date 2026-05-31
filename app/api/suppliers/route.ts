import { ApiResponse } from '@/lib/api-response';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return ApiResponse.unauthorized();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('suppliers')
    .select('*')
    .eq('company_id', ctx.profile.company_id)
    .order('name');

  if (error) return ApiResponse.error(error.message, 500);
  return ApiResponse.success({ suppliers: data ?? [] });
}

export async function POST(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return ApiResponse.unauthorized();

  try {
    const body = await req.json();
    const { name, nif, address, phone, email } = body ?? {};
    if (!name || !nif) return ApiResponse.error('Nome e NIF obrigatórios');

    const admin = createAdminClient();
    const { data, error } = await admin.from('suppliers').insert({
      company_id: ctx.profile.company_id,
      name, nif, address: address || null,
      phone: phone || null, email: email || null,
    }).select().single();

    if (error) return ApiResponse.error(error.message);

    await admin.from('audit_logs').insert({
      user_id: ctx.user.id, company_id: ctx.profile.company_id,
      action: 'supplier.create', entity: 'supplier', entity_id: data.id,
      details: { name, nif },
    });

    return ApiResponse.success({ supplier: data });
  } catch (err: any) {
    return ApiResponse.error(err?.message ?? 'Erro interno no servidor', 500);
  }
}
