import { ApiResponse } from '@/lib/api-response';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return ApiResponse.unauthorized();

  const url = new URL(req.url);
  const includeInactive = url.searchParams.get('include_inactive') === '1';
  const search = url.searchParams.get('search') ?? '';

  const admin = createAdminClient();
  let q = admin
    .from('products')
    .select('id, name, description, price, tax_rate, sku, track_stock, quantity_in_stock, stock_alert_threshold, is_active, created_at')
    .eq('company_id', ctx.profile.company_id);

  if (!includeInactive) q = q.eq('is_active', true);
  if (search) {
    q = q.or(`name.ilike.%${search}%,sku.ilike.%${search}%`).limit(20);
  } else {
    q = q.order('created_at', { ascending: false }).limit(1000);
  }

  const { data, error } = await q;
  if (error) return ApiResponse.error(error.message, 500);
  return ApiResponse.success({ products: data ?? [] });
}

export async function POST(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return ApiResponse.unauthorized();

  try {
    const body = await req.json();
    const { name, description, price, tax_rate, sku, track_stock, quantity_in_stock, stock_alert_threshold } = body ?? {};
    if (!name || price == null) return ApiResponse.error('Nome e preço obrigatórios');
    
    const p = Number(price); 
    const t = Number(tax_rate ?? 14);
    if (!Number.isFinite(p) || p < 0) return ApiResponse.error('Preço inválido');

    const admin = createAdminClient();
    const payload: any = {
      company_id: ctx.profile.company_id,
      name, description: description ?? null, price: p, tax_rate: t,
      sku: sku ?? null,
      track_stock: !!track_stock,
      is_active: true,
    };
    if (track_stock) {
      payload.quantity_in_stock = Number(quantity_in_stock ?? 0);
      payload.stock_alert_threshold = Number(stock_alert_threshold ?? 0);
    }
    const { data, error } = await admin.from('products').insert(payload).select().single();
    if (error) return ApiResponse.error(error.message);

    await admin.from('audit_logs').insert({
      user_id: ctx.user.id, company_id: ctx.profile.company_id,
      action: 'product.create', entity: 'product', entity_id: data.id,
      details: { name, price: p },
    });
    return ApiResponse.success({ product: data });
  } catch (err: any) {
    return ApiResponse.error(err?.message ?? 'Erro interno no servidor', 500);
  }
}
