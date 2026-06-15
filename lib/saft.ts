/**
 * SAF-T (AO) XML Generator — Angola / AGT compliant.
 *
 * Norma: SAF-T AO v1.01_01 — Administração Geral Tributária de Angola (AGT).
 *
 * BUGS CORRIGIDOS (v2 — auditoria 2026-06):
 *   - HashControl: agora reflecte correctamente a versão do esquema de assinatura.
 *     Valor '1' = sistema certificado (certNum > 0); '0' = não certificado.
 *   - isoDateTime: mantém o sufixo 'Z' (xs:dateTime com UTC explícito) — XSD AGT.
 *   - <References> aplicado em TODAS as linhas de NC/ND, não só na linha 0.
 *   - <TaxAmount> adicionado em cada <Line><Tax> (valor em AOA).
 *   - ProductType: usa campo product_type da BD ('P'=produto, 'S'=serviço, etc.).
 *   - TaxExemptionCode: usa códigos legais reais (M01-M19) em vez de M99.
 *   - isoDateTime: corrigida para preservar 'Z' (timezone UTC obrigatória no XSD).
 *   - UnitOfMeasure: usa campo unit_of_measure da BD quando disponível.
 *   - SourceID nas faturas: usa NIF da empresa (campo obrigatório, identificador do emitente).
 *   - <Supplier> adicionado em MasterFiles quando existem fornecedores.
 *   - TotalCredit/Debit: exclui PP e GT (pertencem a WorkingDocuments).
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

/**
 * FIX: Mantém 'Z' para indicar UTC explicitamente — xs:dateTime do XSD AGT
 * O original removia o Z, resultando em timestamp sem timezone (inválido).
 */
function isoDateTime(v: unknown): string {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v as string);
  if (isNaN(d.getTime())) return '';
  // Formato: "2025-01-15T10:30:00Z" (retém Z para timezone UTC explícita)
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** FNV-1a short hash — used to disambiguate product codes. */
function shortHash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16).toUpperCase().padStart(8, '0').slice(0, 6);
}

/** Deterministic, stable product code derived from description. */
function slugCode(name: string): string {
  const clean = String(name || 'ITEM')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 18);
  const base = clean || 'ITEM';
  return `${base}-${shortHash(String(name || 'ITEM').toLowerCase())}`;
}

/**
 * Mapa de códigos de isenção de IVA Angola (AGT).
 * M99 foi substituído por códigos reais conforme legislação angolana.
 */
const EXEMPTION_CODES: Record<string, { code: string; reason: string }> = {
  'exportacao':     { code: 'M01', reason: 'M01 - Exportação' },
  'export':         { code: 'M01', reason: 'M01 - Exportação' },
  'educacao':       { code: 'M04', reason: 'M04 - Educação' },
  'saude':          { code: 'M06', reason: 'M06 - Saúde e serviços médicos' },
  'estado':         { code: 'M07', reason: 'M07 - Estado e entidades públicas' },
  'financeiro':     { code: 'M08', reason: 'M08 - Serviços financeiros' },
  'agricola':       { code: 'M09', reason: 'M09 - Produtos agrícolas básicos' },
  'diplomatico':    { code: 'M10', reason: 'M10 - Missões diplomáticas' },
  'default':        { code: 'M19', reason: 'M19 - Outras isenções previstas em legislação' },
};

function getExemptionInfo(reason?: string | null): { code: string; reason: string } {
  if (!reason) return EXEMPTION_CODES['default'];
  const lower = reason.toLowerCase();
  for (const [key, val] of Object.entries(EXEMPTION_CODES)) {
    if (key !== 'default' && lower.includes(key)) return val;
  }
  // Se for um código M01-M19 já formatado, usa directamente
  const match = reason.match(/^(M\d{2})\s*[-—]/);
  if (match) return { code: match[1], reason };
  return EXEMPTION_CODES['default'];
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
  business_name?: string | null;
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
  country?: string | null;
}

