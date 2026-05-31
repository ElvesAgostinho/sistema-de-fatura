import { NextResponse } from 'next/server';
import { getCurrentUserContext } from '@/lib/auth';
import { validateReadyForCertification } from '@/lib/fiscal-config';

export const dynamic = 'force-dynamic';

/**
 * Self-test endpoint for the validation logic.
 * Admin-only. Returns a pass/fail report for 3 scenarios:
 *   1) empty/partial config → must fail with expected errors
 *   2) fully valid config     → must pass (ok=true)
 *   3) invalid PEM structure  → must fail
 *
 * This exists so operators (and the user selling the SaaS) can verify
 * end-to-end that the certification gate is wired correctly. It does NOT
 * touch the DB or modify fiscal_config.
 */
export async function GET() {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const validPrivPem = `-----BEGIN PRIVATE KEY-----\n${'A'.repeat(500)}\n-----END PRIVATE KEY-----`;
  const validPubPem = `-----BEGIN PUBLIC KEY-----\n${'B'.repeat(300)}\n-----END PUBLIC KEY-----`;

  // 1) Empty config → should fail
  const r1 = validateReadyForCertification({});
  const t1 = {
    name: 'Configuração vazia deve falhar',
    passed: r1.ok === false && r1.errors.length > 0,
    details: { ok: r1.ok, errors: r1.errors },
  };

  // 2) Valid config → should pass
  const r2 = validateReadyForCertification({
    agt_certificado_numero: '123/AGT/2026',
    agt_data_certificacao: new Date().toISOString().slice(0, 10),
    chave_privada: validPrivPem,
    chave_publica: validPubPem,
    saft_modo: 'oficial',
  });
  const t2 = {
    name: 'Configuração completa e válida deve passar',
    passed: r2.ok === true && r2.errors.length === 0,
    details: { ok: r2.ok, errors: r2.errors },
  };

  // 3) Invalid PEM structure → should fail
  const r3 = validateReadyForCertification({
    agt_certificado_numero: '123/AGT/2026',
    agt_data_certificacao: new Date().toISOString().slice(0, 10),
    chave_privada: 'not-a-pem-key',
    chave_publica: 'also-not-a-pem',
    saft_modo: 'oficial',
  });
  const t3 = {
    name: 'Chaves PEM inválidas devem falhar',
    passed: r3.ok === false && r3.errors.some(e => e.toLowerCase().includes('chave')),
    details: { ok: r3.ok, errors: r3.errors },
  };

  // 4) Future date must fail
  const r4 = validateReadyForCertification({
    agt_certificado_numero: '123/AGT/2026',
    agt_data_certificacao: '2099-01-01',
    chave_privada: validPrivPem,
    chave_publica: validPubPem,
    saft_modo: 'oficial',
  });
  const t4 = {
    name: 'Data de certificação futura deve falhar',
    passed: r4.ok === false && r4.errors.some(e => e.toLowerCase().includes('futuro') || e.toLowerCase().includes('futura')),
    details: { ok: r4.ok, errors: r4.errors },
  };

  // 5) Número de certificado com formato inválido
  const r5 = validateReadyForCertification({
    agt_certificado_numero: 'abc',
    agt_data_certificacao: new Date().toISOString().slice(0, 10),
    chave_privada: validPrivPem,
    chave_publica: validPubPem,
    saft_modo: 'oficial',
  });
  const t5 = {
    name: 'Número de certificado com formato inválido deve falhar',
    passed: r5.ok === false && r5.errors.some(e => e.toLowerCase().includes('número')),
    details: { ok: r5.ok, errors: r5.errors },
  };

  const tests = [t1, t2, t3, t4, t5];
  const allPassed = tests.every(t => t.passed);

  return NextResponse.json({
    passed: allPassed,
    totalTests: tests.length,
    passedCount: tests.filter(t => t.passed).length,
    tests,
  });
}
