import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';
import { ApiResponse } from '@/lib/api-response';
import { getCachedOrFetch, redis } from '@/lib/redis';
import { CacheKeys, CacheTTL } from '@/lib/cache-keys';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const search = url.searchParams.get('search') ?? '';
  const includeInactive = url.searchParams.get('include_inactive') === '1';
  const companyId = ctx.profile.company_id;
  const admin = createAdminClient();

  // Only cache the base list (no search, active-only) — avoids stale search results
  const useCache = !search && !includeInactive;
  const cacheKey = CacheKeys.clientList(companyId);

  const fetchClients = async () => {
    let query = admin
      .from('clients')
      .select('id, name, nif, address, phone, email, is_active, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(1000);
    if (!includeInactive) query = query.eq('is_active', true);
    if (search) query = query.or(`name.ilike.%${search}%,nif.ilike.%${search}%,email.ilike.%${search}%`);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data ?? [];
  };

  try {
    const clients = useCache
      ? await getCachedOrFetch(cacheKey, fetchClients, CacheTTL.clientList)
      : await fetchClients();
    return ApiResponse.success({ clients });
  } catch (err: any) {
    console.error('[API CLIENTS]', err);
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

    // Invalidate client list cache so next GET reflects the new client immediately
    if (redis) {
      await redis.del(CacheKeys.clientList(ctx.profile.company_id)).catch(() => {});
    }

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
