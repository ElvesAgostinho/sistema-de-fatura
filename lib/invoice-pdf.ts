import QRCode from 'qrcode';
import { formatAOA, formatDateTime } from '@/lib/utils';

function esc(s: any): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]!));
}

/**
 * Factura PDF estilo Xero — uma única página para poucos produtos.
 * - Cabeçalho compacto com logo posicionável
 * - Tabela de itens com auto page-break apenas se necessário
 * - Totais + QR + rodapé NUNCA partem de página sozinhos (page-break-inside: avoid)
 * - Hash apresentado de forma compacta no rodapé (não ocupa uma página inteira)
 */
export async function buildInvoiceHtml(inv: any, items: any[], company: any, fcfg: any): Promise<string> {
  /* ── Certified footer ── */
  const certifiedFooter = fcfg?.mode === 'certificado' && fcfg?.agt_certificado_numero
    ? `Processado por programa certificado n&ordm; ${esc(fcfg.agt_certificado_numero)} &middot; FaturaAO v2`
    : `Processado por FaturaAO &middot; Em conformidade com AGT`;

  const cancelled = inv.status === 'cancelled';

  /* ── Branding ── */
  const primaryColor  = company?.invoice_primary_color  || '#0b4a6f';
  const headerBg      = company?.invoice_header_bg      || '#ffffff';
  const logoPosition  = company?.logo_position          || 'top-left';
  const logoSize      = company?.logo_size              || 'medium';
  const showWatermark = company?.invoice_show_watermark || false;
  const footerText    = company?.invoice_footer_text    || '';
  const logoUrl       = company?.logo_url               || '';

  const lh: Record<string, number> = { small: 48, medium: 68, large: 96 };
  const logoHeight = lh[logoSize] ?? 68;

  /* ── Logo HTML ── */
  const logoTag = logoUrl
    ? `<img src="${esc(logoUrl)}" alt="logo" style="max-height:${logoHeight}px;max-width:200px;object-fit:contain;display:block;">`
    : '';

  const logoWatermark = logoUrl && (logoPosition === 'watermark' || showWatermark)
    ? `<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-15deg);opacity:0.05;z-index:-1;pointer-events:none;"><img src="${esc(logoUrl)}" style="max-height:280px;max-width:280px;object-fit:contain;"></div>`
    : '';

  /* ── Document type label ── */
  const DOC_LABELS: Record<string, string> = {
    FT: 'FATURA', FR: 'FATURA-RECIBO', NC: 'NOTA DE CRÉDITO',
    ND: 'NOTA DE DÉBITO', RC: 'RECIBO', PP: 'PRÓ-FORMA', GT: 'GUIA DE TRANSPORTE',
  };
  const docType  = (inv.document_type || 'FT').toUpperCase();
  const docLabel = DOC_LABELS[docType] ?? docType;

  /* ── Rows ── */
  const rowsHtml = items.map((it: any, idx: number) => `
    <tr>
      <td style="padding:9px 8px;border-bottom:1px solid #eef0f3;font-size:11px;">${idx + 1}</td>
      <td style="padding:9px 8px;border-bottom:1px solid #eef0f3;font-size:11px;">${esc(it.description)}</td>
      <td style="padding:9px 8px;border-bottom:1px solid #eef0f3;font-size:11px;text-align:right;">${Number(it.quantity).toFixed(0)}</td>
      <td style="padding:9px 8px;border-bottom:1px solid #eef0f3;font-size:11px;text-align:right;white-space:nowrap;">${formatAOA(it.price)}</td>
      <td style="padding:9px 8px;border-bottom:1px solid #eef0f3;font-size:11px;text-align:center;">${Number(it.tax_rate).toFixed(0)}%</td>
      <td style="padding:9px 8px;border-bottom:1px solid #eef0f3;font-size:11px;text-align:right;font-weight:700;white-space:nowrap;">${formatAOA(it.total)}</td>
    </tr>`).join('');

  /* ── QR ── */
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
    qrDataUrl = await QRCode.toDataURL(qrPayload, { width: 100, margin: 1, errorCorrectionLevel: 'M' });
  } catch { /* ignore */ }

  /* ── Payment badge ── */
  const payBadge = (() => {
    if (cancelled) return `<span style="background:#fee2e2;color:#b91c1c;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:.3px;">CANCELADA</span>`;
    switch (inv.payment_status) {
      case 'pago':    return `<span style="background:#dcfce7;color:#166534;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;">✓ PAGA</span>`;
      case 'parcial': return `<span style="background:#fef9c3;color:#854d0e;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;">PARCIAL</span>`;
      default:        return `<span style="background:#e0f2fe;color:#0369a1;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;">POR RECEBER</span>`;
    }
  })();

  /* ── Due date (clean format) ── */
  const dueDateStr = inv.due_date
    ? new Date(inv.due_date).toLocaleDateString('pt-AO', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '';

  /* ── Hash (compact — only first+last 8 chars) ── */
  const hashShort = inv.hash
    ? `${String(inv.hash).slice(0, 16)}...${String(inv.hash).slice(-8)}`
    : '';

  /* ── Logo in header per position ── */
  let headerContent = '';
  if (logoPosition === 'top-center' && logoTag) {
    headerContent = `<div style="text-align:center;margin-bottom:10px;">${logoTag.replace('display:block','display:inline-block')}</div>`;
  } else if (logoPosition === 'top-right' && logoTag) {
    headerContent = `<div style="text-align:right;margin-bottom:10px;">${logoTag.replace('display:block','display:inline-block')}</div>`;
  }

  const companyLogoLeft = (logoPosition === 'top-left' && logoTag)
    ? `<div style="margin-bottom:8px;">${logoTag}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="pt-AO"><head><meta charset="utf-8"/>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif;color:#1e293b;font-size:11px;background:#fff;}
  @page{size:A4;margin:14mm 16mm 14mm 16mm;}

  /* Nunca partir estes blocos entre páginas */
  .no-break{page-break-inside:avoid;break-inside:avoid;}

  table{border-collapse:collapse;width:100%;}
</style>
</head><body>

${logoWatermark}

${/* ── CABEÇALHO ──────────────────────────────────────────────── */''}
<div class="no-break" style="background:${headerBg};border-bottom:3px solid ${primaryColor};padding-bottom:14px;margin-bottom:16px;">
  ${headerContent}
  <div style="display:flex;justify-content:space-between;align-items:flex-start;">
    ${/* coluna esquerda: logo + dados empresa */''}
    <div style="max-width:55%;">
      ${companyLogoLeft}
      <div style="font-size:20px;font-weight:900;color:${primaryColor};line-height:1.1;margin-bottom:4px;">${esc(company?.name ?? '')}</div>
      <div style="font-size:10px;color:#475569;line-height:1.6;">
        <span>NIF: <strong>${esc(company?.nif ?? '')}</strong></span>
        ${company?.address ? `<br>${esc(company.address)}` : ''}
        ${company?.city    ? `<br>${esc(company.city)}` : ''}
        ${company?.email   ? `<br>Email: ${esc(company.email)}` : ''}
        ${company?.phone   ? `<br>Tel: ${esc(company.phone)}` : ''}
      </div>
    </div>
    ${/* coluna direita: tipo + número + data */''}
    <div style="text-align:right;">
      <div style="font-size:22px;font-weight:900;color:${primaryColor};line-height:1;">${docLabel}</div>
      <div style="font-size:15px;font-weight:700;color:#334155;margin:3px 0;">${esc(inv.invoice_number)}</div>
      ${payBadge}
      <div style="font-size:10px;color:#64748b;margin-top:5px;">
        <strong>Data de Emissão:</strong> ${esc(formatDateTime(inv.issued_at))}
        ${dueDateStr ? `<br><strong>Válido até:</strong> ${dueDateStr}` : ''}
        ${inv.due_date && docType !== 'PP' ? `<br><strong>Vencimento:</strong> ${dueDateStr}` : ''}
      </div>
    </div>
  </div>
</div>

${/* ── CANCELADA ─────────────────────────────────────────────── */''}
${cancelled ? `<div class="no-break" style="background:#fee2e2;border-left:4px solid #dc2626;padding:10px 14px;margin-bottom:14px;border-radius:0 6px 6px 0;font-size:11px;font-weight:600;color:#991b1b;">⚠️ FATURA CANCELADA — ${esc(inv.cancellation_reason ?? 'Sem motivo registado')}</div>` : ''}

${/* ── BLOCOS EMITENTE / CLIENTE ─────────────────────────────── */''}
<div class="no-break" style="display:flex;gap:12px;margin-bottom:16px;">
  <div style="flex:1;background:#f8fafc;border-left:3px solid ${primaryColor};padding:10px 12px;border-radius:0 6px 6px 0;">
    <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:${primaryColor};margin-bottom:5px;">Emitente</div>
    <div style="font-weight:700;font-size:11px;">${esc(company?.name ?? '')}</div>
    <div style="color:#64748b;font-size:10px;">NIF: ${esc(company?.nif ?? '')}</div>
    ${company?.address ? `<div style="color:#64748b;font-size:10px;">${esc(company.address)}</div>` : ''}
  </div>
  <div style="flex:1;background:#f8fafc;border-left:3px solid ${primaryColor};padding:10px 12px;border-radius:0 6px 6px 0;">
    <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:${primaryColor};margin-bottom:5px;">Cliente / Destinatário</div>
    <div style="font-weight:700;font-size:11px;">${esc(inv.client_name || 'Consumidor Final')}</div>
    <div style="color:#64748b;font-size:10px;">NIF: ${esc(inv.client_nif || '000000000')}</div>
    ${inv.client_address ? `<div style="color:#64748b;font-size:10px;">${esc(inv.client_address)}</div>` : ''}
    ${inv.client_email   ? `<div style="color:#64748b;font-size:10px;">${esc(inv.client_email)}</div>` : ''}
    ${inv.client_phone   ? `<div style="color:#64748b;font-size:10px;">Tel: ${esc(inv.client_phone)}</div>` : ''}
  </div>
  ${inv.notes ? `<div style="flex:1;background:#fffbeb;border-left:3px solid #f59e0b;padding:10px 12px;border-radius:0 6px 6px 0;"><div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:#b45309;margin-bottom:5px;">Notas</div><div style="font-size:10px;color:#78350f;">${esc(inv.notes)}</div></div>` : ''}
</div>

${/* ── DOCUMENTO RELACIONADO / ISENÇÃO ──────────────────────── */''}
${inv.related_document ? `<div class="no-break" style="background:#eff6ff;border-left:3px solid ${primaryColor};padding:8px 12px;margin-bottom:12px;border-radius:0 6px 6px 0;font-size:10px;"><strong>Documento relacionado:</strong> ${esc(inv.related_document)}</div>` : ''}
${inv.tax_exemption_reason ? `<div class="no-break" style="background:#fffbeb;border-left:3px solid #f59e0b;padding:8px 12px;margin-bottom:12px;border-radius:0 6px 6px 0;font-size:10px;"><strong>Isenção de IVA:</strong> ${esc(inv.tax_exemption_reason)}</div>` : ''}

${/* ── TABELA DE ITENS ───────────────────────────────────────── */''}
<table style="margin-bottom:0;">
  <thead>
    <tr style="background:${primaryColor};">
      <th style="padding:9px 8px;color:#fff;text-align:left;font-size:9.5px;text-transform:uppercase;letter-spacing:.4px;width:28px;">#</th>
      <th style="padding:9px 8px;color:#fff;text-align:left;font-size:9.5px;text-transform:uppercase;letter-spacing:.4px;">Artigo / Descrição</th>
      <th style="padding:9px 8px;color:#fff;text-align:right;font-size:9.5px;text-transform:uppercase;letter-spacing:.4px;width:40px;">Qtd</th>
      <th style="padding:9px 8px;color:#fff;text-align:right;font-size:9.5px;text-transform:uppercase;letter-spacing:.4px;width:100px;">Preço Unit.</th>
      <th style="padding:9px 8px;color:#fff;text-align:center;font-size:9.5px;text-transform:uppercase;letter-spacing:.4px;width:40px;">IVA</th>
      <th style="padding:9px 8px;color:#fff;text-align:right;font-size:9.5px;text-transform:uppercase;letter-spacing:.4px;width:100px;">Total</th>
    </tr>
  </thead>
  <tbody>${rowsHtml}</tbody>
</table>

${/* ── TOTAIS + QR — nunca parte de página ─────────────────── */''}
<div class="no-break" style="margin-top:0;border-top:2px solid ${primaryColor};">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:14px 0 0;">
    ${/* QR Code */''}
    ${qrDataUrl ? `
    <div style="text-align:center;min-width:90px;">
      <img src="${qrDataUrl}" width="90" height="90" style="border:1px solid #e2e8f0;border-radius:4px;padding:3px;">
      <div style="font-size:8px;color:#94a3b8;margin-top:3px;line-height:1.3;">Verificação AGT<br>NIF · Nº · Data · Total</div>
    </div>` : '<div></div>'}
    ${/* Totais */''}
    <div style="min-width:240px;">
      <div style="display:flex;justify-content:space-between;padding:6px 12px;border-bottom:1px solid #f1f5f9;font-size:11px;">
        <span style="color:#64748b;">Subtotal</span>
        <span style="font-family:monospace;">${formatAOA(inv.subtotal)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:6px 12px;border-bottom:1px solid #f1f5f9;font-size:11px;">
        <span style="color:#64748b;">IVA</span>
        <span style="font-family:monospace;">${formatAOA(inv.tax)}</span>
      </div>
      ${Number(inv.discount ?? 0) > 0 ? `
      <div style="display:flex;justify-content:space-between;padding:6px 12px;border-bottom:1px solid #f1f5f9;font-size:11px;">
        <span style="color:#64748b;">Desconto</span>
        <span style="font-family:monospace;color:#e11d48;">-${formatAOA(inv.discount)}</span>
      </div>` : ''}
      <div style="display:flex;justify-content:space-between;padding:10px 12px;background:${primaryColor};border-radius:0 0 6px 6px;">
        <span style="color:#fff;font-weight:800;font-size:13px;">TOTAL (AOA)</span>
        <span style="color:#fff;font-weight:800;font-size:13px;font-family:monospace;">${formatAOA(inv.total)}</span>
      </div>
      ${!cancelled && Number(inv.amount_paid ?? 0) > 0 ? `
      <div style="margin-top:4px;">
        <div style="display:flex;justify-content:space-between;padding:5px 12px;font-size:10px;">
          <span style="color:#64748b;">Já recebido</span>
          <span style="color:#16a34a;font-family:monospace;">${formatAOA(Number(inv.amount_paid))}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:5px 12px;font-size:11px;font-weight:700;">
          <span>Em dívida</span>
          <span style="font-family:monospace;">${formatAOA(Math.max(0, Number(inv.total) - Number(inv.amount_paid)))}</span>
        </div>
      </div>` : ''}
    </div>
  </div>
</div>

${/* ── RODAPÉ ────────────────────────────────────────────────── */''}
<div class="no-break" style="margin-top:18px;padding-top:12px;border-top:1px solid #e2e8f0;">
  ${footerText ? `<div style="text-align:center;font-size:11px;color:#475569;margin-bottom:8px;font-style:italic;">${esc(footerText)}</div>` : ''}
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 12px;">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
      <div style="font-size:9px;color:#64748b;">
        <strong>Compliance AGT:</strong> Documento gerado electronicamente com hash SHA-256${inv.signature ? ' e assinatura RSA-SHA256' : ''}.<br>
        ${hashShort ? `<span style="font-family:monospace;font-size:8.5px;color:#94a3b8;">Hash: ${hashShort}</span>` : ''}
      </div>
      <div style="font-size:9px;color:#94a3b8;text-align:right;">${certifiedFooter}</div>
    </div>
  </div>
</div>

</body></html>`;
}

/**
 * Gera PDF via AbacusAI com backoff exponencial.
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
        margin: { top: '14mm', right: '16mm', bottom: '14mm', left: '16mm' },
      },
    }),
  });

  if (!createResp.ok) throw new Error(`Falha ao criar pedido PDF: ${createResp.status}`);
  const { request_id } = await createResp.json();
  if (!request_id) throw new Error('Sem request_id');

  const TIMEOUT_MS = 30_000;
  const deadline   = Date.now() + TIMEOUT_MS;
  let delay        = 500;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, delay));
    delay = Math.min(delay * 2, 2000);

    const st = await fetch('https://apps.abacus.ai/api/getConvertHtmlToPdfStatus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request_id, deployment_token: apiKey }),
    });

    if (!st.ok) continue;
    const j = await st.json();
    if (j?.status === 'SUCCESS') {
      const b64 = j?.result?.result;
      if (!b64) throw new Error('PDF vazio');
      return Buffer.from(b64, 'base64');
    }
    if (j?.status === 'FAILED') throw new Error(j?.result?.error ?? 'PDF falhou');
  }

  throw new Error(`Timeout PDF (>${TIMEOUT_MS / 1000}s)`);
}
