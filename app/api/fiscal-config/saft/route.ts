import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';
import { buildSaftXml } from '@/lib/saft';
import { validateSaftInput } from '@/lib/saft-validator';

export const dynamic = 'force-dynamic';

/**
 * GET /api/fiscal-config/saft?from=YYYY-MM-DD&to=YYYY-MM-DD
 *   &validate=1  -> returns a JSON pre-export validation report
 *   (no query)   -> returns the XML file
 *
 * Admin-only. Writes an audit log entry on successful export.
 * v2: Inclui city, postal_code, country, product_type, unit_of_measure,
 *     tax_exemption_reason e suppliers no payload SAF-T.
 */
export async function GET(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const isSuperAdmin = ctx.profile.email === 'elvessacapuri57@gmail.com';
  if (ctx.profile.role !== 'admin' && !isSuperAdmin) {
    return NextResponse.json({ error: 'Apenas administradores podem exportar SAF-T' }, { status: 403 });
  }
  if (!ctx.profile.company_id) {
    return NextResponse.json({ error: 'Sem empresa associada' }, { status: 400 });
  }

  const url = new URL(req.url);
  const now = new Date();
  const from = url.searchParams.get('from') ?? `${now.getUTCFullYear()}-01-01`;
  const to   = url.searchParams.get('to')   ?? `${now.getUTCFullYear()}-12-31`;
  const validateOnly = url.searchParams.get('validate') === '1';

  const fromDate = new Date(from + 'T00:00:00Z');
  const toDate   = new Date(to   + 'T23:59:59Z');
  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return NextResponse.json({ error: 'Datas inválidas' }, { status: 400 });
  }

  const admin = createAdminClient();
  const companyId = ctx.profile.company_id;

  // ── Fetch company (incluindo city, postal_code, business_name) ──
  const { data: company } = await admin
    .from('companies')
    .select('id, nif, name, address, phone, email, city, postal_code, business_name')
    .eq('id', companyId)
    .single();
  if (!company) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 });

  // ── Fiscal config ──
  const { data: fc } = await admin
    .from('fiscal_config')
    .select('saft_modo, agt_certificado_numero, mode')
    .eq('company_id', companyId)
    .maybeSingle();

  // ── Invoices (com todos os campos necessários para SAF-T) ──
  const { data: invoices } = await admin
    .from('invoices')
    .select(`
      invoice_number, document_type, issued_at, status,
      cancellation_reason, cancelled_at,
      subtotal, tax, total,
      hash, previous_hash, signature,
      client_nif, client_name, related_document,
      tax_exempt, tax_exemption_reason,
      items:invoice_items(
        description, quantity, price, tax_rate, total,
        tax_exemption_reason, unit_of_measure
      )
    `)
    .eq('company_id', companyId)
    .gte('issued_at', fromDate.toISOString())
    .lte('issued_at', toDate.toISOString())
    .order('issued_at', { ascending: true });

  // ── Clients (incluindo city, postal_code, country) ──
  const { data: clients } = await admin
    .from('clients')
    .select('id, name, nif, address, email, phone, city, postal_code, country')
    .eq('company_id', companyId);

  // ── Products (incluindo product_type) ──
  const { data: products } = await admin
    .from('products')
    .select('id, name, description, price, tax_rate, product_type')
    .eq('company_id', companyId);

  // ── Suppliers (para secção <Supplier> no MasterFiles) ──
  const { data: suppliers } = await admin
    .from('suppliers')
    .select('id, name, nif, address, email, phone, city, postal_code')
    .eq('company_id', companyId);

  const saftPayload = {
    company: {
      ...company,
      city: company.city ?? 'Luanda',
      postal_code: company.postal_code ?? 'N/A',
      business_name: company.business_name ?? null,
    },
    period: { from: fromDate, to: toDate },
    clients: (clients ?? []).map((c: any) => ({
      ...c,
      city: c.city ?? null,
      postal_code: c.postal_code ?? null,
      country: c.country ?? 'AO',
    })),
    products: (products ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      unit_price: p.price,
      tax_rate: p.tax_rate,
      product_type: p.product_type ?? 'S',
    })),
    invoices: (invoices ?? []).map((inv: any) => ({
      ...inv,
      items: (inv.items ?? []).map((it: any) => ({
        ...it,
        unit_of_measure: it.unit_of_measure ?? 'UN',
        tax_exemption_reason: it.tax_exemption_reason ?? null,
      })),
    })),
    suppliers: (suppliers ?? []).map((s: any) => ({
      id: s.id,
      name: s.name,
      nif: s.nif ?? null,
      address: s.address ?? null,
      email: s.email ?? null,
      phone: s.phone ?? null,
      city: s.city ?? null,
      postal_code: s.postal_code ?? null,
    })),
    saftMode: fc?.saft_modo ?? 'producao',
    certificateNumber: fc?.agt_certificado_numero ?? 0,
    businessName: company.business_name ?? company.name,
  };

  const report = validateSaftInput(saftPayload as any);

  if (validateOnly) {
    return NextResponse.json({
      report,
      period: { from, to },
      company: { nif: company.nif, name: company.name },
      mode: fc?.mode ?? 'pre_certificacao',
      saftMode: fc?.saft_modo ?? 'producao',
      certificateNumber: fc?.agt_certificado_numero ?? 0,
    });
  }

  // Block export if non-remediable errors exist
  if (report.level === 'NAO_APTO') {
    return NextResponse.json({
      error: 'SAF-T não apto para auditoria — corrija os erros antes de exportar.',
      report,
    }, { status: 422 });
  }

  const xml = buildSaftXml(saftPayload as any);

  // Audit log
  void admin.from('audit_logs').insert({
    user_id: ctx.profile.id,
    company_id: companyId,
    action: 'saft.export',
    entity: 'fiscal_config',
    entity_id: companyId,
    details: {
      from, to,
      level: report.level,
      errors: report.errors,
      warnings: report.warnings,
      invoices: (invoices ?? []).length,
      clients: (clients ?? []).length,
      products: (products ?? []).length,
      suppliers: (suppliers ?? []).length,
    },
  });

  const filename = `SAFT_AO_${company.nif}_${from}_${to}.xml`;
  return new NextResponse(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'X-SAFT-Level': report.level,
      'X-SAFT-Errors': String(report.errors),
      'X-SAFT-Warnings': String(report.warnings),
      'Cache-Control': 'no-store',
    },
  });
}
