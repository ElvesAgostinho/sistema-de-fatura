import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';
import { pushClientsToOdoo, pushProductsToOdoo, pushInvoicesToOdoo } from '@/lib/erp/odoo';

export const dynamic = 'force-dynamic';

/**
 * POST /api/erp/sync
 * Body: { integration_id, entity: 'clients' | 'products' | 'invoices' | 'all' }
 */
export async function POST(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.profile.role !== 'admin') return NextResponse.json({ error: 'Apenas administradores' }, { status: 403 });
  if (!ctx.profile.company_id) return NextResponse.json({ error: 'Sem empresa associada' }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const { integration_id, entity } = body || {};
  if (!integration_id || !entity) {
    return NextResponse.json({ error: 'Parâmetros em falta' }, { status: 400 });
  }
  if (!['clients', 'products', 'invoices', 'all'].includes(entity)) {
    return NextResponse.json({ error: 'Entidade inválida' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: integration } = await admin
    .from('erp_integrations')
    .select('*')
    .eq('id', integration_id)
    .eq('company_id', ctx.profile.company_id)
    .maybeSingle();
  if (!integration) return NextResponse.json({ error: 'Integração não encontrada' }, { status: 404 });
  if (integration.provider !== 'odoo') {
    return NextResponse.json({ error: 'Provider não suportado' }, { status: 400 });
  }

  const creds = {
    baseUrl: integration.base_url,
    dbName: integration.db_name,
    username: integration.username,
    apiKey: integration.api_key,
  };

  const results: any = {};
  const errors: string[] = [];
  const targets = entity === 'all' ? ['clients', 'products', 'invoices'] : [entity];

  try {
    if (targets.includes('clients')) {
      const { data: clients } = await admin
        .from('clients')
        .select('id, name, nif, email, phone, address')
        .eq('company_id', ctx.profile.company_id);
      results.clients = await pushClientsToOdoo(creds, clients ?? []);
      errors.push(...results.clients.errors.map((e: string) => `Clientes: ${e}`));
    }
    if (targets.includes('products')) {
      const { data: products } = await admin
        .from('products')
        .select('id, name, description, price, tax_rate')
        .eq('company_id', ctx.profile.company_id);
      results.products = await pushProductsToOdoo(creds, (products ?? []).map((p: any) => ({
        id: p.id, name: p.name, description: p.description,
        price: Number(p.price ?? 0), tax_rate: Number(p.tax_rate ?? 14),
      })));
      errors.push(...results.products.errors.map((e: string) => `Produtos: ${e}`));
    }
    if (targets.includes('invoices')) {
      const { data: invoices } = await admin
        .from('invoices')
        .select('id, invoice_number, document_type, issued_at, status, subtotal, tax, total, client_nif, client_name, items:invoice_items(description, quantity, price, tax_rate, total)')
        .eq('company_id', ctx.profile.company_id)
        .eq('status', 'issued')
        .order('issued_at', { ascending: true });
      results.invoices = await pushInvoicesToOdoo(creds, (invoices ?? []).map((inv: any) => ({
        id: inv.id,
        invoice_number: inv.invoice_number,
        document_type: inv.document_type || 'FT',
        issued_at: inv.issued_at,
        subtotal: Number(inv.subtotal ?? 0),
        tax: Number(inv.tax ?? 0),
        total: Number(inv.total ?? 0),
        status: inv.status,
        client_nif: inv.client_nif,
        client_name: inv.client_name,
        items: (inv.items ?? []).map((it: any) => ({
          description: it.description,
          quantity: Number(it.quantity ?? 1),
          price: Number(it.price ?? 0),
          tax_rate: Number(it.tax_rate ?? 14),
          total: Number(it.total ?? 0),
        })),
      })));
      errors.push(...results.invoices.errors.map((e: string) => `Faturas: ${e}`));
    }

    const ok = errors.length === 0;
    await admin.from('erp_integrations').update({
      last_sync_at: new Date().toISOString(),
      last_sync_status: ok ? 'success' : 'partial',
      last_sync_error: errors.slice(0, 5).join('; ') || null,
    }).eq('id', integration.id);

    await admin.from('erp_sync_log').insert({
      integration_id: integration.id,
      company_id: ctx.profile.company_id,
      direction: 'push',
      entity,
      status: ok ? 'success' : 'partial',
      message: errors.slice(0, 3).join('; ') || null,
      payload: results,
    });

    await admin.from('audit_logs').insert({
      user_id: ctx.profile.id,
      company_id: ctx.profile.company_id,
      action: 'erp.sync',
      entity: 'erp_integration',
      entity_id: integration.id,
      details: { entity, results: Object.keys(results).reduce((a: any, k) => {
        a[k] = { created: results[k].created, updated: results[k].updated, skipped: results[k].skipped, errorCount: results[k].errors.length };
        return a;
      }, {}) },
    });

    return NextResponse.json({ ok, results, errors });
  } catch (err: any) {
    const msg = err?.message || String(err);
    await admin.from('erp_integrations').update({
      last_sync_at: new Date().toISOString(),
      last_sync_status: 'error',
      last_sync_error: msg,
    }).eq('id', integration.id);
    await admin.from('erp_sync_log').insert({
      integration_id: integration.id,
      company_id: ctx.profile.company_id,
      direction: 'push',
      entity,
      status: 'error',
      message: msg,
    });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
