/**
 * SAF-T (AO) Pre-Export Validator
 *
 * Runs a battery of structural, fiscal and integrity checks against the data
 * that will be fed to `buildSaftXml`. Returns a typed report that can be
 * shown in the UI and persisted in audit logs.
 */

import type { SaftInput } from './saft';

export type Severity = 'error' | 'warning' | 'info';

export interface SaftIssue {
  code: string;
  severity: Severity;
  message: string;
  context?: Record<string, any>;
}

export interface SaftValidationReport {
  level: 'NAO_APTO' | 'APTO_COM_AJUSTES' | 'APTO_PARA_AUDITORIA';
  errors: number;
  warnings: number;
  infos: number;
  issues: SaftIssue[];
  stats: {
    invoices: number;
    clients: number;
    products: number;
    totalCredit: number;
    totalDebit: number;
    totalTax: number;
    hashChainValid: boolean;
    hashCoverage: number; // 0..1
    signatureCoverage: number; // 0..1
  };
}

export function validateSaftInput(input: SaftInput & {
  certificateNumber?: string | number | null;
  saftMode?: string | null;
}): SaftValidationReport {
  const issues: SaftIssue[] = [];
  const add = (code: string, severity: Severity, message: string, context?: Record<string, any>) => {
    issues.push({ code, severity, message, context });
  };

  const { company, invoices, clients } = input;

  /* ------------------ Company / Header ------------------ */
  if (!company?.nif) add('COMP_NIF', 'error', 'NIF da empresa em falta no cabeçalho.');
  if (company?.nif && !/^\d{9,14}$/.test(company.nif)) add('COMP_NIF_FMT', 'warning', `NIF da empresa com formato inesperado: ${company.nif}`);
  if (!company?.name) add('COMP_NAME', 'error', 'Razão social da empresa em falta.');
  if (!company?.address) add('COMP_ADDR', 'warning', 'Endereço da empresa não preenchido — será exportado como "N/A".');
  const certNum = Number(input.certificateNumber);
  if (!Number.isFinite(certNum) || certNum <= 0) add('CERT_NUM', 'info', 'SoftwareCertificateNumber=0 (sistema em modo pré-certificação). Aceite pela AGT em ambiente de testes.');

  /* ------------------ Produtos / Clientes ------------------ */
  for (const c of clients || []) {
    if (!c.nif) add('CLI_NIF', 'error', `Cliente sem NIF: ${c.name}`);
    else if (!/^\d{9,14}$/.test(c.nif)) add('CLI_NIF_FMT', 'warning', `NIF do cliente ${c.name} com formato inesperado: ${c.nif}`);
  }

  /* ------------------ Invoices ------------------ */
  let hashCount = 0;
  let sigCount = 0;
  let totalCredit = 0;
  let totalDebit = 0;
  let totalTax = 0;
  const numbersSeen = new Set<string>();

  // Sort invoices chronologically for chain check
  const chronological = [...(invoices || [])].sort((a, b) => {
    const at = new Date(a.issued_at as any).getTime();
    const bt = new Date(b.issued_at as any).getTime();
    return at - bt;
  });

  let chainOk = true;
  const prevHashPerSeries: Record<string, string> = {};

  for (const inv of chronological) {
    if (!inv.invoice_number) { add('INV_NO', 'error', 'Fatura sem número.'); continue; }
    if (numbersSeen.has(inv.invoice_number)) add('INV_DUP', 'error', `Número de fatura duplicado: ${inv.invoice_number}`);
    numbersSeen.add(inv.invoice_number);

    // AGT InvoiceNo format: TIPO SERIE/NNNNNN
    if (!/^(FT|FR|NC|ND|RC|PP|GT|VD|TV|TD|AA|DA)\s+[A-Z0-9][A-Z0-9\-]*\/\d+$/.test(inv.invoice_number)) {
      add('INV_NO_FMT', 'warning',
        `Número de fatura com formato não padrão: "${inv.invoice_number}". Formato recomendado pela AGT: TIPO SÉRIE/NÚmero (ex: "FT A/1" ou "FR 2025/0001").`,
        { invoice: inv.invoice_number }
      );
    }

    if (!inv.client_nif) add('INV_CLI', 'error', `Fatura ${inv.invoice_number} sem NIF de cliente.`, { invoice: inv.invoice_number });
    else if (inv.client_nif !== '000000000' && inv.client_nif !== '999999999' && !/^\d{9,14}$/.test(inv.client_nif)) {
      add('INV_CLI_FMT', 'warning', `Fatura ${inv.invoice_number}: NIF do cliente com formato inesperado: ${inv.client_nif}`);
    }
    if (!inv.issued_at) add('INV_DATE', 'error', `Fatura ${inv.invoice_number} sem data de emissão.`);

    const sub = Number(inv.subtotal);
    const tax = Number(inv.tax);
    const tot = Number(inv.total);
    if (Number.isFinite(sub) && Number.isFinite(tax) && Number.isFinite(tot)) {
      const computed = +(sub + tax).toFixed(2);
      if (Math.abs(computed - tot) > 0.02) {
        add('INV_TOTALS', 'error', `Fatura ${inv.invoice_number}: GrossTotal (${tot.toFixed(2)}) ≠ NetTotal (${sub.toFixed(2)}) + TaxPayable (${tax.toFixed(2)}) = ${computed.toFixed(2)}. AGT rejeita SAF-T com esta diferença.`);
      }
    }
    
    // Items vs totals: AGT requires NetTotal to match the sum of Line/CreditAmount
    const itemsNetSum = (inv.items || []).reduce((s, it) => s + (Number(it.quantity) * Number(it.price) - Number(it.discount || 0)), 0);
    if (Number.isFinite(itemsNetSum) && Math.abs(itemsNetSum - sub) > 0.05) {
      add('INV_ITEMS', 'warning', `Fatura ${inv.invoice_number}: soma base das linhas (${itemsNetSum.toFixed(2)}) difere do subtotal (${sub.toFixed(2)}).`);
    }

    for (const it of inv.items || []) {
      if (Number(it.tax_rate) === 0 && !it.tax_exemption_reason && !inv.tax_exemption_reason) {
        add('TAX_EXEMPT', 'warning', `Fatura ${inv.invoice_number}: linha com IVA 0% sem motivo de isenção (M01-M19).`);
      }
      const exemCode = (it.tax_exemption_reason ?? inv.tax_exemption_reason ?? '').trim();
      if (exemCode && exemCode === 'M99') {
        add('TAX_EXEMPT_CODE', 'warning', `Fatura ${inv.invoice_number}: código M99 não reconhecido pela AGT. O sistema mapeou automaticamente para M19.`);
      } else if (exemCode && !/^M(0[1-9]|1[0-9])/.test(exemCode)) {
        add('TAX_EXEMPT_CODE', 'warning', `Fatura ${inv.invoice_number}: código de isenção "${exemCode}" não segue formato Mxx.`);
      }
    }

    if (inv.hash) hashCount++;
    if (inv.signature) sigCount++;
    
    // Hash chain per series
    const seriesKey = inv.invoice_number.split('/')[0];
    if (inv.status !== 'cancelled') {
      const expectedHash = prevHashPerSeries[seriesKey] || null;
      if (expectedHash !== null && inv.previous_hash && inv.previous_hash !== expectedHash) {
        add('HASH_CHAIN', 'error', `Encadeamento de hash quebrado na fatura ${inv.invoice_number} (série ${seriesKey}).`);
        chainOk = false;
      }
      prevHashPerSeries[seriesKey] = inv.hash || expectedHash || '';
    }

    const docType = (inv.document_type || 'FT').toUpperCase();
    if (!['FT', 'FR', 'NC', 'ND', 'RC', 'PP', 'OR', 'GT'].includes(docType)) add('INV_TYPE', 'warning', `Tipo de documento inválido em ${inv.invoice_number}: ${docType}`);
    if ((docType === 'NC' || docType === 'ND') && !inv.related_document) {
      add('INV_REF', 'error', `${docType} ${inv.invoice_number} não referencia documento de origem.`);
    }

    if (inv.status !== 'cancelled' && docType !== 'NC') totalCredit += Number(inv.total) || 0;
    if (inv.status !== 'cancelled' && docType === 'NC') totalDebit += Number(inv.total) || 0;
    totalTax += Number(inv.tax) || 0;
  }

  const invCount = (invoices || []).length;
  const hashCoverage = invCount ? hashCount / invCount : 1;
  const signatureCoverage = invCount ? sigCount / invCount : 0;
  if (invCount && hashCoverage < 1) add('HASH_COV', 'warning', `Apenas ${(hashCoverage * 100).toFixed(0)}% das faturas têm hash.`);
  if (invCount && signatureCoverage < 1) add('SIG_COV', 'info', `${(signatureCoverage * 100).toFixed(0)}% das faturas assinadas digitalmente.`);

  const errors = issues.filter(i => i.severity === 'error').length;
  const warnings = issues.filter(i => i.severity === 'warning').length;
  const infos = issues.filter(i => i.severity === 'info').length;
  const level: SaftValidationReport['level'] = errors > 0 ? 'NAO_APTO' : (warnings > 0 ? 'APTO_COM_AJUSTES' : 'APTO_PARA_AUDITORIA');

  return {
    level,
    errors,
    warnings,
    infos,
    issues,
    stats: {
      invoices: invCount,
      clients: (clients || []).length,
      products: (input.products || []).length,
      totalCredit,
      totalDebit,
      totalTax,
      hashChainValid: chainOk,
      hashCoverage,
      signatureCoverage,
    },
  };
}
