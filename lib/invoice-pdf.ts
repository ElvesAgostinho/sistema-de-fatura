import QRCode from 'qrcode';
import { formatAOA, formatDateTime } from '@/lib/utils';

function esc(s: any): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]!));
}

export async function buildInvoiceHtml(inv: any, items: any[], company: any, fcfg: any): Promise<string> {
  const certifiedFooter = fcfg?.mode === 'certificado' && fcfg?.agt_certificado_numero
    ? `Processado por programa certificado n&ordm; ${esc(fcfg.agt_certificado_numero)} &middot; FaturaAO`
    : `Processado por FaturaAO &middot; Sistema em conformidade com AGT (n&atilde;o certificado)`;
  const cancelled = inv.status === 'cancelled';
  const rowsHtml = items.map((it: any, idx: number) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${esc(it.description)}</td>
      <td class="num">${Number(it.quantity).toFixed(3)}</td>
      <td class="num">${formatAOA(it.price)}</td>
      <td class="num">${Number(it.tax_rate).toFixed(2)}%</td>
      <td class="num">${formatAOA(it.total)}</td>
    </tr>`).join('');

  const qrPayload = [
    company?.nif ?? '',
    inv.client_nif ?? '',
    inv.invoice_number ?? '',
    String(inv.issued_at ?? '').slice(0, 10),
    Number(inv.total ?? 0).toFixed(2),
    Number(inv.tax ?? 0).toFixed(2),
    String(inv.hash ?? '').slice(0, 16),
  ].join('|');

  let qrDataUrl = '';
  try {
    qrDataUrl = await QRCode.toDataURL(qrPayload, { width: 140, margin: 1, errorCorrectionLevel: 'M' });
  } catch {
    qrDataUrl = '';
  }

  const paymentStatusLabel = (() => {
    if (cancelled) return '';
    switch (inv.payment_status) {
      case 'pago': return '<div style="background:#dff6dd;color:#107c10;padding:4px 10px;border-radius:4px;display:inline-block;font-size:10px;font-weight:600;margin-top:4px;">PAGA</div>';
      case 'parcial': return '<div style="background:#fff4ce;color:#8a6400;padding:4px 10px;border-radius:4px;display:inline-block;font-size:10px;font-weight:600;margin-top:4px;">PARCIALMENTE PAGA</div>';
      default: return '<div style="background:#fde7e9;color:#a4262c;padding:4px 10px;border-radius:4px;display:inline-block;font-size:10px;font-weight:600;margin-top:4px;">POR RECEBER</div>';
    }
  })();

  return `<!DOCTYPE html>
<html lang="pt-AO"><head><meta charset="utf-8"/><style>
*{box-sizing:border-box;font-family:'Segoe UI',Arial,sans-serif;}
body{margin:0;padding:0;color:#201f1e;font-size:11px;}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #0078D4;}
.company{max-width:55%;}
.company h1{font-size:20px;margin:0 0 4px 0;color:#0078D4;}
.company p{margin:2px 0;color:#605e5c;}
.doc-info{text-align:right;}
.doc-info .type{font-size:24px;font-weight:700;color:#0078D4;margin-bottom:4px;}
.doc-info .number{font-size:16px;font-family:'Consolas',monospace;margin-bottom:8px;}
.doc-info .status{display:inline-block;padding:4px 10px;border-radius:4px;font-size:10px;font-weight:600;background:#dff6dd;color:#107c10;}
.doc-info .status.cancelled{background:#fde7e9;color:#a4262c;}
.meta{display:flex;justify-content:space-between;gap:24px;margin-bottom:20px;}
.meta .block{flex:1;background:#f3f2f1;padding:12px 14px;border-radius:4px;}
.meta h3{margin:0 0 6px 0;font-size:10px;text-transform:uppercase;color:#0078D4;letter-spacing:.5px;}
.meta p{margin:2px 0;}
table.items{width:100%;border-collapse:collapse;margin-bottom:20px;}
table.items th{background:#0078D4;color:#fff;padding:8px;text-align:left;font-size:10px;text-transform:uppercase;}
table.items th.num{text-align:right;}
table.items td{padding:8px;border-bottom:1px solid #edebe9;}
table.items td.num{text-align:right;font-family:'Consolas',monospace;}
.totals-wrap{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;margin-bottom:20px;}
.qr-box{text-align:center;}
.qr-box img{display:block;margin:0 auto;}
.qr-box p{font-size:9px;color:#605e5c;margin:4px 0 0 0;}
.totals{width:50%;}
.totals div{display:flex;justify-content:space-between;padding:6px 12px;}
.totals div.row{border-bottom:1px solid #edebe9;}
.totals .grand{background:#0078D4;color:#fff;font-size:14px;font-weight:700;border-radius:4px;margin-top:6px;padding:10px 12px;}
.totals .num{font-family:'Consolas',monospace;}
.footer{margin-top:32px;padding-top:16px;border-top:1px solid #edebe9;font-size:9px;color:#605e5c;}
.hash{font-family:'Consolas',monospace;word-break:break-all;background:#f3f2f1;padding:8px;border-radius:4px;margin-top:8px;}
.exempt{background:#fff4ce;padding:10px;border-left:4px solid #ffaa44;margin-bottom:16px;border-radius:4px;}
.cancel-banner{background:#fde7e9;color:#a4262c;padding:12px;border-radius:4px;text-align:center;font-weight:600;margin-bottom:16px;}
.watermark{position:fixed;top:40%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:120px;color:rgba(164,38,44,0.12);font-weight:900;pointer-events:none;z-index:-1;}
</style></head><body>
${cancelled ? '<div class="watermark">CANCELADA</div>' : ''}
<div class="header">
  <div class="company">
    ${company?.logo_url ? `<img src="${esc(company.logo_url)}" alt="logo" style="max-height:60px;margin-bottom:8px;"/>` : ''}
    <h1>${esc(company?.name ?? '')}</h1>
    <p><strong>NIF:</strong> ${esc(company?.nif ?? '')}</p>
    ${company?.address ? `<p>${esc(company.address)}</p>` : ''}
    ${company?.phone ? `<p>Tel: ${esc(company.phone)}</p>` : ''}
    ${company?.email ? `<p>${esc(company.email)}</p>` : ''}
  </div>
  <div class="doc-info">
    <div class="type">${esc(inv.document_type)}</div>
    <div class="number">${esc(inv.invoice_number)}</div>
    <div class="status ${cancelled ? 'cancelled' : ''}">${cancelled ? 'CANCELADA' : 'EMITIDA'}</div>
    ${paymentStatusLabel}
    <p style="margin-top:8px;"><strong>Data:</strong> ${esc(formatDateTime(inv.issued_at))}</p>
  </div>
</div>

${cancelled ? `<div class="cancel-banner">FATURA CANCELADA &mdash; ${esc(inv.cancellation_reason ?? '')}</div>` : ''}

<div class="meta">
  <div class="block">
    <h3>Emitente</h3>
    <p><strong>${esc(company?.name ?? '')}</strong></p>
    <p>NIF: ${esc(company?.nif ?? '')}</p>
    <p>${esc(company?.address ?? '')}</p>
  </div>
  <div class="block">
    <h3>Cliente</h3>
    <p><strong>${esc(inv.client_name)}</strong></p>
    <p>NIF: ${esc(inv.client_nif)}</p>
    ${inv.client_address ? `<p>${esc(inv.client_address)}</p>` : ''}
  </div>
</div>

${inv.related_document ? `<div class="exempt" style="background:#eaf4ff;border-left-color:#0078D4;"><strong>Documento relacionado:</strong> ${esc(inv.related_document)}</div>` : ''}
${inv.tax_exemption_reason ? `<div class="exempt"><strong>Isenção de IVA:</strong> ${esc(inv.tax_exemption_reason)}</div>` : ''}

<table class="items">
  <thead><tr>
    <th>#</th><th>Descrição</th>
    <th class="num">Qtd</th><th class="num">Preço Unit.</th>
    <th class="num">IVA</th><th class="num">Total</th>
  </tr></thead>
  <tbody>${rowsHtml}</tbody>
</table>

<div class="totals-wrap">
  ${qrDataUrl ? `<div class="qr-box"><img src="${qrDataUrl}" alt="QR de verificação" width="110" height="110"/><p><strong>Verifique a factura</strong></p><p style="max-width:140px;margin:2px auto 0;">Contém NIF emitente, NIF cliente, número, data, total, IVA e hash</p></div>` : ''}
  <div class="totals">
    <div class="row"><span>Subtotal</span><span class="num">${formatAOA(inv.subtotal)}</span></div>
    <div class="row"><span>IVA</span><span class="num">${formatAOA(inv.tax)}</span></div>
    <div class="grand"><span>TOTAL (AOA)</span><span class="num">${formatAOA(inv.total)}</span></div>
    ${!cancelled && Number(inv.amount_paid ?? 0) > 0 ? `
    <div class="row" style="margin-top:8px;"><span>Já recebido</span><span class="num" style="color:#107c10;">${formatAOA(Number(inv.amount_paid))}</span></div>
    <div class="row"><span><strong>Em dívida</strong></span><span class="num"><strong>${formatAOA(Math.max(0, Number(inv.total) - Number(inv.amount_paid)))}</strong></span></div>
    ` : ''}
  </div>
</div>

<div class="footer">
  <p><strong>Compliance AGT:</strong> Documento gerado eletronicamente. Os dados desta fatura estão protegidos por hash SHA-256 encadeado${inv.signature ? ' e assinatura digital RSA-SHA256' : ''}.</p>
  <p><strong>Hash desta fatura:</strong></p>
  <div class="hash">${esc(inv.hash)}</div>
  ${inv.previous_hash ? `<p style="margin-top:6px;"><strong>Hash anterior:</strong></p><div class="hash">${esc(inv.previous_hash)}</div>` : ''}
  ${inv.signature ? `<p style="margin-top:6px;"><strong>Assinatura digital (RSA-SHA256):</strong></p><div class="hash" style="max-height:60px;overflow:hidden;">${esc((inv.signature as string).slice(0,128))}&hellip;</div>` : ''}
  <p style="margin-top:8px;text-align:center;">${certifiedFooter}</p>
</div>
</body></html>`;
}

/**
 * Gera PDF via AbacusAI com:
 * - Backoff exponencial: 500ms → 1s → 2s (max)
 * - Timeout máximo de 30 segundos (era 120s)
 * - Mensagens de erro claras
 */
export async function generateInvoicePdfBuffer(html: string): Promise<Buffer> {
  const apiKey = process.env.ABACUSAI_API_KEY;
  if (!apiKey) throw new Error('ABACUSAI_API_KEY não configurada');

  // 1. Criar pedido de conversão
  const createResp = await fetch('https://apps.abacus.ai/api/createConvertHtmlToPdfRequest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deployment_token: apiKey,
      html_content: html,
      pdf_options: {
        format: 'A4',
        print_background: true,
        margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' },
      },
    }),
  });

  if (!createResp.ok) {
    throw new Error(`Falha ao criar pedido de PDF: ${createResp.status} ${createResp.statusText}`);
  }

  const { request_id } = await createResp.json();
  if (!request_id) throw new Error('Sem request_id na resposta');

  // 2. Polling com backoff exponencial — máximo 30 segundos
  const TIMEOUT_MS = 30_000;
  const deadline = Date.now() + TIMEOUT_MS;
  let delay = 500;          // começa em 500ms
  const MAX_DELAY = 2000;   // nunca mais de 2s entre tentativas

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 2, MAX_DELAY); // 500 → 1000 → 2000 → 2000…

    const st = await fetch('https://apps.abacus.ai/api/getConvertHtmlToPdfStatus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request_id, deployment_token: apiKey }),
    });

    if (!st.ok) continue; // erro de rede temporário — tentar de novo

    const j = await st.json();

    if (j?.status === 'SUCCESS') {
      const b64 = j?.result?.result;
      if (!b64) throw new Error('PDF vazio na resposta');
      return Buffer.from(b64, 'base64');
    }

    if (j?.status === 'FAILED') {
      throw new Error(j?.result?.error ?? 'Geração de PDF falhou no serviço externo');
    }
    // PENDING ou PROCESSING — continuar polling
  }

  throw new Error(`Timeout ao gerar PDF (>${TIMEOUT_MS / 1000}s). Tente novamente.`);
}
