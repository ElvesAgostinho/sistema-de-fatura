import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (ctx.profile.role !== 'admin') return { error: NextResponse.json({ error: 'Apenas administradores' }, { status: 403 }) };
  if (!ctx.profile.company_id) return { error: NextResponse.json({ error: 'Sem empresa associada' }, { status: 400 }) };
  return { ctx };
}

/** GET /api/erp - List integrations for the current company. */
export async function GET() {
  const { ctx, error } = await requireAdmin();
  if (error) return error;
  const admin = createAdminClient();
  const { data, error: err } = await admin
    .from('erp_integrations')
    .select('id, provider, base_url, username, db_name, status, last_sync_at, last_sync_status, last_sync_error, config, created_at, updated_at')
    .eq('company_id', ctx!.profile.company_id);
  if (err) return NextResponse.json({ error: err.message }, { status: 500 });
  // Never expose api_key in responses
  return NextResponse.json({ integrations: data ?? [] });
}

/** POST /api/erp - Create or update the ERP integration for a provider. */
export async function POST(req: Request) {
  const { ctx, error } = await requireAdmin();
  if (error) return error;
  const body = await req.json().catch(() => ({}));
  const { provider, base_url, username, db_name, api_key, status, config } = body || {};
  if (!provider || typeof provider !== 'string') {
    return NextResponse.json({ error: 'Provider em falta' }, { status: 400 });
  }
  if (provider !== 'odoo') {
    return NextResponse.json({ error: 'Provider não suportado' }, { status: 400 });
  }
  const admin = createAdminClient();

  // Upsert - find existing by company+provider
  const { data: existing } = await admin
    .from('erp_integrations')
    .select('id, api_key')
    .eq('company_id', ctx!.profile.company_id)
    .eq('provider', provider)
    .maybeSingle();

  const payload: any = {
    company_id: ctx!.profile.company_id,
    provider,
    base_url: base_url || null,
    username: username || null,
    db_name: db_name || null,
    status: status || 'inactive',
    config: config || {},
    updated_at: new Date().toISOString(),
  };
  // Only overwrite api_key if provided (so partial updates don't wipe it)
  if (api_key) payload.api_key = api_key;

  if (existing) {
    const { data, error: err } = await admin
      .from('erp_integrations')
      .update(payload)
      .eq('id', existing.id)
      .select('id, provider, base_url, username, db_name, status, last_sync_at, last_sync_status, last_sync_error, config, created_at, updated_at')
      .single();
    if (err) return NextResponse.json({ error: err.message }, { status: 500 });
    await admin.from('audit_logs').insert({
      user_id: ctx!.profile.id, company_id: ctx!.profile.company_id,
      action: 'erp.update', entity: 'erp_integration', entity_id: existing.id, details: { provider },
    });
    return NextResponse.json({ integration: data });
  } else {
    if (!payload.api_key) {
      return NextResponse.json({ error: 'API key obrigatória na primeira configuração' }, { status: 400 });
    }
    const { data, error: err } = await admin
      .from('erp_integrations')
      .insert(payload)
      .select('id, provider, base_url, username, db_name, status, last_sync_at, last_sync_status, last_sync_error, config, created_at, updated_at')
      .single();
    if (err) return NextResponse.json({ error: err.message }, { status: 500 });
    await admin.from('audit_logs').insert({
      user_id: ctx!.profile.id, company_id: ctx!.profile.company_id,
      action: 'erp.create', entity: 'erp_integration', entity_id: data.id, details: { provider },
    });
    return NextResponse.json({ integration: data });
  }
}

/** DELETE /api/erp?id=... - Remove an integration. */
export async function DELETE(req: Request) {
  const { ctx, error } = await requireAdmin();
  if (error) return error;
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID em falta' }, { status: 400 });
  const admin = createAdminClient();
  const { error: err } = await admin
    .from('erp_integrations')
    .delete()
    .eq('id', id)
    .eq('company_id', ctx!.profile.company_id);
  if (err) return NextResponse.json({ error: err.message }, { status: 500 });
  await admin.from('audit_logs').insert({
    user_id: ctx!.profile.id, company_id: ctx!.profile.company_id,
    action: 'erp.delete', entity: 'erp_integration', entity_id: id,
  });
  return NextResponse.json({ success: true });
}
