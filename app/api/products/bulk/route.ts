import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  try {
    const { products } = await req.json();
    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ error: 'Nenhum produto fornecido' }, { status: 400 });
    }

    const admin = createAdminClient();
    const companyId = ctx.profile.company_id;

    // Validate and prepare
    const toInsert = products.map(p => ({
      company_id: companyId,
      name: String(p.name || '').trim(),
      reference: p.reference ? String(p.reference).trim() : null,
      price: Number(p.price) || 0,
      tax_rate: Number(p.tax_rate) || 14,
      tax_exempt: !!p.tax_exempt,
      tax_exemption_reason: p.tax_exempt ? String(p.tax_exemption_reason || '').trim() : null,
      is_active: true,
      track_stock: !!p.track_stock,
      quantity_in_stock: Number(p.quantity_in_stock) || 0,
      min_stock_level: Number(p.min_stock_level) || 0
    })).filter(p => p.name.length > 0 && p.price >= 0);

    if (toInsert.length === 0) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
    }

    const { data, error } = await admin.from('products').insert(toInsert).select('id');
    if (error) throw error;

    await admin.from('audit_logs').insert({
      user_id: ctx.user.id,
      company_id: companyId,
      action: 'product.bulk_import',
      entity: 'product',
      details: { count: toInsert.length }
    });

    return NextResponse.json({ success: true, count: toInsert.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao importar' }, { status: 500 });
  }
}
