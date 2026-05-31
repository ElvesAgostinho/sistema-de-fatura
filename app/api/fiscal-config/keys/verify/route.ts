import { NextResponse } from 'next/server';
import { getCurrentUserContext } from '@/lib/auth';
import { getFiscalConfig } from '@/lib/fiscal-config';
import { verifyKeyPairConsistency, isPemStructurallyValid } from '@/lib/crypto-keys';

export const dynamic = 'force-dynamic';

/**
 * GET /api/fiscal-config/keys/verify
 *
 * Admin-only key integrity check. Does NOT return the private key.
 * Runs a real sign/verify round-trip server-side and reports:
 *   - exists: both keys are present and structurally valid PEM
 *   - consistent: sign/verify round-trip passes (pair matches)
 *   - modulusLength: bit size
 *   - publicKey: the public PEM (safe to display)
 */
export async function GET() {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!ctx.profile.company_id) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const cfg = await getFiscalConfig(ctx.profile.company_id);
  if (!cfg) {
    return NextResponse.json({ exists: false, consistent: false, reason: 'Sem configuração fiscal' });
  }

  const privOk = isPemStructurallyValid(cfg.chave_privada, 'PRIVATE');
  const pubOk = isPemStructurallyValid(cfg.chave_publica, 'PUBLIC');

  if (!privOk || !pubOk) {
    return NextResponse.json({
      exists: false,
      consistent: false,
      structureValid: { private: privOk, public: pubOk },
      reason: 'Chaves em falta ou com formato PEM inválido',
      publicKey: pubOk ? cfg.chave_publica : null,
    });
  }

  const check = verifyKeyPairConsistency(cfg.chave_privada!, cfg.chave_publica!);

  return NextResponse.json({
    exists: true,
    consistent: check.ok,
    modulusLength: check.modulusLength ?? null,
    reason: check.ok ? null : check.reason,
    publicKey: cfg.chave_publica, // safe; never the private
  });
}
