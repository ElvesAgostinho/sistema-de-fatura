/**
 * Ficheiro XML de Comunicação de Inventários — Angola / AGT.
 *
 * Estrutura: StockFile:AO:1.01_01
 */

function esc(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function qty(v: unknown): string {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n.toFixed(3) : '0.000';
}

function money(v: unknown): string {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
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

export type InventoryCompanyInfo = {
  nif: string;
};

export type InventoryProduct = {
  id: string;
  name: string;
  code?: string;
  product_type?: string;
  unit_of_measure?: string;
  quantity_in_stock: number;
  price: number; 
};

export function buildSaftInventoryXml(
  company: InventoryCompanyInfo,
  year: number,
  products: InventoryProduct[]
): string {
  const endOfYear = `${year}-12-31`;
  
  // Apenas reportar produtos com stock > 0
  const stockItems = products.filter(p => p.quantity_in_stock && p.quantity_in_stock > 0);
  const hasStock = stockItems.length > 0;

  const lines: string[] = [];
  lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  lines.push(`<StockFile xmlns="urn:StockFile:AO:1.01_01">`);
  
  // --- Header ---
  lines.push(`  <StockHeader>`);
  lines.push(`    <FileVersion>1.01_01</FileVersion>`);
  lines.push(`    <TaxRegistrationNumber>${esc(company.nif)}</TaxRegistrationNumber>`);
  lines.push(`    <FiscalYear>${year}</FiscalYear>`);
  lines.push(`    <EndDate>${endOfYear}</EndDate>`);
  lines.push(`    <NoStock>${hasStock ? 'false' : 'true'}</NoStock>`);
  lines.push(`  </StockHeader>`);

  // --- Items ---
  if (hasStock) {
    for (const p of stockItems) {
      const prodCode = p.code || slugCode(p.name);
      
      const pType = p.product_type || 'M';
      let category = 'M';
      if (pType === 'M') category = 'M';
      else if (pType === 'P') category = 'P'; // Matérias-primas
      else if (pType === 'A') category = 'A'; // Produtos Acabados
      else category = 'M';

      const stockQuantity = Number(p.quantity_in_stock || 0);
      const stockValue = stockQuantity * Number(p.price || 0);

      lines.push(`  <Stock>`);
      lines.push(`    <ProductCategory>${category}</ProductCategory>`);
      lines.push(`    <ProductCode>${esc(prodCode)}</ProductCode>`);
      lines.push(`    <ProductDescription>${esc(p.name)}</ProductDescription>`);
      lines.push(`    <ProductNumberCode>${esc(prodCode)}</ProductNumberCode>`);
      lines.push(`    <ClosingStockQuantity>${qty(stockQuantity)}</ClosingStockQuantity>`);
      lines.push(`    <UnitOfMeasure>${esc(p.unit_of_measure || 'Unidade')}</UnitOfMeasure>`);
      lines.push(`    <ClosingStockValue>${money(stockValue)}</ClosingStockValue>`);
      lines.push(`  </Stock>`);
    }
  }

  lines.push(`</StockFile>`);
  
  return lines.join('\n');
}
