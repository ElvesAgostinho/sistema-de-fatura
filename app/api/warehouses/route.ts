import { ApiResponse } from '@/lib/api-response';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return ApiResponse.unauthorized();

  const companyId = ctx.profile.company_id;
  const admin = createAdminClient();

  try {
    const { data, error } = await admin
      .from('warehouses')
      .select('*')
      .eq('company_id', companyId)
      .order('is_default', { ascending: false })
      .order('name', { ascending: true });

    if (error) throw new Error(error.message);
    return ApiResponse.success({ warehouses: data ?? [] });
  } catch (err: any) {
    return ApiResponse.error(err?.message ?? 'Erro interno no servidor', 500);
  }
}
