import { ApiResponse } from '@/lib/api-response';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return ApiResponse.unauthorized();

  const admin = createAdminClient();
  const { data, error } = await admin.from('suppliers').select(`
    *,
    purchases (
      id, purchase_number, total, amount_paid, status, payment_status, issued_at
    )
  `).eq('id', params.id).eq('company_id', ctx.profile.company_id).single();

  if (error || !data) return ApiResponse.error('Fornecedor não encontrado', 404);

  return ApiResponse.success({ supplier: data });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return ApiResponse.unauthorized();

  try {
    const body = await req.json();
    const { name, nif, address, phone, email } = body ?? {};

    const admin = createAdminClient();
    const { data, error } = await admin.from('suppliers').update({
      name, nif, address: address || null,
      phone: phone || null, email: email || null,
    }).eq('id', params.id).eq('company_id', ctx.profile.company_id).select().single();

    if (error) return ApiResponse.error(error.message);

    return ApiResponse.success({ supplier: data });
  } catch (err: any) {
    return ApiResponse.error(err?.message ?? 'Erro interno', 500);
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return ApiResponse.unauthorized();

  const admin = createAdminClient();
  const { error } = await admin.from('suppliers').delete()
    .eq('id', params.id).eq('company_id', ctx.profile.company_id);

  if (error) return ApiResponse.error(error.message);
  return ApiResponse.success({ message: 'Fornecedor eliminado' });
}
