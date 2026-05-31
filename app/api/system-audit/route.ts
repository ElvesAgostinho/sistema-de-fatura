import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';
import { validateInvoiceHash } from '@/lib/hash';
import { buildInvoiceSignaturePayload, verifyWithPublicKey } from '@/lib/crypto-keys';
import { getFiscalConfig } from '@/lib/fiscal-config';

export const dynamic = 'force-dynamic';

interface CheckResult {
  id: string;
  title: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  details?: any;
}

/**
 * GET /api/system-audit
 *
 * Runs a comprehensive audit of the current company's fiscal data.
 * Checks:
 *   1. Hash chain continuity (all invoices have valid + linked hashes)
 *   2. Digital signatures (all signed invoices verify correctly)
 *   3. Sequence gaps per document type / year
 *   4. Orphan items (items without invoices)
 *   5. Cancelled invoices have a reason
 *   6. Tax-exempt invoices have a reason
 *   7. Duplicate client NIFs (within company)
 *   8. Fiscal config present + keys configured
 *   9. Key history integrity (at least one active fiscal_keys row if signatures exist)
 *
 * Returns structured checks. Admin only.
 */
export async function GET() {
  const ctx = await getCurrentUserContext();
  if (!ctx?.profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (ctx.profile.role !== 'admin') return NextResponse.json({ error: 'Apenas administradores' }, { status: 403 });
  if (!ctx.profile.company_id) return NextResponse.json({ error: 'Sem empresa associada' }, { status: 400 });

  const admin = createAdminClient();
  const companyId = ctx.profile.company_id;
  const checks: CheckResult[] = [];

  // 1) Fiscal config + keys
  const fcfg = await getFiscalConfig(companyId);
  if (!fcfg) {
    checks.push({ id: 'fiscal-config', title: 'Configuração fiscal', status: 'fail', message: 'Nenhuma configuração fiscal encontrada.' });
  } else {
    const hasKeys = Boolean(fcfg.chave_privada && fcfg.chave_publica && fcfg.chave_privada.includes('BEGIN'));
    checks.push({
      id: 'fiscal-config',
      title: 'Configuração fiscal',
      status: hasKeys ? 'pass' : 'warn',
      message: hasKeys ? `Modo: ${fcfg.mode}. Chaves RSA configuradas.` : 'Configuração presente mas sem chaves RSA — faturas não estarão assinadas.',
    });
  }

  // 2) Key history
  const { data: activeKeys } = await admin
    .from('fiscal_keys')
    .select('id, is_active, modulus_length, created_at')
    .eq('company_id', companyId)
    .eq('is_active', true);
  const { count: totalKeys } = await admin
    .from('fiscal_keys')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId);
  checks.push({
    id: 'fiscal-keys-history',
    title: 'Histórico de chaves',
    status: (activeKeys?.length ?? 0) === 1 ? 'pass' : ((activeKeys?.length ?? 0) > 1 ? 'fail' : 'warn'),
    message: (activeKeys?.length ?? 0) === 1
      ? `1 chave ativa, ${(totalKeys ?? 1) - 1} arquivadas.`
      : ((activeKeys?.length ?? 0) > 1 ? `Inconsistência: ${activeKeys?.length} chaves ativas simultaneamente.` : 'Sem chave ativa no histórico.'),
    details: { active: activeKeys?.length ?? 0, total: totalKeys ?? 0 },
  });

  // 3) Invoices (fetch a sample for hash & signature verification)
  const { data: invoices, count: invCount } = await admin
    .from('invoices')
    .select('id, invoice_number, document_type, issued_at, client_nif, total, hash, previous_hash, signature, signature_key_id, status, cancellation_reason, tax_exemption_reason', { count: 'exact' })
    .eq('company_id', companyId)
    .order('issued_at', { ascending: true })
    .limit(500);

  const invs = invoices ?? [];

  // Hash chain
  let hashInvalid = 0;
  let prevHashMismatches = 0;
  for (let i = 0; i < invs.length; i++) {
    const inv = invs[i] as any;
    if (inv.hash) {
      const valid = validateInvoiceHash(inv);
      if (!valid) hashInvalid++;
    }
    if (i > 0 && invs[i - 1].hash !== inv.previous_hash) {
      prevHashMismatches++;
    }
  }
  checks.push({
    id: 'hash-chain',
    title: 'Cadeia de hashes SHA-256',
    status: (hashInvalid === 0 && prevHashMismatches === 0) ? 'pass' : 'fail',
    message: (hashInvalid === 0 && prevHashMismatches === 0)
      ? `${invs.length} faturas auditadas — todos os hashes válidos e encadeados.`
      : `${hashInvalid} hash(es) inválido(s), ${prevHashMismatches} quebra(s) de encadeamento.`,
    details: { total: invs.length, hashInvalid, prevHashMismatches },
  });

  // 4) Signature verification (bulk)
  const signedInvs = invs.filter((i: any) => i.signature);
  let sigInvalid = 0;
  if (signedInvs.length > 0) {
    // Build a key lookup
    const keyIds = Array.from(new Set(signedInvs.map((i: any) => i.signature_key_id).filter(Boolean)));
    const keyMap = new Map<string, string>();
    if (keyIds.length > 0) {
      const { data: keyRows } = await admin.from('fiscal_keys').select('id, public_key').in('id', keyIds as string[]);
      for (const k of keyRows ?? []) keyMap.set(k.id, k.public_key);
    }
    const fallbackPub = fcfg?.chave_publica ?? null;

    for (const inv of signedInvs) {
      const pub = (inv.signature_key_id && keyMap.get(inv.signature_key_id)) || fallbackPub;
      if (!pub) { sigInvalid++; continue; }
      const payload = buildInvoiceSignaturePayload({
        invoice_number: inv.invoice_number,
        issued_at: inv.issued_at,
        total: inv.total,
        previous_hash: inv.previous_hash,
      });
      const valid = verifyWithPublicKey(pub, payload, inv.signature as string);
      if (!valid) sigInvalid++;
    }
  }
  checks.push({
    id: 'signatures',
    title: 'Assinaturas digitais RSA-SHA256',
    status: signedInvs.length === 0 ? 'warn' : (sigInvalid === 0 ? 'pass' : 'fail'),
    message: signedInvs.length === 0
      ? 'Nenhuma fatura assinada ainda (chaves configuradas para novos documentos).'
      : (sigInvalid === 0 ? `${signedInvs.length} faturas assinadas — todas verificadas com sucesso.` : `${sigInvalid} de ${signedInvs.length} assinaturas inválidas.`),
    details: { signed: signedInvs.length, invalid: sigInvalid, unsigned: invs.length - signedInvs.length },
  });

  // 5) Cancelled without reason
  const cancelledNoReason = invs.filter((i: any) => i.status === 'cancelled' && !i.cancellation_reason).length;
  checks.push({
    id: 'cancellations',
    title: 'Cancelamentos rastreáveis',
    status: cancelledNoReason === 0 ? 'pass' : 'fail',
    message: cancelledNoReason === 0 ? 'Todas as anulações têm motivo registado.' : `${cancelledNoReason} anulações sem motivo.`,
  });

  // 6) Tax-exempt without reason
  const { count: exemptNoReason } = await admin
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('tax', 0)
    .is('tax_exemption_reason', null);
  checks.push({
    id: 'exempt-reason',
    title: 'Motivo de isenção IVA',
    status: (exemptNoReason ?? 0) === 0 ? 'pass' : 'warn',
    message: (exemptNoReason ?? 0) === 0 ? 'Todas as isenções têm motivo.' : `${exemptNoReason} faturas com IVA=0 sem motivo de isenção.`,
  });

  // 7) Sequence gaps
  const seqMap = new Map<string, number[]>();
  for (const inv of invs as any[]) {
    // Parse: FT 2026/0001
    const m = inv.invoice_number.match(/^(\w+)\s+(\d{4})\/(\d+)$/);
    if (m) {
      const key = `${m[1]} ${m[2]}`;
      if (!seqMap.has(key)) seqMap.set(key, []);
      seqMap.get(key)!.push(Number(m[3]));
    }
  }
  const gaps: any[] = [];
  for (const [key, seq] of seqMap) {
    const sorted = [...seq].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] !== sorted[i - 1] + 1) {
        gaps.push({ series: key, from: sorted[i - 1], to: sorted[i] });
      }
    }
  }
  checks.push({
    id: 'sequence',
    title: 'Sequencialidade de numeração',
    status: gaps.length === 0 ? 'pass' : 'fail',
    message: gaps.length === 0 ? `Numeração contínua em ${seqMap.size} série(s).` : `${gaps.length} lacuna(s) detetada(s).`,
    details: gaps.slice(0, 5),
  });

  // 8) Duplicate client NIFs
  const { data: clientsArr } = await admin
    .from('clients')
    .select('nif')
    .eq('company_id', companyId);
  const nifCounts = new Map<string, number>();
  for (const c of clientsArr ?? []) {
    nifCounts.set(c.nif, (nifCounts.get(c.nif) ?? 0) + 1);
  }
  const dupNifs = Array.from(nifCounts.entries()).filter(([, n]) => n > 1);
  checks.push({
    id: 'duplicate-nifs',
    title: 'NIFs de clientes únicos',
    status: dupNifs.length === 0 ? 'pass' : 'warn',
    message: dupNifs.length === 0 ? 'Nenhum NIF duplicado.' : `${dupNifs.length} NIF(s) em duplicado.`,
    details: dupNifs.slice(0, 10),
  });

  // 9) Orphan items
  const { count: orphanItems } = await admin
    .from('invoice_items')
    .select('id', { count: 'exact', head: true })
    .is('invoice_id', null);
  checks.push({
    id: 'orphan-items',
    title: 'Itens órfãos',
    status: (orphanItems ?? 0) === 0 ? 'pass' : 'fail',
    message: (orphanItems ?? 0) === 0 ? 'Nenhum item órfão encontrado.' : `${orphanItems} item(ns) sem fatura associada.`,
  });

  // Overall classification
  const hasFail = checks.some(c => c.status === 'fail');
  const hasWarn = checks.some(c => c.status === 'warn');
  const classification: 'apt' | 'apt-with-risks' | 'not-apt' = hasFail ? 'not-apt' : (hasWarn ? 'apt-with-risks' : 'apt');

  // Audit log
  await admin.from('audit_logs').insert({
    user_id: ctx.profile.id,
    company_id: companyId,
    action: 'system.audit',
    entity: 'company',
    entity_id: companyId,
    details: { classification, fails: checks.filter(c => c.status === 'fail').length, warns: checks.filter(c => c.status === 'warn').length, passes: checks.filter(c => c.status === 'pass').length },
  });

  return NextResponse.json({
    classification,
    summary: {
      total: checks.length,
      passes: checks.filter(c => c.status === 'pass').length,
      warns: checks.filter(c => c.status === 'warn').length,
      fails: checks.filter(c => c.status === 'fail').length,
      invoicesAudited: invs.length,
      totalInvoices: invCount ?? 0,
    },
    checks,
    generatedAt: new Date().toISOString(),
  });
}
