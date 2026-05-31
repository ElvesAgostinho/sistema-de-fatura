import { ApiResponse } from '@/lib/api-response';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return ApiResponse.unauthorized();

  const url = new URL(req.url);
  const search = url.searchParams.get('search') ?? '';
  const supplierId = url.searchParams.get('supplier_id');
  const dateFrom = url.searchParams.get('date_from');
  const dateTo = url.searchParams.get('date_to');
  const page = Math.max(parseInt(url.searchParams.get('page') ?? '1'), 1);
  const pageSize = Math.min(parseInt(url.searchParams.get('page_size') ?? '20'), 100);

  const admin = createAdminClient();
  let query = admin
    .from('purchases')
    .select('id, purchase_number, total, status, issued_at, attachment_path, supplier:suppliers(name, nif)', { count: 'exact' })
    .eq('company_id', ctx.profile.company_id);

  if (supplierId) query = query.eq('supplier_id', supplierId);
  if (search) query = query.ilike('purchase_number', `%${search}%`);
  if (dateFrom) query = query.gte('issued_at', dateFrom);
  if (dateTo) query = query.lte('issued_at', dateTo);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.order('issued_at', { ascending: false }).range(from, to);

  const { data, error, count } = await query;
  if (error) return ApiResponse.error(error.message, 500);

  return ApiResponse.success({ purchases: data ?? [], total: count ?? 0, page, pageSize });
}

export async function POST(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return ApiResponse.unauthorized();
  const companyId = ctx.profile.company_id;

  try {
    const body = await req.json();
    const { supplier_id, items, purchase_number, issued_at, notes, attachment_path } = body ?? {};

    if (!supplier_id) return ApiResponse.error('Fornecedor obrigatório');
    if (!purchase_number) return ApiResponse.error('Número da fatura do fornecedor obrigatório');
    if (!Array.isArray(items) || items.length === 0) return ApiResponse.error('Adicione pelo menos um item');

    const admin = createAdminClient();

    // Fetch supplier
    const { data: supplier } = await admin.from('suppliers').select('*').eq('id', supplier_id).eq('company_id', companyId).maybeSingle();
    if (!supplier) return ApiResponse.error('Fornecedor não encontrado', 404);

    // Compute totals
    let subtotal = 0, tax = 0, total = 0;
    const cleanItems: any[] = [];
    for (const it of items) {
      const qty = Number(it?.quantity);
      const price = Number(it?.price);
      const rate = Number(it?.tax_rate ?? 14);
      const desc = String(it?.description ?? '').trim();
      
      if (!desc) return ApiResponse.error('Descrição do item em falta');
      if (!Number.isFinite(qty) || qty <= 0) return ApiResponse.error('Quantidade inválida');
      if (!Number.isFinite(price) || price < 0) return ApiResponse.error('Preço inválido');

      const lineSubtotal = +(qty * price).toFixed(2);
      const lineTax = +(lineSubtotal * (rate / 100)).toFixed(2);
      const lineTotal = +(lineSubtotal + lineTax).toFixed(2);
      subtotal += lineSubtotal; tax += lineTax; total += lineTotal;
      
      cleanItems.push({ 
        description: desc, 
        quantity: qty, 
        price, 
        tax_rate: rate, 
        total: lineTotal,
        product_id: it?.product_id ?? null
      });
    }
    subtotal = +subtotal.toFixed(2); tax = +tax.toFixed(2); total = +total.toFixed(2);

    // 1. Optimized Data Fetching
    const productIds = cleanItems.map(it => it.product_id).filter(Boolean);
    const { data: products } = productIds.length > 0 
      ? await admin.from('products').select('id, quantity_in_stock, track_stock').in('id', productIds)
      : { data: [] };
    const productMap = new Map((products || []).map(p => [p.id, p]));

    const { data: purchase, error: pErr } = await admin.from('purchases').insert({
      company_id: companyId,
      supplier_id,
      purchase_number,
      subtotal,
      tax,
      total,
      status: 'completed',
      issued_at: issued_at || new Date().toISOString(),
      notes: notes || null,
      attachment_path: attachment_path || null
    }).select().single();

    if (pErr) return ApiResponse.error(pErr.message);

    // 2. Batch Persistence
    const itemsToInsert = cleanItems.map((c) => ({ ...c, purchase_id: purchase.id }));
    const stockMovements: any[] = [];
    const stockUpdatePromises: Promise<any>[] = [];

    for (const item of cleanItems) {
      const p = item.product_id ? productMap.get(item.product_id) : null;
      if (p && p.track_stock) {
        const newBalance = Number(p.quantity_in_stock ?? 0) + Number(item.quantity);
        stockUpdatePromises.push(admin.from('products').update({ quantity_in_stock: newBalance }).eq('id', p.id));
        stockMovements.push({
          company_id: companyId, product_id: p.id, purchase_id: purchase.id,
          movement_type: 'compra', quantity: item.quantity, balance_after: newBalance,
          notes: `Compra via ${purchase_number}`,
        });
      }
    }

    await Promise.all([
      admin.from('purchase_items').insert(itemsToInsert),
      ...stockUpdatePromises,
      stockMovements.length > 0 ? admin.from('stock_movements').insert(stockMovements) : Promise.resolve(),
    ]);

    // 3. Async Audit
    admin.from('audit_logs').insert({
      user_id: ctx.user.id, company_id: companyId,
      action: 'purchase.create', entity: 'purchase', entity_id: purchase.id,
      details: { purchase_number, total, supplier_nif: supplier.nif },
    }).then(({ error }) => { if (error) console.error('Audit failed', error); });

    return ApiResponse.success({ purchase });
  } catch (err: any) {
    return ApiResponse.error(err?.message ?? 'Erro interno no servidor', 500);
  }
}
