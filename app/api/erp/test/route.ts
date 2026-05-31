import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';
import { testOdooConnection } from '@/lib/erp/odoo';

export const dynamic = 'force-dynamic';

/**
 * POST /api/erp/test
 * Body: { provider, base_url, username, db_name, api_key? }
 * If api_key is omitted, uses the saved one.
 */
export async function POST(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.profile.role !== 'admin') return NextResponse.json({ error: 'Apenas administradores' }, { status: 403 });
  if (!ctx.profile.company_id) return NextResponse.json({ error: 'Sem empresa associada' }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const { provider, base_url, username, db_name } = body || {};
  let { api_key } = body || {};

  if (provider !== 'odoo') {
    return NextResponse.json({ error: 'Provider não suportado' }, { status: 400 });
  }

  if (!api_key) {
    const admin = createAdminClient();
    const { data } = await admin
      .from('erp_integrations')
      .select('api_key')
      .eq('company_id', ctx.profile.company_id)
      .eq('provider', provider)
      .maybeSingle();
    api_key = data?.api_key;
  }

  if (!base_url || !db_name || !username || !api_key) {
    return NextResponse.json({ error: 'Credenciais incompletas' }, { status: 400 });
  }

  const result = await testOdooConnection({ baseUrl: base_url, dbName: db_name, username, apiKey: api_key });
  return NextResponse.json(result);
}
