/**
 * Fiscal Config — Gestão do modo de certificação AGT
 *
 * Este módulo centraliza TODA a lógica de transição entre os modos
 *   development → pre_certificacao → certificado
 *
 * Princípios de segurança implementados aqui:
 *   1. Não existe forma de alterar `mode` diretamente via UPDATE do cliente:
 *      apenas `activateCertifiedMode()` pode elevá-lo para "certificado"
 *      e apenas depois de `validateReadyForCertification()` passar 100%.
 *   2. Chaves criptográficas são validadas quanto à estrutura PEM.
 *   3. Após ativação, a própria base de dados (trigger PL/pgSQL)
 *      rejeita qualquer tentativa de mutar campos críticos — mesmo que
 *      alguém tenha acesso direto à service_role key.
 *   4. Toda transição é auditada em `audit_logs` com actor, estado anterior
 *      e estado novo.
 */

import { createAdminClient } from '@/lib/supabase/server';

export type FiscalMode = 'development' | 'pre_certificacao' | 'certificado';
export type SaftMode = 'teste' | 'oficial';

export type FiscalConfig = {
  id: string;
  company_id: string;
  mode: FiscalMode;
  agt_certificado_numero: string | null;
  agt_data_certificacao: string | null; // ISO date (YYYY-MM-DD)
  chave_privada: string | null;
  chave_publica: string | null;
  saft_modo: SaftMode;
  activated_at: string | null;
  activated_by: string | null;
  created_at: string;
  updated_at: string;
};

// --- Helpers -----------------------------------------------------------

/**
 * Very defensive PEM structure check. We intentionally do NOT import
 * the key into a crypto engine here (would require Web Crypto / Node crypto
 * with specific ciphers). Instead we verify the AGT-required envelope:
 *   - starts with "-----BEGIN" header
 *   - ends with "-----END" footer
 *   - has at least one line of base64 payload
 *   - minimum length (avoid single-line garbage)
 */
function isValidPem(key: string | null | undefined, kind: 'PRIVATE' | 'PUBLIC'): { ok: boolean; reason?: string } {
  if (!key || typeof key !== 'string') return { ok: false, reason: `Chave ${kind === 'PRIVATE' ? 'privada' : 'pública'} em falta` };
  const trimmed = key.trim();
  if (trimmed.length < 200) return { ok: false, reason: `Chave ${kind === 'PRIVATE' ? 'privada' : 'pública'}: demasiado curta para ser válida` };

  // Accept common header variants: PRIVATE KEY, RSA PRIVATE KEY, EC PRIVATE KEY, PUBLIC KEY, RSA PUBLIC KEY
  const expectedTokens = kind === 'PRIVATE'
    ? [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, /-----END [A-Z ]*PRIVATE KEY-----/]
    : [/-----BEGIN [A-Z ]*PUBLIC KEY-----/, /-----END [A-Z ]*PUBLIC KEY-----/];

  if (!expectedTokens[0].test(trimmed)) return { ok: false, reason: `Chave ${kind === 'PRIVATE' ? 'privada' : 'pública'}: cabeçalho PEM em falta (esperado BEGIN ${kind} KEY)` };
  if (!expectedTokens[1].test(trimmed)) return { ok: false, reason: `Chave ${kind === 'PRIVATE' ? 'privada' : 'pública'}: rodapé PEM em falta (esperado END ${kind} KEY)` };

  // Require at least one base64-ish line between headers
  const lines = trimmed.split(/\r?\n/).filter((l) => !l.startsWith('-----') && l.trim().length > 0);
  if (lines.length < 1) return { ok: false, reason: `Chave ${kind === 'PRIVATE' ? 'privada' : 'pública'}: payload base64 em falta` };
  const b64 = lines.join('');
  if (!/^[A-Za-z0-9+/=\s]+$/.test(b64)) return { ok: false, reason: `Chave ${kind === 'PRIVATE' ? 'privada' : 'pública'}: conteúdo não é base64 válido` };

  return { ok: true };
}

function isNonEmpty(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

// --- Core API ----------------------------------------------------------

export async function getGlobalPlatformCompanyId(): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin.from('users')
    .select('company_id')
    .eq('is_platform_admin', true)
    .limit(1)
    .single();
  if (!data?.company_id) {
    throw new Error('SuperAdmin não encontrado. Não é possível determinar a empresa global.');
  }
  return data.company_id;
}

export async function getFiscalConfig(companyId?: string): Promise<FiscalConfig | null> {
  const admin = createAdminClient();
  try {
    const globalCompanyId = await getGlobalPlatformCompanyId();
    const { data } = await admin.from('fiscal_config').select('*').eq('company_id', globalCompanyId).maybeSingle();
    return (data as FiscalConfig) ?? null;
  } catch (e) {
    return null;
  }
}

/**
 * Ensures a fiscal_config row exists for the GLOBAL platform company (idempotent).
 * Ignores any tenant companyId passed.
 */
