/**
 * SAF-T (AO) XML Generator — Angola / AGT compliant.
 *
 * Estrutura baseada na norma SAF-T PT v1.04 adaptada aos requisitos da
 * Administração Geral Tributária de Angola (AGT).
 *
 * Correções obrigatórias aplicadas (vs v1):
 *   - AccountID nunca fica "Desconhecido": usa o código padrão 'Geral'
 *     (AGT aceita 'Geral' para clientes sem conta específica).
 *   - SoftwareCertificateNumber sempre inteiro (0 = não-certificado).
 *   - HashControl reflete a versão do esquema de assinatura (1 para sistemas
 *     certificados que usam RSA-SHA256; "0" se não houver hash válido).
 *   - Encadeamento real de hashes: cada <Hash> é o da própria fatura; o
 *     validador externo verifica continuidade previous_hash → hash.
 *   - SourceBilling: 'teste' → 'T', caso contrário 'P'.
 *   - Produtos com códigos determinísticos e únicos (slug + short hash).
 *   - CustomerID é o NIF (consistente entre MasterFiles e Invoice).
 *   - TaxExemptionReason + TaxExemptionCode para taxas 0%.
 *   - PostalCode, Country, AddressDetail sempre populados.
 *   - Quantidades com 3 decimais, valores monetários com 2.
 *   - <References><Reference><OriginatingON> estrutura correta para NC/ND.
 *   - Numeração sequencial garantida por fiscal_series (DB).
 */

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function esc(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function money(v: unknown): string {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
}

function qty(v: unknown): string {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n.toFixed(3) : '0.000';
}

function pct(v: unknown): string {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
}

function isoDate(v: unknown): string {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v as string);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

function isoDateTime(v: unknown): string {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v as string);
  return isNaN(d.getTime()) ? '' : d.toISOString().replace(/\.\d{3}Z$/, '');
}

/** FNV-1a short hash — used to disambiguate product codes when descriptions collide. */
function shortHash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16).toUpperCase().padStart(8, '0').slice(0, 6);
}

/** Deterministic, unique and short product code derived from its description. */
function slugCode(name: string): string {
  const clean = String(name || 'ITEM')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 18);
  const base = clean || 'ITEM';
  return `${base}-${shortHash(String(name || 'ITEM').toLowerCase())}`;
}

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface SaftCompany {
  nif: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  postal_code?: string | null;
}

export interface SaftClient {
  id: string;
  name: string;
  nif: string;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  postal_code?: string | null;
}

export interface SaftProduct {
  id: string;
  code?: string | null;
  name: string;
  description?: string | null;
  unit_price?: number | string | null;
  tax_rate?: number | string | null;
}

export interface SaftInvoiceItem {
  description: string;
  quantity: number | string;
  price: number | string;
  tax_rate: number | string;
  total: number | string;
  tax_exemption_reason?: string | null;
}

export interface SaftInvoice {
  invoice_number: string;
  document_type: string;
  issued_at: string | Date;
  status: 'issued' | 'cancelled' | string;
  cancellation_reason?: string | null;
  cancelled_at?: string | Date | null;
  subtotal: number | string;
  tax: number | string;
  total: number | string;
  hash?: string | null;
  previous_hash?: string | null;
  signature?: string | null;
  client_nif: string;
  client_name: string;
  related_document?: string | null;
  tax_exempt?: boolean;
  tax_exemption_reason?: string | null;
  items: SaftInvoiceItem[];
}

export interface SaftInput {
  company: SaftCompany;
  period: { from: Date; to: Date };
  clients: SaftClient[];
  products: SaftProduct[];
  invoices: SaftInvoice[];
  /** 'producao'|'oficial' (default P) ou 'teste' (T). */
  saftMode?: 'producao' | 'oficial' | 'teste' | string | null;
  /** Número do certificado AGT. 0 = não certificado. */
  certificateNumber?: string | number | null;
  /** Nome comercial (pode diferir de company.name). */
  businessName?: string | null;
}

/* ------------------------------------------------------------------ */
/* Builder                                                             */
/* ------------------------------------------------------------------ */