export interface SaftSupplier {
  id: string;
  name: string;
  nif?: string | null;
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
  /** 'P'=Produto, 'S'=Serviço, 'O'=Outros, 'E'=Encargo, 'I'=Imposto. Default: 'S' */
  product_type?: string | null;
}

export interface SaftInvoiceItem {
  description: string;
  quantity: number | string;
  price: number | string;
  tax_rate: number | string;
  total: number | string;
  tax_exemption_reason?: string | null;
  unit_of_measure?: string | null;
  discount?: number | string | null;
}

export interface SaftInvoice {
  invoice_number: string;
  document_type: string;
  issued_at: string | Date;
  status: 'issued' | 'cancelled' | string;
  cancellation_reason?: string | null;
  cancelled_at?: string | Date | null;
  /** Name or ID of the operator who issued the document (AGT §4.1.4.3 SourceID) */
  operator_name?: string | null;
  subtotal: number | string;
  tax: number | string;
  total: number | string;
  /** Discount amount in AOA (for Settlement element) */
  discount?: number | string | null;
  hash?: string | null;
  previous_hash?: string | null;
  signature?: string | null;
  client_nif: string;
  client_name: string;
  related_document?: string | null;
  original_invoice_number?: string | null;
  original_issued_at?: string | Date | null;
  tax_exempt?: boolean;
  tax_exemption_reason?: string | null;
  retention_tax?: number | string | null;
  items: SaftInvoiceItem[];
}

export interface SaftInput {
  company: SaftCompany;
  period: { from: Date; to: Date };
  clients: SaftClient[];
  products: SaftProduct[];
  invoices: SaftInvoice[];
  suppliers?: SaftSupplier[];
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
  const suppliers = input.suppliers ?? [];
  const saftMode = input.saftMode === 'teste' ? 'T' : 'P';
  const certNumRaw = Number(input.certificateNumber);
  const certNum = Number.isFinite(certNumRaw) && certNumRaw > 0 ? String(Math.trunc(certNumRaw)) : '0';
  const businessName = (input.businessName || company.business_name || company.name || '').slice(0, 60);
  const fiscalYear = period.from.getUTCFullYear();
  const defaultCity = company.city || 'Luanda';
  const defaultPostal = company.postal_code || 'N/A';

  /**
   * FIX HashControl:
   * O campo HashControl indica a versão do esquema de assinatura RSA usado.
   * - '1' = sistema certificado pela AGT (certNum > 0), usa RSA-SHA256
   * - '0' = sistema não certificado ou sem assinatura digital
   * O valor NÃO depende da presença de hash — depende da certificação.
   */
  const hashControlVersion = certNum !== '0' ? '1' : '0';

  /* ---------- Products: deterministic codes, unique per description ---------- */
  const productMap = new Map<string, { code: string; description: string; taxRate: number; productType: string }>();
  const codeInUse = new Set<string>();
  const registerProduct = (desc: string, taxRate: number, explicitCode?: string, productType?: string) => {
    const key = String(desc || '').trim().toLowerCase();
    if (!key) return null;
    if (productMap.has(key)) return productMap.get(key)!;
    let code = explicitCode && String(explicitCode).trim() ? String(explicitCode).trim() : slugCode(desc);
    if (codeInUse.has(code)) code = `${code}-${shortHash(key)}`;
    codeInUse.add(code);
    const entry = { code, description: desc, taxRate, productType: productType || 'S' };
    productMap.set(key, entry);
    return entry;
  };
  for (const p of products) {
    registerProduct(
      p.description || p.name,
      Number(p.tax_rate ?? 14),
      p.code ?? undefined,
      p.product_type ?? 'S',
    );
  }
  const uniqueRates = new Set<string>();
  for (const inv of invoices) {
    for (const it of inv.items ?? []) {
      registerProduct(it.description, Number(it.tax_rate ?? 14));
      uniqueRates.add(pct(it.tax_rate));
    }
  }
  const allProducts = Array.from(productMap.values());

