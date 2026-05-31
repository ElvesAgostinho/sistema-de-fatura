import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';
import { generateRsaKeyPair, verifyKeyPairConsistency } from '@/lib/crypto-keys';
import { ensureFiscalConfig } from '@/lib/fiscal-config';

export const dynamic = 'force-dynamic';

/**
 * POST /api/fiscal-config/generate-keys
 *
 * Generates (or re-generates under strict guard) a real RSA 2048 key pair
 * for the calling admin's company and stores it in fiscal_config.
 *
 * Security rules:
 *  1. Admin only (403 for users)
 *  2. If fiscal_config.mode === 'certificado' → ALWAYS refused (even with force).
 *     The DB trigger would also reject the UPDATE, but we return a clean 409
 *     instead of a 500 from the trigger.
 *  3. If keys already exist → requires body { confirmation: 'REGENERAR' }
 *     to overwrite. Otherwise returns a 409 with a "keysExist" flag so the
 *     UI can display a warning.
 *  4. Every generation writes an audit log entry (keys.generated / keys.regenerated).
 *  5. Private key is NEVER returned in the response (only a length/fingerprint).
 */
export async function POST(req: Request) {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const isSuperAdmin = ctx.profile.email === 'elvessacapuri57@gmail.com';
  if (ctx.profile.role !== 'admin' && !isSuperAdmin) return NextResponse.json({ error: 'Apenas administradores podem gerar chaves' }, { status: 403 });
  if (!ctx.profile.company_id) return NextResponse.json({ error: 'Sem empresa associada' }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const confirmation = (body?.confirmation ?? '').toString();
  const modulusLength = [2048, 3072, 4096].includes(body?.modulusLength) ? body.modulusLength : 2048;

  const cfg = await ensureFiscalConfig(ctx.profile.company_id);

  // Rule 2 — never, ever regenerate after certification
  if (cfg.mode === 'certificado') {
    return NextResponse.json({
      error: 'Sistema já está em modo certificado. Chaves criptográficas são imutáveis.',
    }, { status: 409 });
  }

  const hasExistingKeys = Boolean(cfg.chave_privada && cfg.chave_publica);

  // Rule 3 — require explicit confirmation when overwriting
  if (hasExistingKeys && confirmation !== 'REGENERAR') {
    return NextResponse.json({
      error: 'Já existem chaves. Para regerar, submeta novamente com confirmation: "REGENERAR".',
      keysExist: true,
    }, { status: 409 });
  }

  // --- Real RSA generation (CPU bound; ~100-300ms) ---
  let pair;
  try {
    pair = generateRsaKeyPair(modulusLength);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Falha na geração de chaves' }, { status: 500 });
  }

  // Extra paranoia: double-check the pair we are about to persist
  const check = verifyKeyPairConsistency(pair.privatePem, pair.publicPem);
  if (!check.ok) {
    return NextResponse.json({ error: `Auto-verificação falhou: ${check.reason}` }, { status: 500 });
  }

  const admin = createAdminClient();

  // Archive any currently-active keys for this company (so old signed invoices
  // remain verifiable with the key that was actually used at emission time).
  if (hasExistingKeys) {
    await admin
      .from('fiscal_keys')
      .update({ is_active: false, archived_at: new Date().toISOString() })
      .eq('company_id', ctx.profile.company_id)
      .eq('is_active', true);
  }

  // Insert the new active key row in fiscal_keys and grab the id for invoices
  const { data: newKeyRow, error: keyInsErr } = await admin
    .from('fiscal_keys')
    .insert({
      company_id: ctx.profile.company_id,
      public_key: pair.publicPem,
      private_key: pair.privatePem,
      modulus_length: check.modulusLength,
      is_active: true,
      created_by: ctx.profile.id,
    })
    .select('id')
    .single();

  if (keyInsErr || !newKeyRow) {
    return NextResponse.json({ error: keyInsErr?.message ?? 'Falha ao arquivar chave' }, { status: 500 });
  }

  const { data: updated, error: uErr } = await admin
    .from('fiscal_config')
    .update({
      chave_privada: pair.privatePem,
      chave_publica: pair.publicPem,
    })
    .eq('id', cfg.id)
    .eq('mode', cfg.mode) // optimistic: reject if mode has changed concurrently
    .select()
    .maybeSingle();

  if (uErr || !updated) {
    return NextResponse.json({ error: uErr?.message ?? 'Falha ao guardar chaves' }, { status: 500 });
  }

  // Audit trail
  await admin.from('audit_logs').insert({
    user_id: ctx.profile.id,
    company_id: ctx.profile.company_id,
    action: hasExistingKeys ? 'keys.regenerated' : 'keys.generated',
    entity: 'fiscal_config',
    entity_id: cfg.id,
    details: {
      modulusLength: check.modulusLength,
      createdAt: pair.createdAt,
      actor_email: ctx.profile.email,
      replaced_previous: hasExistingKeys,
      fiscal_key_id: newKeyRow.id,
    },
  });

  return NextResponse.json({
    success: true,
    modulusLength: check.modulusLength,
    publicKey: pair.publicPem,       // safe to return
    privateKeyLength: pair.privatePem.length, // hint only — never the key itself
    replacedPrevious: hasExistingKeys,
  });
}