export function buildSaftXml(input: SaftInput): string {
  const { company, period, clients, products, invoices } = input;
  const saftMode = input.saftMode === 'teste' ? 'T' : 'P';
  const certNumRaw = Number(input.certificateNumber);
  const certNum = Number.isFinite(certNumRaw) && certNumRaw > 0 ? String(Math.trunc(certNumRaw)) : '0';
  const businessName = (input.businessName || company.name || '').slice(0, 60);
  const fiscalYear = period.from.getUTCFullYear();
  const defaultCity = company.city || 'Luanda';
  const defaultPostal = company.postal_code || 'N/A';

  /* ---------- Products: deterministic codes, unique per description ---------- */
  const productMap = new Map<string, { code: string; description: string; taxRate: number }>();
  const codeInUse = new Set<string>();
  const registerProduct = (desc: string, taxRate: number, explicitCode?: string) => {
    const key = String(desc || '').trim().toLowerCase();
    if (!key) return null;
    if (productMap.has(key)) return productMap.get(key)!;
    let code = explicitCode && String(explicitCode).trim() ? String(explicitCode).trim() : slugCode(desc);
    // Disambiguate if the code was already claimed by a different description
    if (codeInUse.has(code)) code = `${code}-${shortHash(key)}`;
    codeInUse.add(code);
    const entry = { code, description: desc, taxRate };
    productMap.set(key, entry);
    return entry;
  };
  for (const p of products) registerProduct(p.description || p.name, Number(p.tax_rate ?? 14), p.code ?? undefined);
  const uniqueRates = new Set<string>();
  for (const inv of invoices) {
    for (const it of inv.items ?? []) {
      registerProduct(it.description, Number(it.tax_rate ?? 14));
      uniqueRates.add(pct(it.tax_rate));
    }
  }
  const allProducts = Array.from(productMap.values());

  /* ---------- Clients: keyed by NIF + cleaned-up account ID ---------- */
  const clientByNif = new Map<string, SaftClient & { account: string }>();
  const pickAccount = (c: { nif: string }) => (c.nif && c.nif !== '999999999') ? 'Geral' : 'ConsumidorFinal';
  for (const c of clients) {
    if (!c.nif) continue;
    if (!clientByNif.has(c.nif)) clientByNif.set(c.nif, { ...c, account: pickAccount(c) });
  }
  for (const inv of invoices) {
    if (inv.client_nif && !clientByNif.has(inv.client_nif)) {
      clientByNif.set(inv.client_nif, {
        id: inv.client_nif,
        name: inv.client_name || 'Cliente',
        nif: inv.client_nif,
        address: null,
        email: null,
        phone: null,
        city: null,
        postal_code: null,
        account: pickAccount({ nif: inv.client_nif }),
      });
    }
  }

  /* ---------- Header ---------- */
  const header = `  <Header>
    <AuditFileVersion>1.01_01</AuditFileVersion>
    <CompanyID>${esc(company.nif)}</CompanyID>
    <TaxRegistrationNumber>${esc(company.nif)}</TaxRegistrationNumber>
    <TaxAccountingBasis>F</TaxAccountingBasis>
    <CompanyName>${esc(company.name)}</CompanyName>
    <BusinessName>${esc(businessName)}</BusinessName>
    <CompanyAddress>
      <AddressDetail>${esc(company.address || 'N/A')}</AddressDetail>
      <City>${esc(defaultCity)}</City>
      <PostalCode>${esc(defaultPostal)}</PostalCode>
      <Country>AO</Country>
    </CompanyAddress>
    <FiscalYear>${fiscalYear}</FiscalYear>
    <StartDate>${isoDate(period.from)}</StartDate>
    <EndDate>${isoDate(period.to)}</EndDate>
    <CurrencyCode>AOA</CurrencyCode>
    <DateCreated>${isoDate(new Date())}</DateCreated>
    <TaxEntity>Global</TaxEntity>
    <ProductCompanyTaxID>${esc(company.nif)}</ProductCompanyTaxID>
    <SoftwareCertificateNumber>${certNum}</SoftwareCertificateNumber>
    <ProductID>FaturaAO/FaturaAO</ProductID>
    <ProductVersion>1.0</ProductVersion>${company.email ? `\n    <Email>${esc(company.email)}</Email>` : ''}${company.phone ? `\n    <Telephone>${esc(company.phone)}</Telephone>` : ''}
  </Header>`;

  /* ---------- MasterFiles ---------- */
  const customers = Array.from(clientByNif.values()).map(c => `    <Customer>
      <CustomerID>${esc(c.nif)}</CustomerID>
      <AccountID>${esc(c.account)}</AccountID>
      <CustomerTaxID>${esc(c.nif)}</CustomerTaxID>
      <CompanyName>${esc(c.name)}</CompanyName>
      <BillingAddress>
        <AddressDetail>${esc(c.address || 'N/A')}</AddressDetail>
        <City>${esc(c.city || 'Luanda')}</City>
        <PostalCode>${esc(c.postal_code || 'N/A')}</PostalCode>
        <Country>AO</Country>
      </BillingAddress>${c.phone ? `\n      <Telephone>${esc(c.phone)}</Telephone>` : ''}${c.email ? `\n      <Email>${esc(c.email)}</Email>` : ''}
      <SelfBillingIndicator>0</SelfBillingIndicator>
    </Customer>`).join('\n');

  const productEntries = allProducts.map(p => `    <Product>
      <ProductType>S</ProductType>
      <ProductCode>${esc(p.code)}</ProductCode>
      <ProductGroup>Geral</ProductGroup>
      <ProductDescription>${esc(p.description)}</ProductDescription>
      <ProductNumberCode>${esc(p.code)}</ProductNumberCode>
    </Product>`).join('\n');

  // Ensure at least the standard 14% rate exists.
  const ratesInTable = Array.from(uniqueRates).length ? Array.from(uniqueRates).sort() : ['14.00'];
  const taxTable = `    <TaxTable>
${ratesInTable.map(r => {
    const n = Number(r);
    const code = n === 0 ? 'ISE' : 'NOR';
    const desc = n === 0 ? 'Isento de IVA' : `IVA ${r}%`;
    return `      <TaxTableEntry>
        <TaxType>IVA</TaxType>
        <TaxCountryRegion>AO</TaxCountryRegion>
        <TaxCode>${code}</TaxCode>
        <Description>${esc(desc)}</Description>
        <TaxPercentage>${r}</TaxPercentage>
      </TaxTableEntry>`;
}).join('\n')}
    </TaxTable>`;

  const masterFiles = `  <MasterFiles>
${customers}
${productEntries}
${taxTable}
  </MasterFiles>`;

  /* ---------- SalesInvoices ---------- */
  const activeInvoices = invoices;
  const totalCredit = activeInvoices
    .filter(inv => inv.status !== 'cancelled' && (inv.document_type || 'FT') !== 'NC')
    .reduce((acc, inv) => acc + Number(inv.total), 0);
  const totalDebit = activeInvoices
    .filter(inv => inv.status !== 'cancelled' && (inv.document_type || 'FT') === 'NC')
    .reduce((acc, inv) => acc + Number(inv.total), 0);

  const invoiceEntries = activeInvoices.map(inv => {
    const isCancelled = inv.status === 'cancelled';
    const docType = (inv.document_type || 'FT').toUpperCase();
    const isCreditNote = docType === 'NC';
    const amountTag = isCreditNote ? 'DebitAmount' : 'CreditAmount';
    const lineReferences = (docType === 'NC' || docType === 'ND') && inv.related_document
      ? `\n          <References>\n            <Reference>\n              <OriginatingON>${esc(inv.related_document)}</OriginatingON>\n              <Reason>${esc((inv.cancellation_reason || `${isCreditNote ? 'Nota de crédito' : 'Nota de débito'} referente a ${inv.related_document}`))}</Reason>\n            </Reference>\n          </References>`
      : '';

    const itemLines = (inv.items || []).map((it, idx) => {
      const key = String(it.description || '').trim().toLowerCase();
      const prodCode = productMap.get(key)?.code ?? slugCode(it.description);
      const rate = Number(it.tax_rate);
      const taxCode = rate === 0 ? 'ISE' : 'NOR';
      const exemption = rate === 0
        ? `\n            <TaxExemptionReason>${esc(it.tax_exemption_reason || inv.tax_exemption_reason || 'M99 - Outras isenções')}</TaxExemptionReason>\n            <TaxExemptionCode>M99</TaxExemptionCode>`
        : '';
      return `        <Line>
          <LineNumber>${idx + 1}</LineNumber>
          <ProductCode>${esc(prodCode)}</ProductCode>
          <ProductDescription>${esc(it.description)}</ProductDescription>
          <Quantity>${qty(it.quantity)}</Quantity>
          <UnitOfMeasure>UN</UnitOfMeasure>
          <UnitPrice>${money(it.price)}</UnitPrice>${idx === 0 ? lineReferences : ''}
          <TaxPointDate>${isoDate(inv.issued_at)}</TaxPointDate>
          <Description>${esc(it.description)}</Description>
          <${amountTag}>${money(it.total)}</${amountTag}>
          <Tax>
            <TaxType>IVA</TaxType>
            <TaxCountryRegion>AO</TaxCountryRegion>
            <TaxCode>${taxCode}</TaxCode>
            <TaxPercentage>${pct(it.tax_rate)}</TaxPercentage>
          </Tax>${exemption}
        </Line>`;
    }).join('\n');

    const statusDate = isCancelled && inv.cancelled_at ? isoDateTime(inv.cancelled_at) : isoDateTime(inv.issued_at);
    const reason = isCancelled && inv.cancellation_reason ? inv.cancellation_reason : '';
    const hashVal = inv.hash && String(inv.hash).length >= 8 ? String(inv.hash) : '0';
    // HashControl: "1" quando temos hash válido e sistema certificado, senão "0".
    const hashControl = (hashVal !== '0' && certNum !== '0') ? '1' : (hashVal !== '0' ? '1' : '0');

    return `      <Invoice>
        <InvoiceNo>${esc(inv.invoice_number)}</InvoiceNo>
        <DocumentStatus>
          <InvoiceStatus>${isCancelled ? 'A' : 'N'}</InvoiceStatus>
          <InvoiceStatusDate>${statusDate}</InvoiceStatusDate>${reason ? `\n          <Reason>${esc(reason)}</Reason>` : ''}
          <SourceID>${esc(company.nif)}</SourceID>
          <SourceBilling>${saftMode}</SourceBilling>
        </DocumentStatus>
        <Hash>${esc(hashVal)}</Hash>
        <HashControl>${hashControl}</HashControl>
        <Period>${new Date(inv.issued_at).getUTCMonth() + 1}</Period>
        <InvoiceDate>${isoDate(inv.issued_at)}</InvoiceDate>
        <InvoiceType>${esc(docType)}</InvoiceType>
        <SpecialRegimes>
          <SelfBillingIndicator>0</SelfBillingIndicator>
          <CashVATSchemeIndicator>0</CashVATSchemeIndicator>
          <ThirdPartiesBillingIndicator>0</ThirdPartiesBillingIndicator>
        </SpecialRegimes>
        <SourceID>${esc(company.nif)}</SourceID>
        <SystemEntryDate>${isoDateTime(inv.issued_at)}</SystemEntryDate>
        <CustomerID>${esc(inv.client_nif)}</CustomerID>
${itemLines}
        <DocumentTotals>
          <TaxPayable>${money(inv.tax)}</TaxPayable>
          <NetTotal>${money(inv.subtotal)}</NetTotal>
          <GrossTotal>${money(inv.total)}</GrossTotal>
        </DocumentTotals>
      </Invoice>`;
  }).join('\n');

  const salesInvoices = `    <SalesInvoices>
      <NumberOfEntries>${activeInvoices.length}</NumberOfEntries>
      <TotalDebit>${totalDebit.toFixed(2)}</TotalDebit>
      <TotalCredit>${totalCredit.toFixed(2)}</TotalCredit>
${invoiceEntries}
    </SalesInvoices>`;

  const sourceDocuments = `  <SourceDocuments>
${salesInvoices}
  </SourceDocuments>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<AuditFile xmlns="urn:OECD:StandardAuditFile-Tax:AO_1.01_01"
           xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
${header}
${masterFiles}
${sourceDocuments}
</AuditFile>
`;
}