  /* ---------- Clients: keyed by NIF ---------- */
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
        address: null, email: null, phone: null,
        city: null, postal_code: null, country: 'AO',
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
    <ProductVersion>2.0</ProductVersion>${company.email ? `\n    <Email>${esc(company.email)}</Email>` : ''}${company.phone ? `\n    <Telephone>${esc(company.phone)}</Telephone>` : ''}
  </Header>`;

  /* ---------- MasterFiles — Customers ---------- */
  const customers = Array.from(clientByNif.values()).map(c => `    <Customer>
      <CustomerID>${esc(c.nif)}</CustomerID>
      <AccountID>${esc(c.account)}</AccountID>
      <CustomerTaxID>${esc(c.nif)}</CustomerTaxID>
      <CompanyName>${esc(c.name)}</CompanyName>
      <BillingAddress>
        <AddressDetail>${esc(c.address || 'N/A')}</AddressDetail>
        <City>${esc(c.city || 'Luanda')}</City>
        <PostalCode>${esc(c.postal_code || 'N/A')}</PostalCode>
        <Country>${esc(c.country || 'AO')}</Country>
      </BillingAddress>${c.phone ? `\n      <Telephone>${esc(c.phone)}</Telephone>` : ''}${c.email ? `\n      <Email>${esc(c.email)}</Email>` : ''}
      <SelfBillingIndicator>0</SelfBillingIndicator>
    </Customer>`).join('\n');

  /* ---------- MasterFiles — Suppliers (FIX: adicionado) ---------- */
  const supplierEntries = suppliers.length > 0
    ? suppliers.map(s => `    <Supplier>
      <SupplierID>${esc(s.nif || s.id)}</SupplierID>
      <AccountID>Fornecedor</AccountID>
      <SupplierTaxID>${esc(s.nif || '999999999')}</SupplierTaxID>
      <CompanyName>${esc(s.name)}</CompanyName>
      <BillingAddress>
        <AddressDetail>${esc(s.address || 'N/A')}</AddressDetail>
        <City>${esc(s.city || 'Luanda')}</City>
        <PostalCode>${esc(s.postal_code || 'N/A')}</PostalCode>
        <Country>AO</Country>
      </BillingAddress>${s.phone ? `\n      <Telephone>${esc(s.phone)}</Telephone>` : ''}${s.email ? `\n      <Email>${esc(s.email)}</Email>` : ''}
      <SelfBillingIndicator>0</SelfBillingIndicator>
    </Supplier>`).join('\n')
    : '';

  /* ---------- MasterFiles — Products (FIX: ProductType usa campo BD) ---------- */
  const productEntries = allProducts.map(p => `    <Product>
      <ProductType>${esc(p.productType || 'S')}</ProductType>
      <ProductCode>${esc(p.code)}</ProductCode>
      <ProductGroup>Geral</ProductGroup>
      <ProductDescription>${esc(p.description)}</ProductDescription>
      <ProductNumberCode>${esc(p.code)}</ProductNumberCode>
    </Product>`).join('\n');

  /* ---------- TaxTable ---------- */
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
${supplierEntries}
${productEntries}
${taxTable}
  </MasterFiles>`;

  /* ---------- SalesInvoices (FT, FR, NC, ND, VD, TV, TD, AA, DA) ---------- */
  // AGT: RC (Recibos de pagamento) pertencem a <Payments>, não a SalesInvoices
  const SALES_TYPES  = new Set(['FT', 'FR', 'NC', 'ND', 'VD', 'TV', 'TD', 'AA', 'DA']);
  const PAYMENT_TYPES = new Set(['RC']);
  const salesInvoicesList  = invoices.filter(inv => SALES_TYPES.has((inv.document_type || 'FT').toUpperCase()));
  const paymentsList       = invoices.filter(inv => PAYMENT_TYPES.has((inv.document_type || '').toUpperCase()));

