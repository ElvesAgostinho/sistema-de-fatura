/**
 * Thermal Printer — ESC/POS via Web Serial API
 *
 * Supports USB and Bluetooth thermal printers that implement ESC/POS protocol:
 * Epson TM-T20, Bixolon SRP-350, Star Micronics, Citizen CT-S, etc.
 *
 * Falls back to window.print() with thermal CSS if no serial port available.
 */

// Web Serial API types (not yet in standard TS lib)
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
const INIT          = [ESC, 0x40];                        // Initialize printer
const ALIGN_LEFT    = [ESC, 0x61, 0x00];
const ALIGN_CENTER  = [ESC, 0x61, 0x01];
const ALIGN_RIGHT   = [ESC, 0x61, 0x02];
const BOLD_ON       = [ESC, 0x45, 0x01];
const BOLD_OFF      = [ESC, 0x45, 0x00];
const DOUBLE_HEIGHT = [ESC, 0x21, 0x10];
const NORMAL_SIZE   = [ESC, 0x21, 0x00];
const CUT_PAPER     = [GS, 0x56, 0x42, 0x00];            // Full cut

function textToBytes(text: string): number[] {
  // Basic Latin-1 encoding — supports Portuguese characters
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    bytes.push(code > 255 ? 0x3f : code); // '?' for unmappable chars
  }
  return bytes;
}

function line(text: string, width = 48): number[] {
  return [...textToBytes(text.padEnd(width).slice(0, width)), LF];
}

function divider(width = 48): number[] {
  return [...textToBytes('-'.repeat(width)), LF];
}

function twoCol(left: string, right: string, width = 48): number[] {
  const r = right.slice(0, 16);
  const l = left.slice(0, width - r.length - 1).padEnd(width - r.length - 1);
  return [...textToBytes(`${l} ${r}`), LF];
}

export interface ReceiptData {
  companyName: string;
  companyNif: string;
  companyAddress?: string;
  invoiceNumber: string;
  issuedAt: string;
  cashierName?: string;
  items: Array<{ name: string; qty: number; price: number; total: number }>;
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: string;
  amountTendered?: number;
  change?: number;
  clientName?: string;
  clientNif?: string;
  footer?: string;
}

export function buildReceiptCommands(data: ReceiptData): Uint8Array {
  const bytes: number[] = [];
  const push = (...cmds: number[][]) => cmds.forEach(c => bytes.push(...c));
  const fmt = (n: number) => `${n.toFixed(2).replace('.', ',')} Kz`;

  push(INIT);

  // Header
  push(ALIGN_CENTER, BOLD_ON, DOUBLE_HEIGHT);
  push(line(data.companyName));
  push(NORMAL_SIZE, BOLD_OFF);
  push(line(`NIF: ${data.companyNif}`));
  if (data.companyAddress) push(line(data.companyAddress));
  push([LF]);

  // Document info
  push(ALIGN_LEFT, BOLD_ON);
  push(line(`FACTURA RECIBO: ${data.invoiceNumber}`));
  push(BOLD_OFF);
  push(line(`Data: ${new Date(data.issuedAt).toLocaleString('pt-AO')}`));
  if (data.cashierName) push(line(`Operador: ${data.cashierName}`));
  if (data.clientName) push(line(`Cliente: ${data.clientName}`));
  if (data.clientNif)  push(line(`NIF: ${data.clientNif}`));
  push(divider());

  // Items
  for (const item of data.items) {
    push(line(item.name.slice(0, 32)));
    push(twoCol(`  ${item.qty}x ${fmt(item.price)}`, fmt(item.total)));
  }
  push(divider());

  // Totals
  push(twoCol('Subtotal:', fmt(data.subtotal)));
  push(twoCol('IVA (14%):', fmt(data.tax)));
  push(BOLD_ON, DOUBLE_HEIGHT);
  push(twoCol('TOTAL:', fmt(data.total)));
  push(NORMAL_SIZE, BOLD_OFF);
  push(divider());

  // Payment
  push(twoCol('Pagamento:', data.paymentMethod));
  if (data.amountTendered != null) push(twoCol('Valor entregue:', fmt(data.amountTendered)));
  if (data.change != null && data.change > 0) push(twoCol('Troco:', fmt(data.change)));
  push(divider());

  // Footer
  push(ALIGN_CENTER);
  push(line(data.footer ?? 'Obrigado pela sua preferencia!'));
  push(line('Documento emitido por FaturaAO'));
  push(line('rapido.topconsultores.pt'));
  push([LF, LF, LF]);

  // Cut
  push(CUT_PAPER);

  return new Uint8Array(bytes);
}

// ── Web Serial API ────────────────────────────────────────────────────────────

let _port: SerialPort | null = null;

export async function connectThermalPrinter(): Promise<{ ok: boolean; error?: string }> {
  if (!('serial' in navigator)) {
    return { ok: false, error: 'Web Serial API não suportada. Use Chrome 89+.' };
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

// ── Browser print fallback ────────────────────────────────────────────────────
export function printReceiptFallback(data: ReceiptData) {
  const fmt = (n: number) => `${n.toFixed(2)} Kz`;
  const html = `
<!DOCTYPE html><html><head>
<meta charset="UTF-8"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; padding: 4mm; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .big { font-size: 15px; }
  .divider { border-top: 1px dashed #000; margin: 4px 0; }
  .row { display: flex; justify-content: space-between; }
  @media print { @page { margin: 0; size: 80mm auto; } }
</style></head><body>
<div class="center bold big">${data.companyName}</div>
<div class="center">NIF: ${data.companyNif}</div>
${data.companyAddress ? `<div class="center">${data.companyAddress}</div>` : ''}
<div class="divider"></div>
<div class="bold">FR: ${data.invoiceNumber}</div>
<div>Data: ${new Date(data.issuedAt).toLocaleString('pt-AO')}</div>
${data.cashierName ? `<div>Operador: ${data.cashierName}</div>` : ''}
${data.clientName ? `<div>Cliente: ${data.clientName}</div>` : ''}
<div class="divider"></div>
${data.items.map(i => `
  <div>${i.name}</div>
  <div class="row"><span>  ${i.qty}x ${fmt(i.price)}</span><span>${fmt(i.total)}</span></div>
`).join('')}
<div class="divider"></div>
<div class="row"><span>Subtotal:</span><span>${fmt(data.subtotal)}</span></div>
<div class="row"><span>IVA (14%):</span><span>${fmt(data.tax)}</span></div>
<div class="row bold big"><span>TOTAL:</span><span>${fmt(data.total)}</span></div>
<div class="divider"></div>
<div class="row"><span>Pagamento:</span><span>${data.paymentMethod}</span></div>
${data.amountTendered ? `<div class="row"><span>Valor entregue:</span><span>${fmt(data.amountTendered)}</span></div>` : ''}
${data.change && data.change > 0 ? `<div class="row bold"><span>Troco:</span><span>${fmt(data.change)}</span></div>` : ''}
<div class="divider"></div>
<div class="center">Obrigado pela sua preferencia!</div>
<div class="center">FaturaAO · rapido.topconsultores.pt</div>
</body></html>`;

  const w = window.open('', '_blank', 'width=400,height=600');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); w.close(); }, 400);
}
