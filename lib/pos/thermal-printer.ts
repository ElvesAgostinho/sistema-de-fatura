/**
 * Thermal Printer — ESC/POS via Web Serial API
 *
 * Supports USB and Bluetooth thermal printers that implement ESC/POS protocol:
 * Epson TM-T20, Bixolon SRP-350, Star Micronics, Citizen CT-S, etc.
 *
 * Falls back to window.print() with thermal CSS if no serial port available.
 *
 * AGT Angola Compliance:
 * - Portaria 242/13 — texto obrigatório no rodapé
 * - Hash dos 4 primeiros caracteres
 * - IVA por taxa variável
 * - Identificação do operador e terminal
 */

declare global {
  interface SerialPort {
    open(options: { baudRate: number }): Promise<void>;
    close(): Promise<void>;
    writable: WritableStream<Uint8Array> | null;
    readable: ReadableStream<Uint8Array> | null;
  }
  interface Navigator {
    serial: { requestPort(): Promise<SerialPort> };
  }
}

// ESC/POS command constants
const ESC = 0x1b;
const GS  = 0x1d;
const LF  = 0x0a;
const INIT          = [ESC, 0x40];
const ALIGN_LEFT    = [ESC, 0x61, 0x00];
const ALIGN_CENTER  = [ESC, 0x61, 0x01];
const BOLD_ON       = [ESC, 0x45, 0x01];
const BOLD_OFF      = [ESC, 0x45, 0x00];
const DOUBLE_HEIGHT = [ESC, 0x21, 0x10];
const NORMAL_SIZE   = [ESC, 0x21, 0x00];
const CUT_PAPER     = [GS, 0x56, 0x42, 0x00];

function textToBytes(text: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    bytes.push(code > 255 ? 0x3f : code);
  }
  return bytes;
}

function line(text: string, width = 48): number[] {
  return [...textToBytes(text.padEnd(width).slice(0, width)), LF];
}

function divider(char = '-', width = 48): number[] {
  return [...textToBytes(char.repeat(width)), LF];
}

function twoCol(left: string, right: string, width = 48): number[] {
  const r = right.slice(0, 18);
  const l = left.slice(0, width - r.length - 1).padEnd(width - r.length - 1);
  return [...textToBytes(`${l} ${r}`), LF];
}

export interface ReceiptData {
  companyName: string;
  companyNif: string;
  companyAddress?: string;
  companyCity?: string;
  invoiceNumber: string;
  documentType?: string;       // FR, FT, NC, ND — default FR
  issuedAt: string;
  cashierName?: string;        // Nome do operador
  terminalName?: string;       // Nome do terminal/caixa
  hash?: string;               // Hash AGT (4 primeiros chars exibidos)
  certificateNumber?: string;  // Nº certificação AGT
  items: Array<{
    name: string;
    qty: number;
    price: number;
    total: number;
    tax_rate?: number;         // Taxa IVA por artigo (default 14)
  }>;
  subtotal: number;
  tax: number;
  total: number;
  taxLines?: Array<{ rate: number; base: number; amount: number }>; // IVA por taxa
  paymentMethod: string;
  amountTendered?: number;
  change?: number;
  clientName?: string;
  clientNif?: string;
  footer?: string;
  // Z-Report mode (for end-of-day closing)
  zReport?: {
    zNumber: number;
    terminalName: string;
    openedAt: string;
    closedAt: string;
    openedByEmail: string;
    openingBalance: number;
    closingBalance: number;
    totalCash: number;
    totalMulticaixa: number;
    totalTpa: number;
    totalCredit: number;
    totalSales: number;
    salesCount: number;
    taxTotal: number;
    difference: number;
  };
}

const fmt = (n: number) => `${n.toLocaleString('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kz`;