  const totalCredit = salesInvoicesList
    .filter(inv => inv.status !== 'cancelled' && (inv.document_type || 'FT').toUpperCase() !== 'NC')
    .reduce((acc, inv) => acc + Number(inv.total), 0);
  const totalDebit = salesInvoicesList
    .filter(inv => inv.status !== 'cancelled' && (inv.document_type || 'FT').toUpperCase() === 'NC')
    .reduce((acc, inv) => acc + Number(inv.total), 0);

  const invoiceEntries = salesInvoicesList.map(inv => {
    const isCancelled = inv.status === 'cancelled';
    const docType = (inv.document_type || 'FT').toUpperCase();
    const isCreditNote = docType === 'NC';
    const isDebitNote = docType === 'ND';
    const amountTag = isCreditNote ? 'DebitAmount' : 'CreditAmount';
    const hashVal = inv.signature || (inv.hash && String(inv.hash).length >= 8 ? String(inv.hash) : '0');

    // Mapeia os items. Se for uma fatura cancelada sem itens (dados de teste órfãos), gera um item fictício
    const safeItems = (inv.items && inv.items.length > 0) ? inv.items : (isCancelled ? [{
      description: 'Anulação de documento',
      quantity: 1,
      price: Number(inv.subtotal) || 0,
      discount: 0,
      tax_rate: Number(inv.tax) > 0 ? 14 : 0,
      tax_exemption_reason: inv.tax_exemption_reason || 'M04',
      unit_of_measure: 'UN'
    }] : []);

    const itemLines = safeItems.map((it: any, idx: number) => {
      const key = String(it.description || '').trim().toLowerCase();
      const prodCode = productMap.get(key)?.code ?? slugCode(it.description);
      const qtyNum = Number(it.quantity);
      const priceNum = Number(it.price);
      const discountAmt = Number(it.discount || 0);
      const rate = Number(it.tax_rate);
      const taxCode = rate === 0 ? 'ISE' : 'NOR';
      
      const lineNet = +(qtyNum * priceNum - discountAmt).toFixed(2);
      const taxAmount = +(lineNet * (rate / 100)).toFixed(2);

      // FIX: TaxExemptionCode — usar códigos legais M01-M19 em vez de M99
      const exemptionInfo = rate === 0
        ? getExemptionInfo(it.tax_exemption_reason || inv.tax_exemption_reason)
        : null;
      const exemption = exemptionInfo
        ? `\n            <TaxExemptionReason>${esc(exemptionInfo.reason)}</TaxExemptionReason>\n            <TaxExemptionCode>${esc(exemptionInfo.code)}</TaxExemptionCode>`
        : '';

      // FIX: <References> em TODAS as linhas de NC/ND, não só na linha 0
      const hasRef = (isCreditNote || isDebitNote) && inv.related_document;
      const origOn = inv.original_invoice_number || inv.related_document;
      const lineReferences = hasRef
        ? `\n          <References>\n            <Reference>\n              <OriginatingON>${esc(origOn)}</OriginatingON>\n              <Reason>${esc(inv.cancellation_reason || `${isCreditNote ? 'Nota de crédito' : 'Nota de débito'} referente a ${origOn}`)}</Reason>\n            </Reference>\n          </References>`
        : '';

      // FIX: UnitOfMeasure usa campo da BD quando disponível
      const unitMeasure = it.unit_of_measure || 'UN';

      return `        <Line>
          <LineNumber>${idx + 1}</LineNumber>
          <ProductCode>${esc(prodCode)}</ProductCode>
          <ProductDescription>${esc(it.description)}</ProductDescription>
          <Quantity>${qty(it.quantity)}</Quantity>
          <UnitOfMeasure>${esc(unitMeasure)}</UnitOfMeasure>
          <UnitPrice>${money(it.price)}</UnitPrice>${lineReferences}
          <TaxPointDate>${isoDate(inv.issued_at)}</TaxPointDate>
          <Description>${esc(it.description)}</Description>
          <${amountTag}>${money(lineNet)}</${amountTag}>${discountAmt > 0 ? `\n          <SettlementAmount>${money(discountAmt)}</SettlementAmount>` : ''}
          <Tax>
            <TaxType>IVA</TaxType>
            <TaxCountryRegion>AO</TaxCountryRegion>
            <TaxCode>${taxCode}</TaxCode>
            <TaxPercentage>${pct(it.tax_rate)}</TaxPercentage>
            <TaxAmount>${money(taxAmount)}</TaxAmount>
          </Tax>${exemption}
        </Line>`;
    }).join('\n');

    // FIX: isoDateTime agora retorna "2025-01-15T10:30:00Z" (com Z)
    const statusDate = isCancelled && inv.cancelled_at
      ? isoDateTime(inv.cancelled_at)
      : isoDateTime(inv.issued_at);
    const reason = isCancelled && inv.cancellation_reason ? inv.cancellation_reason : '';

    return `      <Invoice>
        <InvoiceNo>${esc(inv.invoice_number)}</InvoiceNo>
        <DocumentStatus>
          <InvoiceStatus>${isCancelled ? 'A' : 'N'}</InvoiceStatus>
          <InvoiceStatusDate>${statusDate}</InvoiceStatusDate>${reason ? `\n          <Reason>${esc(reason)}</Reason>` : ''}
          <SourceID>${esc(inv.operator_name || company.nif)}</SourceID>
          <SourceBilling>${saftMode}</SourceBilling>
        </DocumentStatus>
        <Hash>${esc(hashVal)}</Hash>
        <HashControl>${hashControlVersion}</HashControl>
        <Period>${new Date(inv.issued_at).getUTCMonth() + 1}</Period>
        <InvoiceDate>${isoDate(inv.issued_at)}</InvoiceDate>
        <InvoiceType>${esc(docType)}</InvoiceType>
        <SpecialRegimes>
          <SelfBillingIndicator>0</SelfBillingIndicator>
          <CashVATSchemeIndicator>0</CashVATSchemeIndicator>
          <ThirdPartiesBillingIndicator>0</ThirdPartiesBillingIndicator>
        </SpecialRegimes>
        <SourceID>${esc(inv.operator_name || company.nif)}</SourceID>
        <SystemEntryDate>${isoDateTime(inv.issued_at)}</SystemEntryDate>
        <CustomerID>${esc(inv.client_nif)}</CustomerID>
${itemLines}
        <DocumentTotals>
          <TaxPayable>${money(inv.tax)}</TaxPayable>
          <NetTotal>${money(inv.subtotal)}</NetTotal>
          <GrossTotal>${money(inv.total)}</GrossTotal>${Number(inv.retention_tax) > 0 ? `\n          <WithholdingTax>\n            <WithholdingTaxType>IRT</WithholdingTaxType>\n            <WithholdingTaxDescription>Retenção na fonte</WithholdingTaxDescription>\n            <WithholdingTaxAmount>${money(inv.retention_tax)}</WithholdingTaxAmount>\n          </WithholdingTax>` : ''}
        </DocumentTotals>
      </Invoice>`;
  }).join('\n');

