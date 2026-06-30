import { ApiResponse } from '@/lib/api-response';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';
import { getCachedOrFetch, redis } from '@/lib/redis';
import { CacheKeys, CacheTTL } from '@/lib/cache-keys';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return ApiResponse.unauthorized();

  const url = new URL(req.url);
  const includeInactive = url.searchParams.get('include_inactive') === '1';
  const search = url.searchParams.get('search') ?? '';
  const companyId = ctx.profile.company_id;
  const admin = createAdminClient();

  // Only cache the base list (no search, active-only)
  const useCache = !search && !includeInactive;
  const cacheKey = CacheKeys.productList(companyId);

  const fetchProducts = async () => {
    let q = admin
      .from('products')
      .select('id, name, description, price, tax_rate, sku, barcode, base_uom, image_url, track_stock, quantity_in_stock, stock_alert_threshold, is_active, created_at, product_type')
      .eq('company_id', companyId);

    if (!includeInactive) q = q.eq('is_active', true);
    if (search) {
      q = q.or(`name.ilike.%${search}%,sku.ilike.%${search}%`).limit(20);
    } else {
      q = q.order('created_at', { ascending: false }).limit(1000);
    }

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data ?? [];
  };

  try {
    const products = useCache
      ? await getCachedOrFetch(cacheKey, fetchProducts, CacheTTL.productList)
      : await fetchProducts();
    return ApiResponse.success({ products });
  } catch (err: any) {
    return ApiResponse.error(err?.message ?? 'Erro interno no servidor', 500);
  }
}

export async function POST(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return ApiResponse.unauthorized();

  try {
    const body = await req.json();
    const { name, description, price, tax_rate, sku, track_stock, quantity_in_stock, stock_alert_threshold, product_type, base_uom, purchase_uom, barcode, image_url, variants } = body ?? {};
    if (!name || price == null) return ApiResponse.error('Nome e preço obrigatórios');

    const p = Number(price);
    const t = Number(tax_rate ?? 14);
    if (!Number.isFinite(p) || p < 0) return ApiResponse.error('Preço inválido');

    const admin = createAdminClient();
    const payload: any = {
      company_id: ctx.profile.company_id,
      name, description: description ?? null, price: p, tax_rate: t,
      sku: sku ?? null,
      barcode: barcode ?? null,
      image_url: image_url ?? null,
      base_uom: base_uom ?? 'un',
      purchase_uom: purchase_uom ?? null,
      product_type: product_type === 'S' ? 'S' : 'P',
      track_stock: product_type === 'S' ? false : !!track_stock,
      is_active: true,
    };
    if (payload.track_stock) {
      payload.quantity_in_stock = Number(quantity_in_stock ?? 0);
      payload.stock_alert_threshold = Number(stock_alert_threshold ?? 0);
    }

    const { data, error } = await admin.from('products').insert(payload).select().single();
    if (error) return ApiResponse.error(error.message);

    // Se existirem variantes no payload, insere-as
    if (variants && Array.isArray(variants) && variants.length > 0) {
      const vPayload = variants.map(v => ({
        product_id: data.id,
        name: v.name,
        sku: v.sku,
        barcode: v.barcode,
        price_adjustment: Number(v.price_adjustment ?? 0)
      }));
      await admin.from('product_variants').insert(vPayload);
    }

    // Invalidate product list cache so next GET reflects the new product immediately
    if (redis) {
      await redis.del(CacheKeys.productList(ctx.profile.company_id)).catch(() => {});
    }

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
