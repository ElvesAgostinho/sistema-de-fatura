import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';
import {
  ensureFiscalConfig,
  validateReadyForCertification,
  getFiscalConfig,
  certificationBadge,
} from '@/lib/fiscal-config';

export const dynamic = 'force-dynamic';

// Fields the admin is allowed to edit BEFORE certification.
// saft_modo is editable at all times (run SAF-T in 'teste' even after cert).
// After cert: mode / numero / data / chaves are immutable at the DB level.
const EDITABLE_KEYS = ['agt_certificado_numero', 'agt_data_certificacao', 'chave_privada', 'chave_publica', 'saft_modo', 'default_retention_rate', 'default_tax_exemption_reason'] as const;

export async function GET() {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const isSuperAdmin = ctx.profile.email === 'elvessacapuri57@gmail.com';
  if (ctx.profile.role !== 'admin' && !isSuperAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const cfg = await ensureFiscalConfig();
  const readiness = validateReadyForCertification(cfg);
  const badge = certificationBadge(cfg);

  // Never leak the private key back to the client. Only show a masked indicator.
  const safe = {
    ...cfg,
    chave_privada: cfg.chave_privada ? '•••••••• (gravada)' : null,
    has_private_key: Boolean(cfg.chave_privada),
    has_public_key: Boolean(cfg.chave_publica),
  };
  return NextResponse.json({ config: safe, readiness, badge });
}

export async function PUT(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const isSuperAdmin = ctx.profile.email === 'elvessacapuri57@gmail.com';
  if (ctx.profile.role !== 'admin' && !isSuperAdmin) return NextResponse.json({ error: 'Apenas administradores podem editar a configuração fiscal' }, { status: 403 });

  const cfg = await ensureFiscalConfig();
  if (cfg.mode === 'certificado') {
    // Allow saft_modo toggling only
    const body = await req.json().catch(() => ({}));
    const updates: Record<string, any> = {};
    if (typeof body.saft_modo === 'string' && ['teste', 'oficial'].includes(body.saft_modo)) {
      updates.saft_modo = body.saft_modo;
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Sistema certificado: apenas saft_modo é editável' }, { status: 400 });
    }
    const admin = createAdminClient();
    const { data, error } = await admin.from('fiscal_config').update(updates).eq('id', cfg.id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await admin.from('audit_logs').insert({
      user_id: ctx.user.id, company_id: ctx.profile.company_id,
      action: 'fiscal_config.update', entity: 'fiscal_config', entity_id: cfg.id,
      details: { locked_post_cert: true, updates },
    });
    return NextResponse.json({ config: data });
  }

  const body = await req.json().catch(() => ({}));
  const updates: Record<string, any> = {};
  for (const k of EDITABLE_KEYS) {
    if (body[k] !== undefined) {
      // Allow explicit clearing only for the text/date fields, never for keys
      if (body[k] === null || body[k] === '') {
        if (k === 'chave_privada' || k === 'chave_publica') continue; // don't accidentally erase keys
        updates[k] = null;
      } else {
        if (k === 'default_retention_rate') {
          updates[k] = parseFloat(body[k]);
        } else {
          updates[k] = String(body[k]);
        }
      }
    }
  }
  // Auto-progress to pre_certificacao once the admin has started populating data
  const merged = { ...cfg, ...updates };
  const hasData =
    merged.agt_certificado_numero ||
    merged.agt_data_certificacao ||
    merged.chave_privada ||
    merged.chave_publica;
  if (cfg.mode === 'development' && hasData) {
    updates.mode = 'pre_certificacao';
  }
  // Guard: cannot manually set mode to 'certificado' via this endpoint
  if ('mode' in body && body.mode === 'certificado') {
    return NextResponse.json({ error: 'Ativação do modo certificado só é permitida via /api/fiscal-config/activate' }, { status: 400 });
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nenhuma alteração enviada' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.from('fiscal_config').update(updates).eq('id', cfg.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Log with redacted keys
  const redacted: Record<string, any> = { ...updates };
  if (redacted.chave_privada) redacted.chave_privada = '***redacted***';
  if (redacted.chave_publica) redacted.chave_publica = '***redacted***';
  await admin.from('audit_logs').insert({
    user_id: ctx.user.id, company_id: ctx.profile.company_id,
    action: 'fiscal_config.update', entity: 'fiscal_config', entity_id: cfg.id,
    details: { updates: redacted },
  });

  // Return sanitized view
  const safe = { ...data, chave_privada: data?.chave_privada ? '•••••••• (gravada)' : null, has_private_key: Boolean(data?.chave_privada), has_public_key: Boolean(data?.chave_publica) };
  return NextResponse.json({ config: safe });
}