  /* ---------- WorkingDocuments (PP, OR) ---------- */
  const WORK_TYPES = new Set(['PP', 'OR']);
  const workingList = invoices.filter(inv => WORK_TYPES.has((inv.document_type || '').toUpperCase()));
  const totalWorkingCredit = workingList
    .filter(inv => inv.status !== 'cancelled')
    .reduce((acc, inv) => acc + Number(inv.total), 0);

  const workEntries = workingList.map(inv => {
    const isCancelled = inv.status === 'cancelled';
    const docType = (inv.document_type || 'PP').toUpperCase();
    const hashVal = inv.signature || (inv.hash && String(inv.hash).length >= 8 ? String(inv.hash) : '0');

    const itemLines = (inv.items || []).map((it, idx) => {
      const key = String(it.description || '').trim().toLowerCase();
      const prodCode = productMap.get(key)?.code ?? slugCode(it.description);
      const qtyNum = Number(it.quantity);
      const priceNum = Number(it.price);
      const discountAmt = Number(it.discount || 0);
      const rate = Number(it.tax_rate);
      const taxCode = rate === 0 ? 'ISE' : 'NOR';
      
      const lineNet = +(qtyNum * priceNum - discountAmt).toFixed(2);
      const taxAmount = +(lineNet * (rate / 100)).toFixed(2);

      const exemptionInfo = rate === 0 ? getExemptionInfo(it.tax_exemption_reason || inv.tax_exemption_reason) : null;
      const exemption = exemptionInfo
        ? `\n            <TaxExemptionReason>${esc(exemptionInfo.reason)}</TaxExemptionReason>\n            <TaxExemptionCode>${esc(exemptionInfo.code)}</TaxExemptionCode>`
        : '';
      const unitMeasure = it.unit_of_measure || 'UN';

      return `        <Line>
          <LineNumber>${idx + 1}</LineNumber>
          <ProductCode>${esc(prodCode)}</ProductCode>
          <ProductDescription>${esc(it.description)}</ProductDescription>
          <Quantity>${qty(it.quantity)}</Quantity>
          <UnitOfMeasure>${esc(unitMeasure)}</UnitOfMeasure>
          <UnitPrice>${money(it.price)}</UnitPrice>
          <TaxPointDate>${isoDate(inv.issued_at)}</TaxPointDate>
          <Description>${esc(it.description)}</Description>
          <CreditAmount>${money(lineNet)}</CreditAmount>${discountAmt > 0 ? `\n          <SettlementAmount>${money(discountAmt)}</SettlementAmount>` : ''}
          <Tax>
            <TaxType>IVA</TaxType>
            <TaxCountryRegion>AO</TaxCountryRegion>
            <TaxCode>${taxCode}</TaxCode>
            <TaxPercentage>${pct(it.tax_rate)}</TaxPercentage>
            <TaxAmount>${money(taxAmount)}</TaxAmount>
          </Tax>${exemption}
        </Line>`;
    }).join('\n');

    const statusDate = isCancelled && inv.cancelled_at ? isoDateTime(inv.cancelled_at) : isoDateTime(inv.issued_at);
    const reason = isCancelled && inv.cancellation_reason ? inv.cancellation_reason : '';

    return `      <WorkDocument>
        <DocumentNumber>${esc(inv.invoice_number)}</DocumentNumber>
        <DocumentStatus>
          <WorkStatus>${isCancelled ? 'A' : 'N'}</WorkStatus>
          <WorkStatusDate>${statusDate}</WorkStatusDate>${reason ? `\n          <Reason>${esc(reason)}</Reason>` : ''}
          <SourceID>${esc(inv.operator_name || company.nif)}</SourceID>
          <SourceBilling>${saftMode}</SourceBilling>
        </DocumentStatus>
        <Hash>${esc(hashVal)}</Hash>
        <HashControl>${hashControlVersion}</HashControl>
        <Period>${new Date(inv.issued_at).getUTCMonth() + 1}</Period>
        <WorkDate>${isoDate(inv.issued_at)}</WorkDate>
        <WorkType>${esc(docType)}</WorkType>
        <SourceID>${esc(inv.operator_name || company.nif)}</SourceID>
        <SystemEntryDate>${isoDateTime(inv.issued_at)}</SystemEntryDate>
        <CustomerID>${esc(inv.client_nif)}</CustomerID>
${itemLines}
        <DocumentTotals>
          <TaxPayable>${money(inv.tax)}</TaxPayable>
          <NetTotal>${money(inv.subtotal)}</NetTotal>
          <GrossTotal>${money(inv.total)}</GrossTotal>
        </DocumentTotals>
      </WorkDocument>`;
  }).join('\n');

