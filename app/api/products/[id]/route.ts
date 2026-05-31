import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const admin = createAdminClient();
  const { data, error } = await admin.from('products')
    .select('*')
    .eq('id', params.id)
    .eq('company_id', ctx.profile.company_id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 });
  return NextResponse.json({ product: data });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const admin = createAdminClient();

  try {
    const body = await req.json();
    const { name, description, price, tax_rate, sku, track_stock, quantity_in_stock, stock_alert_threshold } = body ?? {};
    if (!name) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 });
    if (price == null || Number(price) < 0) return NextResponse.json({ error: 'Preço inválido' }, { status: 400 });

    const { data: existing } = await admin.from('products')
      .select('id, name').eq('id', params.id).eq('company_id', ctx.profile.company_id).maybeSingle();
    if (!existing) return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 });

    const update: any = {
      name,
      description: description ?? null,
      price: Number(price),
      tax_rate: Number(tax_rate ?? 14),
      sku: sku ?? null,
      track_stock: !!track_stock,
    };
    if (track_stock) {
      update.quantity_in_stock = Number(quantity_in_stock ?? 0);
      update.stock_alert_threshold = Number(stock_alert_threshold ?? 0);
    }

    const { data, error } = await admin.from('products').update(update)
      .eq('id', params.id).eq('company_id', ctx.profile.company_id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await admin.from('audit_logs').insert({
      user_id: ctx.user.id, company_id: ctx.profile.company_id,
      action: 'product.update', entity: 'product', entity_id: data.id,
      details: { before: existing.name, after: name },
    });
    return NextResponse.json({ product: data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Erro' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const admin = createAdminClient();

  const { data: existing } = await admin.from('products')
    .select('id, name').eq('id', params.id).eq('company_id', ctx.profile.company_id).maybeSingle();
  if (!existing) return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 });

  // Check if product is used in any invoice_items
  const { count: itemCount } = await admin.from('invoice_items')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', params.id);

  if ((itemCount ?? 0) > 0) {
    // Soft delete
    const { error } = await admin.from('products').update({ is_active: false })
      .eq('id', params.id).eq('company_id', ctx.profile.company_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await admin.from('audit_logs').insert({
      user_id: ctx.user.id, company_id: ctx.profile.company_id,
      action: 'product.archive', entity: 'product', entity_id: params.id,
      details: { name: existing.name, reason: `usado em ${itemCount} linha(s) de fatura`, soft: true },
    });
    return NextResponse.json({ success: true, archived: true, message: `Produto arquivado (usado em ${itemCount} fatura(s))` });
  }

  const { error } = await admin.from('products').delete()
    .eq('id', params.id).eq('company_id', ctx.profile.company_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await admin.from('audit_logs').insert({
    user_id: ctx.user.id, company_id: ctx.profile.company_id,
    action: 'product.delete', entity: 'product', entity_id: params.id,
    details: { name: existing.name },
  });
  return NextResponse.json({ success: true, archived: false });
}
