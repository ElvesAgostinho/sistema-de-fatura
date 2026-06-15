import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';
import { buildSaftInventoryXml } from '@/lib/saft-inventory';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const isSuperAdmin = ctx.profile.email === 'elvessacapuri57@gmail.com';
  if (ctx.profile.role !== 'admin' && !isSuperAdmin) {
    return NextResponse.json({ error: 'Apenas administradores podem exportar o SAF-T de Inventários' }, { status: 403 });
  }
  if (!ctx.profile.company_id) {
    return NextResponse.json({ error: 'Sem empresa associada' }, { status: 400 });
  }

  const url = new URL(req.url);
  const yearStr = url.searchParams.get('year') ?? String(new Date().getUTCFullYear());
  const year = parseInt(yearStr, 10);
  
  if (isNaN(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: 'Ano inválido' }, { status: 400 });
  }

  const admin = createAdminClient();
  const companyId = ctx.profile.company_id;

  // 1. Fetch Company
  const { data: company } = await admin
    .from('companies')
    .select('nif')
    .eq('id', companyId)
    .single();
    
  if (!company) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 });

  // 2. Fetch Products
  const { data: products } = await admin
    .from('products')
    .select('id, name, code, product_type, unit_of_measure, quantity_in_stock, price')
    .eq('company_id', companyId);

  // 3. Generate XML
  const xml = buildSaftInventoryXml(company, year, products || []);

  // 4. Log audit event
  await admin.from('audit_logs').insert({
    company_id: companyId,
    user_id: ctx.profile.id,
    action: 'EXPORT_SAFT_INVENTORY',
    resource_type: 'saft',
    resource_id: 'inventory',
    details: { year, itemsCount: (products || []).filter(p => (p.quantity_in_stock || 0) > 0).length }
  });

  return new NextResponse(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Content-Disposition': `attachment; filename="SAFT_AO_INVENTARIOS_${year}.xml"`,
      'Cache-Control': 'no-store'
    }
  });
}