export function buildReceiptCommands(data: ReceiptData): Uint8Array {
  const bytes: number[] = [];
  const push = (...cmds: number[][]) => cmds.forEach(c => bytes.push(...c));

  push(INIT);

  if (data.zReport) {
    // ── Z-REPORT MODE ──────────────────────────────────────────────────────
    const z = data.zReport;
    push(ALIGN_CENTER, BOLD_ON, DOUBLE_HEIGHT);
    push(line(data.companyName));
    push(NORMAL_SIZE, BOLD_OFF);
    push(line(`NIF: ${data.companyNif}`));
    push([LF]);
    push(BOLD_ON, DOUBLE_HEIGHT);
    push(line(`Z-REPORT Nº ${String(z.zNumber).padStart(4, '0')}`));
    push(NORMAL_SIZE, BOLD_OFF);
    push(divider('='));
    push(ALIGN_LEFT);
    push(line(`Terminal: ${z.terminalName}`));
    push(line(`Operador: ${z.openedByEmail}`));
    push(line(`Abertura: ${new Date(z.openedAt).toLocaleString('pt-AO')}`));
    push(line(`Fecho:    ${new Date(z.closedAt).toLocaleString('pt-AO')}`));
    push(divider());
    push(BOLD_ON);
    push(line('RESUMO DE VENDAS'));
    push(BOLD_OFF);
    push(twoCol('Nº Transacções:', String(z.salesCount)));
    push(divider());
    push(twoCol('Dinheiro:', fmt(z.totalCash)));
    push(twoCol('Multicaixa:', fmt(z.totalMulticaixa)));
    push(twoCol('TPA:', fmt(z.totalTpa)));
    push(twoCol('Crédito:', fmt(z.totalCredit)));
    push(divider());
    push(BOLD_ON);
    push(twoCol('TOTAL VENDAS:', fmt(z.totalSales)));
    push(BOLD_OFF);
    push(twoCol('IVA Total:', fmt(z.taxTotal)));
    push(divider('='));
    push(line('RECONCILIAÇÃO DE CAIXA'));
    push(twoCol('Fundo abertura:', fmt(z.openingBalance)));
    push(twoCol('+ Dinheiro:', fmt(z.totalCash)));
    push(twoCol('= Esperado:', fmt(z.openingBalance + z.totalCash)));
    push(twoCol('Declarado:', fmt(z.closingBalance)));
    const diff = z.difference;
    push(BOLD_ON);
    push(twoCol('Diferença:', `${diff >= 0 ? '+' : ''}${fmt(diff)}`));
    push(BOLD_OFF);
    push(divider('='));
    push(ALIGN_CENTER);
    push(line('DOCUMENTO PROCESSADO POR'));
    push(line('PROGRAMA CERTIFICADO'));
    if (data.certificateNumber) push(line(`Certificado AGT Nr ${data.certificateNumber}`));
    push(line('FaturaAO · rapido.topconsultores.pt'));
    push([LF, LF, LF]);
    push(CUT_PAPER);
    return new Uint8Array(bytes);
  }

  // ── RECEIPT MODE ────────────────────────────────────────────────────────────
  push(ALIGN_CENTER, BOLD_ON, DOUBLE_HEIGHT);
  push(line(data.companyName));
  push(NORMAL_SIZE, BOLD_OFF);
  push(line(`NIF: ${data.companyNif}`));
  if (data.companyAddress) push(line(data.companyAddress));
  if (data.companyCity) push(line(data.companyCity));
  push([LF]);

  const docLabel = data.documentType === 'FT' ? 'FACTURA' : data.documentType === 'NC' ? 'NOTA CRÉDITO' : 'FACTURA RECIBO';
  push(ALIGN_LEFT, BOLD_ON);
  push(line(`${docLabel}: ${data.invoiceNumber}`));
  push(BOLD_OFF);
  push(line(`Data: ${new Date(data.issuedAt).toLocaleString('pt-AO')}`));
  if (data.terminalName) push(line(`Terminal: ${data.terminalName}`));
  if (data.cashierName)  push(line(`Operador: ${data.cashierName}`));
  if (data.clientName)   push(line(`Cliente: ${data.clientName}`));
  if (data.clientNif)    push(line(`NIF Cliente: ${data.clientNif}`));
  push(divider());

  // Items
  for (const item of data.items) {
    push(line(item.name.slice(0, 32)));
    const taxNote = item.tax_rate != null ? ` (IVA ${item.tax_rate}%)` : '';
    push(twoCol(`  ${item.qty}x ${fmt(item.price)}${taxNote}`, fmt(item.total)));
  }
  push(divider());

  // Totals — IVA variável por taxa
  push(twoCol('Subtotal s/ IVA:', fmt(data.subtotal)));

  if (data.taxLines && data.taxLines.length > 0) {
    for (const tl of data.taxLines) {
      push(twoCol(`IVA ${tl.rate}% (base ${fmt(tl.base)}):`, fmt(tl.amount)));
    }
  } else {
    const taxRate = data.items[0]?.tax_rate ?? 14;
    push(twoCol(`IVA ${taxRate}%:`, fmt(data.tax)));
  }

  push(BOLD_ON, DOUBLE_HEIGHT);
  push(twoCol('TOTAL:', fmt(data.total)));
  push(NORMAL_SIZE, BOLD_OFF);
  push(divider());

  push(twoCol('Pagamento:', data.paymentMethod));
  if (data.amountTendered != null) push(twoCol('Valor entregue:', fmt(data.amountTendered)));
  if (data.change != null && data.change > 0) {
    push(BOLD_ON);
    push(twoCol('TROCO:', fmt(data.change)));
    push(BOLD_OFF);
  }
  push(divider());

  // Hash AGT (4 primeiros caracteres)
  if (data.hash) {
    push(ALIGN_CENTER);
    push(line(`Hash: ${data.hash.slice(0, 4).toUpperCase()}...`));
  }

  push(ALIGN_CENTER);
  push(line(data.footer ?? 'Obrigado pela sua preferencia!'));
  push(divider('='));
  push(BOLD_ON);
  push(line('DOCUMENTO PROCESSADO POR'));
  push(line('PROGRAMA CERTIFICADO'));
  push(BOLD_OFF);
  if (data.certificateNumber && data.certificateNumber !== '0') {
    push(line(`Certificado AGT Nr ${data.certificateNumber}`));
  }
  push(line('FaturaAO · rapido.topconsultores.pt'));
  push([LF, LF, LF]);
  push(CUT_PAPER);

  return new Uint8Array(bytes);
}