  /* ---------- Payments (RC — Recibos) --- AGT: secção separada ---------- */
  const paymentEntries = paymentsList.map(inv => {
    const isCancelled = inv.status === 'cancelled';
    const hashVal = inv.signature || (inv.hash && String(inv.hash).length >= 8 ? String(inv.hash) : '0');
    return `      <Payment>
        <PaymentRefNo>${esc(inv.invoice_number)}</PaymentRefNo>
        <Period>${new Date(inv.issued_at).getUTCMonth() + 1}</Period>
        <TransactionDate>${isoDate(inv.issued_at)}</TransactionDate>
        <PaymentType>RC</PaymentType>
        <Description>Recibo de pagamento</Description>
        <SystemEntryDate>${isoDateTime(inv.issued_at)}</SystemEntryDate>
        <CustomerID>${esc(inv.client_nif || '000000000')}</CustomerID>
        <DocumentStatus>
          <PaymentStatus>${isCancelled ? 'A' : 'N'}</PaymentStatus>
          <PaymentStatusDate>${isCancelled && inv.cancelled_at ? isoDateTime(inv.cancelled_at) : isoDateTime(inv.issued_at)}</PaymentStatusDate>${
            isCancelled && inv.cancellation_reason ? `\n          <Reason>${esc(inv.cancellation_reason)}</Reason>` : ''}
          <SourceID>${esc(inv.operator_name || company.nif)}</SourceID>
          <SourcePayment>${saftMode}</SourcePayment>
        </DocumentStatus>
        <SourceID>${esc(inv.operator_name || company.nif)}</SourceID>
        <Hash>${esc(hashVal)}</Hash>
        <HashControl>${hashControlVersion}</HashControl>
        <Line>
          <LineNumber>1</LineNumber>
          <SourceDocumentID>
            <OriginatingON>${esc(inv.original_invoice_number || inv.related_document || inv.invoice_number)}</OriginatingON>
            <InvoiceDate>${isoDate(inv.original_issued_at || inv.issued_at)}</InvoiceDate>
          </SourceDocumentID>
          <SettlementAmount>${money(inv.total)}</SettlementAmount>
          <CreditAmount>${money(inv.total)}</CreditAmount>
          <Tax>
            <TaxType>IVA</TaxType>
            <TaxCountryRegion>AO</TaxCountryRegion>
            <TaxCode>NOR</TaxCode>
            <TaxPercentage>${pct(14)}</TaxPercentage>
            <TaxAmount>${money(Number(inv.tax))}</TaxAmount>
          </Tax>
        </Line>
        <DocumentTotals>
          <TaxPayable>${money(inv.tax)}</TaxPayable>
          <NetTotal>${money(inv.subtotal)}</NetTotal>
          <GrossTotal>${money(inv.total)}</GrossTotal>
        </DocumentTotals>
      </Payment>`;
  }).join('\n');

  const salesInvoices = `    <SalesInvoices>
      <NumberOfEntries>${salesInvoicesList.length}</NumberOfEntries>
      <TotalDebit>${totalDebit.toFixed(2)}</TotalDebit>
      <TotalCredit>${totalCredit.toFixed(2)}</TotalCredit>
${invoiceEntries}
    </SalesInvoices>${workingList.length > 0 ? `\n    <WorkingDocuments>\n      <NumberOfEntries>${workingList.length}</NumberOfEntries>\n      <TotalDebit>0.00</TotalDebit>\n      <TotalCredit>${totalWorkingCredit.toFixed(2)}</TotalCredit>\n${workEntries}\n    </WorkingDocuments>` : ''}${paymentsList.length > 0 ? `\n    <Payments>\n      <NumberOfEntries>${paymentsList.length}</NumberOfEntries>\n      <TotalDebit>0.00</TotalDebit>\n      <TotalCredit>${paymentsList.filter(p => p.status !== 'cancelled').reduce((s, p) => s + Number(p.total), 0).toFixed(2)}</TotalCredit>\n${paymentEntries}\n    </Payments>` : ''}`;

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