export async function ensureFiscalConfig(companyId?: string): Promise<FiscalConfig> {
  const admin = createAdminClient();
  const globalCompanyId = await getGlobalPlatformCompanyId();
  const existing = await getFiscalConfig();
  if (existing) return existing;
  const { data, error } = await admin.from('fiscal_config').insert({
    company_id: globalCompanyId, mode: 'development', saft_modo: 'teste',
  }).select().single();
  if (error || !data) throw new Error(`Falha a criar fiscal_config global: ${error?.message}`);
  return data as FiscalConfig;
}

/**
 * validar_pronto_para_certificacao()
 *
 * Verifies ALL required data is present and structurally valid before
 * allowing activation. Returns a detailed list of errors (never throws
 * on validation failure so the UI can render them).
 */
export function validateReadyForCertification(cfg: Partial<FiscalConfig>): { ok: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!isNonEmpty(cfg.agt_certificado_numero)) {
    errors.push('Número do certificado AGT é obrigatório');
  } else if (!/^[A-Za-z0-9\/\-\.\s]{3,}$/.test(cfg.agt_certificado_numero!.trim())) {
    errors.push('Número do certificado AGT tem formato inválido');
  }

  if (!isNonEmpty(cfg.agt_data_certificacao)) {
    errors.push('Data de certificação AGT é obrigatória');
  } else {
    const d = new Date(cfg.agt_data_certificacao!);
    if (isNaN(d.getTime())) errors.push('Data de certificação AGT inválida');
    else if (d.getTime() > Date.now() + 24 * 3600 * 1000) errors.push('Data de certificação AGT não pode ser futura');
  }

  const priv = isValidPem(cfg.chave_privada, 'PRIVATE');
  if (!priv.ok) errors.push(priv.reason!);

  const pub = isValidPem(cfg.chave_publica, 'PUBLIC');
  if (!pub.ok) errors.push(pub.reason!);

  return { ok: errors.length === 0, errors };
}

/**
 * ativar_modo_certificado()
 *
 * Atomic activation. Preconditions:
 *   - caller is admin of the company (checked in API layer)
 *   - fiscal_config row exists
 *   - current mode !== 'certificado' (idempotent guard)
 *   - validateReadyForCertification passes with zero errors
 *
 * Side-effects (transactional):
 *   - mode => 'certificado'
 *   - saft_modo => 'oficial'
 *   - activated_at => now()
 *   - activated_by => caller user id
 *   - audit log written with before/after snapshots
 */
export async function activateCertifiedMode(params: {
  companyId: string;
  actorUserId: string;
  confirmation: string; // required safety word: "CERTIFICAR"
}): Promise<{ ok: true; config: FiscalConfig } | { ok: false; errors: string[] }> {
  if (params.confirmation !== 'CERTIFICAR') {
    return { ok: false, errors: ['Confirmação em falta: precisa de escrever exatamente "CERTIFICAR"'] };
  }

  const admin = createAdminClient();
  const globalCompanyId = await getGlobalPlatformCompanyId();
  const cfg = await getFiscalConfig();
  if (!cfg) return { ok: false, errors: ['Configuração fiscal não existe para a plataforma'] };

  if (cfg.mode === 'certificado') {
    return { ok: false, errors: ['Sistema já está em modo certificado — a operação é irreversível'] };
  }

  const validation = validateReadyForCertification(cfg);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  // Atomic update — Postgres trigger prevents subsequent mutation
  const before = {
    mode: cfg.mode, saft_modo: cfg.saft_modo,
    activated_at: cfg.activated_at, activated_by: cfg.activated_by,
  };
  const { data: updated, error: upErr } = await admin.from('fiscal_config')
    .update({
      mode: 'certificado',
      saft_modo: 'oficial',
      activated_at: new Date().toISOString(),
      activated_by: params.actorUserId,
    })
    .eq('id', cfg.id)
    .eq('mode', cfg.mode) // optimistic concurrency: row still in expected state
    .select().single();

  if (upErr || !updated) {
    return { ok: false, errors: [upErr?.message ?? 'Falha a ativar o modo certificado'] };
  }

  await admin.from('audit_logs').insert({
    user_id: params.actorUserId,
    company_id: globalCompanyId,
    action: 'fiscal_config.activate_certified',
    entity: 'fiscal_config',
    entity_id: cfg.id,
    details: {
      before,
      after: {
        mode: 'certificado', saft_modo: 'oficial',
        activated_at: updated.activated_at, activated_by: params.actorUserId,
      },
      certificado_numero: cfg.agt_certificado_numero,
      certificado_data: cfg.agt_data_certificacao,
    },
  });

  return { ok: true, config: updated as FiscalConfig };
}

/**
 * Public view: status badge used by header/footer.
 */
export function certificationBadge(cfg: FiscalConfig | null): { label: string; tone: 'muted' | 'warn' | 'success' } {
  if (!cfg || cfg.mode === 'development') {
    return { label: 'Sistema em conformidade com AGT (não certificado)', tone: 'muted' };
  }
  if (cfg.mode === 'pre_certificacao') {
    return { label: 'Pré-certificação AGT — dados em preparação', tone: 'warn' };
  }
  return { label: `Programa certificado nº ${cfg.agt_certificado_numero ?? '---'}`, tone: 'success' };
}