// ── Web Serial API ─────────────────────────────────────────────────────────────

let _port: SerialPort | null = null;

export async function connectThermalPrinter(): Promise<{ ok: boolean; error?: string }> {
  if (!('serial' in navigator)) {
    return { ok: false, error: 'Web Serial API não suportada. Use Chrome 89+ no desktop.' };
  }
  try {
    _port = await (navigator as any).serial.requestPort();
    await _port!.open({ baudRate: 9600 });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Falha ao conectar impressora' };
  }
}

export async function printToThermal(data: ReceiptData): Promise<{ ok: boolean; error?: string }> {
  if (!_port) {
    const conn = await connectThermalPrinter();
    if (!conn.ok) return conn;
  }
  try {
    const writer = _port!.writable!.getWriter();
    await writer.write(buildReceiptCommands(data));
    writer.releaseLock();
    return { ok: true };
  } catch (e: any) {
    _port = null;
    return { ok: false, error: e?.message ?? 'Erro ao imprimir' };
  }
}

export function disconnectThermalPrinter() {
  _port?.close().catch(() => {});
  _port = null;
}

export function isThermalConnected(): boolean { return _port !== null; }

// ── Browser print fallback ─────────────────────────────────────────────────────
export function printReceiptFallback(data: ReceiptData) {
  const isoDate = (d: string) => new Date(d).toLocaleString('pt-AO');
  const taxLabel = (data.taxLines && data.taxLines.length > 0)
    ? data.taxLines.map(t => `<div class="row"><span>IVA ${t.rate}% (base ${fmt(t.base)}):</span><span>${fmt(t.amount)}</span></div>`).join('')
    : `<div class="row"><span>IVA ${data.items[0]?.tax_rate ?? 14}%:</span><span>${fmt(data.tax)}</span></div>`;

  const docLabel = data.documentType === 'FT' ? 'FACTURA' : data.documentType === 'NC' ? 'NOTA DE CRÉDITO' : 'FACTURA RECIBO';
  const certNum = data.certificateNumber && data.certificateNumber !== '0' ? data.certificateNumber : null;

  let html = '';

  if (data.zReport) {
    const z = data.zReport;
    const diff = z.difference;
    html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:12px;width:80mm;padding:4mm}.center{text-align:center}.bold{font-weight:bold}.big{font-size:14px}.divider{border-top:1px dashed #000;margin:4px 0}.row{display:flex;justify-content:space-between}@media print{@page{margin:0;size:80mm auto}}</style>
</head><body>
<div class="center bold big">${data.companyName}</div>
<div class="center">NIF: ${data.companyNif}</div>
<div class="divider" style="border-top:2px solid #000"></div>
<div class="center bold big">Z-REPORT Nº ${String(z.zNumber).padStart(4,'0')}</div>
<div class="divider" style="border-top:2px solid #000"></div>
<div>Terminal: ${z.terminalName}</div>
<div>Operador: ${z.openedByEmail}</div>
<div>Abertura: ${isoDate(z.openedAt)}</div>
<div>Fecho: ${isoDate(z.closedAt)}</div>
<div class="divider"></div>
<div class="bold">RESUMO DE VENDAS</div>
<div class="row"><span>Nº Transacções:</span><span>${z.salesCount}</span></div>
<div class="divider"></div>
<div class="row"><span>Dinheiro:</span><span>${fmt(z.totalCash)}</span></div>
<div class="row"><span>Multicaixa:</span><span>${fmt(z.totalMulticaixa)}</span></div>
<div class="row"><span>TPA:</span><span>${fmt(z.totalTpa)}</span></div>
<div class="row"><span>Crédito:</span><span>${fmt(z.totalCredit)}</span></div>
<div class="divider"></div>
<div class="row bold big"><span>TOTAL VENDAS:</span><span>${fmt(z.totalSales)}</span></div>
<div class="row"><span>IVA Total:</span><span>${fmt(z.taxTotal)}</span></div>
<div class="divider" style="border-top:2px solid #000"></div>
<div class="bold">RECONCILIAÇÃO DE CAIXA</div>
<div class="row"><span>Fundo abertura:</span><span>${fmt(z.openingBalance)}</span></div>
<div class="row"><span>+ Dinheiro:</span><span>${fmt(z.totalCash)}</span></div>
<div class="row bold"><span>= Esperado:</span><span>${fmt(z.openingBalance + z.totalCash)}</span></div>
<div class="row"><span>Declarado:</span><span>${fmt(z.closingBalance)}</span></div>
<div class="row bold" style="color:${diff >= 0 ? 'green' : 'red'}"><span>Diferença:</span><span>${diff >= 0 ? '+' : ''}${fmt(diff)}</span></div>
<div class="divider" style="border-top:2px solid #000"></div>
<div class="center bold">DOCUMENTO PROCESSADO POR<br>PROGRAMA CERTIFICADO</div>
${certNum ? `<div class="center">Certificado AGT Nr ${certNum}</div>` : ''}
<div class="center">FaturaAO · rapido.topconsultores.pt</div>
</body></html>`;
  } else {
    html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:12px;width:80mm;padding:4mm}.center{text-align:center}.bold{font-weight:bold}.big{font-size:15px}.divider{border-top:1px dashed #000;margin:4px 0}.row{display:flex;justify-content:space-between}@media print{@page{margin:0;size:80mm auto}}</style>
</head><body>
<div class="center bold big">${data.companyName}</div>
<div class="center">NIF: ${data.companyNif}</div>
${data.companyAddress ? `<div class="center">${data.companyAddress}</div>` : ''}
${data.companyCity ? `<div class="center">${data.companyCity}</div>` : ''}
<div class="divider"></div>
<div class="bold">${docLabel}: ${data.invoiceNumber}</div>
<div>Data: ${isoDate(data.issuedAt)}</div>
${data.terminalName ? `<div>Terminal: ${data.terminalName}</div>` : ''}
${data.cashierName ? `<div>Operador: ${data.cashierName}</div>` : ''}
${data.clientName ? `<div>Cliente: ${data.clientName}</div>` : ''}
${data.clientNif ? `<div>NIF Cliente: ${data.clientNif}</div>` : ''}
<div class="divider"></div>
${data.items.map(i => `<div>${i.name}</div><div class="row"><span>  ${i.qty}x ${fmt(i.price)}${i.tax_rate != null ? ` (IVA ${i.tax_rate}%)` : ''}</span><span>${fmt(i.total)}</span></div>`).join('')}
<div class="divider"></div>
<div class="row"><span>Subtotal s/ IVA:</span><span>${fmt(data.subtotal)}</span></div>
${taxLabel}
<div class="row bold big"><span>TOTAL:</span><span>${fmt(data.total)}</span></div>
<div class="divider"></div>
<div class="row"><span>Pagamento:</span><span>${data.paymentMethod}</span></div>
${data.amountTendered ? `<div class="row"><span>Valor entregue:</span><span>${fmt(data.amountTendered)}</span></div>` : ''}
${data.change && data.change > 0 ? `<div class="row bold"><span>TROCO:</span><span>${fmt(data.change)}</span></div>` : ''}
<div class="divider"></div>
${data.hash ? `<div class="center" style="font-size:10px">Hash: ${data.hash.slice(0,4).toUpperCase()}...</div>` : ''}
<div class="center">Obrigado pela sua preferência!</div>
<div class="divider" style="border-top:1px solid #000"></div>
<div class="center bold">DOCUMENTO PROCESSADO POR<br>PROGRAMA CERTIFICADO</div>
${certNum ? `<div class="center">Certificado AGT Nr ${certNum}</div>` : ''}
<div class="center">FaturaAO · rapido.topconsultores.pt</div>
</body></html>`;
  }

  const w = window.open('', '_blank', 'width=420,height=700');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); w.close(); }, 500);
}
