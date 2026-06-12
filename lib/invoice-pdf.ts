import QRCode from 'qrcode';
import { formatAOA, formatDateTime } from '@/lib/utils';

function esc(s: any): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]!));
}

/**
 * Como nas grandes empresas (Xero, SAP, QuickBooks):
 *  - Logo posicionável: topo-esquerda, topo-centro, topo-direita, marca de água
 *  - Tamanho do logo: pequeno (60px), médio (90px), grande (120px)
 *  - Cor primária personalizável (cabeçalho, tabela, totais)
 *  - Cor de fundo do cabeçalho personalizável
 *  - Marca de água do logo em fundo (tipo empresas de topo)
 *  - Texto de rodapé personalizado (condições de pagamento, obrigado, etc.)
 */
export async function buildInvoiceHtml(inv: any, items: any[], company: any, fcfg: any): Promise<string> {
  const certifiedFooter = fcfg?.mode === 'certificado' && fcfg?.agt_certificado_numero
    ? `Processado por programa certificado n&ordm; ${esc(fcfg.agt_certificado_numero)} &middot; FaturaAO`
    : `Processado por FaturaAO &middot; Sistema em conformidade com AGT (n&atilde;o certificado)`;

  const cancelled = inv.status === 'cancelled';

  // ── Branding settings (com defaults profissionais) ──────────────────────
  const primaryColor    = company?.invoice_primary_color  || '#0b4a6f';
  const headerBg        = company?.invoice_header_bg      || '#ffffff';
  const logoPosition    = company?.logo_position          || 'top-left';   // top-left | top-center | top-right | watermark
  const logoSize        = company?.logo_size              || 'medium';     // small | large | medium
  const showWatermark   = company?.invoice_show_watermark || false;
  const footerText      = company?.invoice_footer_text    || '';
  const logoUrl         = company?.logo_url               || '';

  const logoHeight: Record<string, number> = { small: 50, medium: 80, large: 120 };
  const lh = logoHeight[logoSize] ?? 80;

  // ── Logo HTML por posição ───────────────────────────────────────────────
  const logoImg = logoUrl
    ? `<img src="${esc(logoUrl)}" alt="${esc(company?.name ?? 'Logo')}" style="max-height:${lh}px;max-width:${logoPosition === 'watermark' ? '300px' : '220px'};object-fit:contain;display:block;"/>`
    : '';

  // Marca de água: logo grande centrado no fundo da página (opacity baixa)
  const logoWatermark = logoUrl && (logoPosition === 'watermark' || showWatermark)
    ? `<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-15deg);opacity:0.06;z-index:-1;pointer-events:none;">${logoImg.replace(`max-height:${lh}px`, 'max-height:320px')}</div>`
    : '';

  // Logo no cabeçalho conforme posição escolhida
  let headerLogoHtml = '';
  if (logoUrl && logoPosition !== 'watermark') {
    const alignment: Record<string, string> = {
      'top-left':   'flex-start',
      'top-center': 'center',
      'top-right':  'flex-end',
    };
    const align = alignment[logoPosition] || 'flex-start';
    headerLogoHtml = `<div style="display:flex;justify-content:${align};margin-bottom:12px;">${logoImg}</div>`;
  }

  // ── Linhas da tabela ────────────────────────────────────────────────────
  const rowsHtml = items.map((it: any, idx: number) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${esc(it.description)}</td>
      <td class="num">${Number(it.quantity).toFixed(3)}</td>
      <td class="num">${formatAOA(it.price)}</td>
      <td class="num">${Number(it.tax_rate).toFixed(2)}%</td>
      <td class="num">${formatAOA(it.total)}</td>
    </tr>`).join('');

  // ── QR Code ────────────────────────────────────────────────────────────
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
  } catch { qrDataUrl = ''; }

  // ── Badge de pagamento ─────────────────────────────────────────────────
  const paymentStatusLabel = (() => {
    if (cancelled) return '';
    switch (inv.payment_status) {
      case 'pago':    return `<div style="background:#dff6dd;color:#107c10;padding:4px 12px;border-radius:20px;display:inline-block;font-size:10px;font-weight:700;letter-spacing:.5px;">✓ PAGA</div>`;
      case 'parcial': return `<div style="background:#fff4ce;color:#8a6400;padding:4px 12px;border-radius:20px;display:inline-block;font-size:10px;font-weight:700;">PARCIALMENTE PAGA</div>`;
      default:        return `<div style="background:#fde7e9;color:#a4262c;padding:4px 12px;border-radius:20px;display:inline-block;font-size:10px;font-weight:700;">POR RECEBER</div>`;
    }
  })();

  // ── Cor derivada (versão clara para backgrounds) ───────────────────────
  // Converte hex para rgba com opacity
  const primaryLight = `${primaryColor}18`; // ~10% opacity
  const primaryMid   = `${primaryColor}30`; // ~19% opacity

  return `<!DOCTYPE html>
<html lang="pt-AO"><head><meta charset="utf-8"/><style>
*{box-sizing:border-box;font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif;}
body{margin:0;padding:0;color:#1a1a2e;font-size:11px;background:#fff;}

/* ── Watermark CANCELADA ── */
.wm-cancelled{position:fixed;top:38%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:110px;color:rgba(164,38,44,0.10);font-weight:900;pointer-events:none;z-index:-2;letter-spacing:4px;}

/* ── Cabeçalho ── */
.header{background:${headerBg};padding:24px 28px 20px;border-bottom:3px solid ${primaryColor};}
.header-inner{display:flex;justify-content:space-between;align-items:flex-start;}
.company-info{}
.company-info h1{font-size:18px;margin:0 0 3px;color:${primaryColor};font-weight:800;}
.company-info p{margin:2px 0;color:#555;font-size:10.5px;}
.doc-meta{text-align:right;min-width:180px;}
.doc-type{font-size:28px;font-weight:900;color:${primaryColor};line-height:1;margin-bottom:2px;}
.doc-number{font-size:14px;font-family:'Consolas',monospace;color:#333;margin-bottom:6px;}
.doc-date{font-size:10px;color:#666;margin-top:4px;}

/* ── Corpo ── */
.body-wrap{padding:20px 28px;}

/* ── Blocos de info ── */
.meta{display:flex;gap:16px;margin-bottom:20px;}
.meta .block{flex:1;background:${primaryLight};border-left:3px solid ${primaryColor};padding:12px 14px;border-radius:0 6px 6px 0;}
.meta h3{margin:0 0 5px;font-size:9px;text-transform:uppercase;color:${primaryColor};letter-spacing:.8px;font-weight:800;}
.meta p{margin:1.5px 0;color:#333;font-size:10.5px;}

/* ── Tabela ── */
table.items{width:100%;border-collapse:collapse;margin-bottom:20px;}
table.items thead tr{background:${primaryColor};}
table.items th{color:#fff;padding:9px 8px;text-align:left;font-size:9.5px;text-transform:uppercase;letter-spacing:.5px;font-weight:700;}
table.items th.num{text-align:right;}
table.items td{padding:8px;border-bottom:1px solid #eee;font-size:10.5px;}
table.items td.num{text-align:right;font-family:'Consolas',monospace;}
table.items tbody tr:nth-child(even){background:${primaryLight};}
table.items tbody tr:hover{background:${primaryMid};}

/* ── Totais + QR ── */
.totals-wrap{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;margin-bottom:20px;}
.qr-box{text-align:center;}
.qr-box img{display:block;margin:0 auto;border:1px solid #eee;border-radius:4px;padding:4px;}
.qr-box p{font-size:9px;color:#888;margin:4px 0 0;}
.totals{width:260px;border:1px solid #eee;border-radius:8px;overflow:hidden;}
.totals .row{display:flex;justify-content:space-between;padding:8px 14px;border-bottom:1px solid #eee;font-size:11px;}
.totals .num{font-family:'Consolas',monospace;}
.totals .grand{display:flex;justify-content:space-between;background:${primaryColor};color:#fff;padding:12px 14px;font-size:15px;font-weight:800;}
.totals .grand .num{font-family:'Consolas',monospace;}

/* ── Rodapé ── */
.footer{margin-top:24px;padding:16px 28px;border-top:2px solid ${primaryLight};background:${primaryLight};}
.footer-custom{font-size:11px;color:#444;text-align:center;margin-bottom:12px;font-style:italic;}
.footer-agt{font-size:9px;color:#888;}
.hash{font-family:'Consolas',monospace;word-break:break-all;background:#f5f5f5;padding:6px 8px;border-radius:4px;margin-top:4px;font-size:9px;}
.exempt{background:#fff8e1;padding:10px 14px;border-left:3px solid #f59e0b;margin-bottom:14px;border-radius:0 6px 6px 0;font-size:10.5px;}
.cancel-banner{background:#fde7e9;color:#a4262c;padding:12px;border-radius:6px;text-align:center;font-weight:700;margin-bottom:14px;font-size:12px;border:1px solid #fca5a5;}
</style></head><body>

${logoWatermark}
${cancelled ? '<div class="wm-cancelled">CANCELADA</div>' : ''}

<!-- CABEÇALHO -->
<div class="header">
  ${logoPosition === 'top-center' || logoPosition === 'top-right' ? headerLogoHtml : ''}
  <div class="header-inner">
    <div class="company-info">
      ${logoPosition === 'top-left' ? headerLogoHtml : ''}
      <h1>${esc(company?.name ?? '')}</h1>
      <p><strong>NIF:</strong> ${esc(company?.nif ?? '')}</p>
      ${company?.address ? `<p>${esc(company.address)}</p>` : ''}
      ${company?.city ? `<p>${esc(company.city)}</p>` : ''}
      ${company?.phone ? `<p>Tel: ${esc(company.phone)}</p>` : ''}
      ${company?.email ? `<p>${esc(company.email)}</p>` : ''}
    </div>
    <div class="doc-meta">
      <div class="doc-type">${esc(inv.document_type)}</div>
      <div class="doc-number">${esc(inv.invoice_number)}</div>
      <div>${paymentStatusLabel || `<div style="display:inline-block;padding:4px 12px;border-radius:20px;font-size:10px;font-weight:700;background:${primaryLight};color:${primaryColor};">${cancelled ? 'CANCELADA' : 'EMITIDA'}</div>`}</div>
      <div class="doc-date"><strong>Data:</strong> ${esc(formatDateTime(inv.issued_at))}</div>
      ${inv.due_date ? `<div class="doc-date"><strong>Vencimento:</strong> ${esc(formatDateTime(inv.due_date))}</div>` : ''}
    </div>
  </div>
</div>

<!-- CORPO -->
<div class="body-wrap">

${cancelled ? `<div class="cancel-banner">⚠️ FATURA CANCELADA — ${esc(inv.cancellation_reason ?? '')}</div>` : ''}
${inv.related_document ? `<div class="exempt" style="background:#eaf4ff;border-left-color:${primaryColor};"><strong>Documento relacionado:</strong> ${esc(inv.related_document)}</div>` : ''}
${inv.tax_exemption_reason ? `<div class="exempt"><strong>Isenção de IVA:</strong> ${esc(inv.tax_exemption_reason)}</div>` : ''}

<!-- Emitente & Cliente -->
<div class="meta">
  <div class="block">
    <h3>Emitente</h3>
    <p><strong>${esc(company?.name ?? '')}</strong></p>
    <p>NIF: ${esc(company?.nif ?? '')}</p>
    ${company?.address ? `<p>${esc(company.address)}</p>` : ''}
  </div>
  <div class="block">
    <h3>Cliente</h3>
    <p><strong>${esc(inv.client_name || 'Consumidor Final')}</strong></p>
    <p>NIF: ${esc(inv.client_nif || '000000000')}</p>
    ${inv.client_address ? `<p>${esc(inv.client_address)}</p>` : ''}
    ${inv.client_email ? `<p>${esc(inv.client_email)}</p>` : ''}
  </div>
  ${inv.notes ? `<div class="block"><h3>Notas</h3><p>${esc(inv.notes)}</p></div>` : ''}
</div>

<!-- Tabela de itens -->
<table class="items">
  <thead><tr>
    <th style="width:30px;">#</th>
    <th>Descrição</th>
    <th class="num">Qtd</th>
    <th class="num">Preço Unit.</th>
    <th class="num">IVA</th>
    <th class="num">Total</th>
  </tr></thead>
  <tbody>${rowsHtml}</tbody>
</table>

<!-- Totais + QR -->
<div class="totals-wrap">
  ${qrDataUrl ? `
  <div class="qr-box">
    <img src="${qrDataUrl}" alt="QR AGT" width="110" height="110"/>
    <p><strong>Verificação AGT</strong></p>
    <p style="max-width:130px;margin:2px auto 0;line-height:1.3;">NIF · Nº Fatura · Data · Total · Hash</p>
  </div>` : ''}
  <div class="totals">
    <div class="row"><span>Subtotal</span><span class="num">${formatAOA(inv.subtotal)}</span></div>
    <div class="row"><span>IVA</span><span class="num">${formatAOA(inv.tax)}</span></div>
    ${Number(inv.discount ?? 0) > 0 ? `<div class="row"><span>Desconto</span><span class="num" style="color:#e11d48;">-${formatAOA(inv.discount)}</span></div>` : ''}
    <div class="grand"><span>TOTAL (AOA)</span><span class="num">${formatAOA(inv.total)}</span></div>
    ${!cancelled && Number(inv.amount_paid ?? 0) > 0 ? `
    <div class="row" style="margin-top:2px;"><span>Já recebido</span><span class="num" style="color:#107c10;">${formatAOA(Number(inv.amount_paid))}</span></div>
    <div class="row"><span><strong>Em dívida</strong></span><span class="num"><strong>${formatAOA(Math.max(0, Number(inv.total) - Number(inv.amount_paid)))}</strong></span></div>
    ` : ''}
  </div>
</div>

</div><!-- /body-wrap -->

<!-- RODAPÉ -->
<div class="footer">
  ${footerText ? `<div class="footer-custom">${esc(footerText)}</div>` : ''}
  <div class="footer-agt">
    <p><strong>Compliance AGT:</strong> Documento gerado electronicamente. Dados protegidos por hash SHA-256 encadeado${inv.signature ? ' e assinatura digital RSA-SHA256' : ''}.</p>
    <p><strong>Hash:</strong></p>
    <div class="hash">${esc(inv.hash)}</div>
    ${inv.previous_hash ? `<p style="margin-top:4px;"><strong>Hash anterior:</strong></p><div class="hash">${esc(inv.previous_hash)}</div>` : ''}
    ${inv.signature ? `<p style="margin-top:4px;"><strong>Assinatura RSA-SHA256:</strong></p><div class="hash" style="max-height:50px;overflow:hidden;">${esc((inv.signature as string).slice(0,128))}&hellip;</div>` : ''}
    <p style="margin-top:8px;text-align:center;">${certifiedFooter}</p>
  </div>
</div>

</body></html>`;
}

/**
 * Gera PDF via AbacusAI com:
 * - Backoff exponencial: 500ms → 1s → 2s (max)
 * - Timeout máximo de 30 segundos
 */
export async function generateInvoicePdfBuffer(html: string): Promise<Buffer> {
  const apiKey = process.env.ABACUSAI_API_KEY;
  if (!apiKey) throw new Error('ABACUSAI_API_KEY não configurada');

  const createResp = await fetch('https://apps.abacus.ai/api/createConvertHtmlToPdfRequest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deployment_token: apiKey,
      html_content: html,
      pdf_options: {
        format: 'A4',
        print_background: true,
        margin: { top: '0mm', right: '0mm', bottom: '15mm', left: '0mm' },
      },
    }),
  });

  if (!createResp.ok) {
    throw new Error(`Falha ao criar pedido de PDF: ${createResp.status} ${createResp.statusText}`);
  }

  const { request_id } = await createResp.json();
  if (!request_id) throw new Error('Sem request_id na resposta');

  const TIMEOUT_MS = 30_000;
  const deadline   = Date.now() + TIMEOUT_MS;
  let delay        = 500;
  const MAX_DELAY  = 2000;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 2, MAX_DELAY);

    const st = await fetch('https://apps.abacus.ai/api/getConvertHtmlToPdfStatus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request_id, deployment_token: apiKey }),
    });

    if (!st.ok) continue;
    const j = await st.json();

    if (j?.status === 'SUCCESS') {
      const b64 = j?.result?.result;
      if (!b64) throw new Error('PDF vazio na resposta');
      return Buffer.from(b64, 'base64');
    }
    if (j?.status === 'FAILED') {
      throw new Error(j?.result?.error ?? 'Geração de PDF falhou');
    }
  }

  throw new Error(`Timeout ao gerar PDF (>${TIMEOUT_MS / 1000}s). Tente novamente.`);
}
