import QRCode from 'qrcode';
import { formatAOA, formatDateTime } from '@/lib/utils';

function esc(s: any): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]!));
}

/**
 * Fatura A4 estilo Xero — design premium:
 *  - Fundo branco limpo (sem header colorido pesado)
 *  - Empresa topo-esquerda, tipo/número topo-direita (igual ao Xero)
 *  - Separadores subtis em vez de blocos coloridos
 *  - Tabela ultra-limpa com linhas alternadas subtis
 *  - Totais em caixa elegante bottom-right
 *  - Marca de água CANCELADA diagonal
 *  - QR Code e rodapé AGT compactos
 */
export async function buildInvoiceHtml(inv: any, items: any[], company: any, fcfg: any, viaLabel: string = 'Original'): Promise<string> {
  /* ── AGT footer ── */
  const certifiedFooter = fcfg?.mode === 'certificado' && fcfg?.agt_certificado_numero
    ? `Processado por programa certificado n&ordm; ${esc(fcfg.agt_certificado_numero)} &bull; FaturaAO`
    : `Processado por FaturaAO &bull; Em conformidade com AGT`;

  const cancelled = inv.status === 'cancelled';

  /* ── Branding ── */
  const primaryColor  = company?.invoice_primary_color  || '#2563eb';
  const logoPosition  = company?.logo_position          || 'top-left';
  const logoSize      = company?.logo_size              || 'medium';
  const showWatermark = company?.invoice_show_watermark || false;
  const footerText    = company?.invoice_footer_text    || '';
  const logoUrl       = company?.logo_url               || '';
  const headerBg      = company?.invoice_header_bg      || '#ffffff';

  const logoH: Record<string, number> = { small: 44, medium: 64, large: 90 };
  const lh = logoH[logoSize] ?? 64;

  /* ── Logo markup ── */
  const logoTag = logoUrl
    ? `<img src="${esc(logoUrl)}" alt="logo" style="max-height:${lh}px;max-width:180px;object-fit:contain;display:block;">`
    : '';

  const watermarkDiv = logoUrl && (logoPosition === 'watermark' || showWatermark)
    ? `<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-18deg);opacity:0.04;z-index:0;pointer-events:none;"><img src="${esc(logoUrl)}" style="width:300px;height:300px;object-fit:contain;"></div>`
    : '';

  /* ── Document labels ── */
  const DOC_LABELS: Record<string, string> = {
    FT:'FATURA', FR:'FATURA-RECIBO', NC:'NOTA DE CRÉDITO',
    ND:'NOTA DE DÉBITO', RC:'RECIBO', PP:'PRÓ-FORMA', GT:'GUIA DE TRANSPORTE',
  };
  const docType  = (inv.document_type || 'FT').toUpperCase();
  const docLabel = DOC_LABELS[docType] ?? docType;

  /* ── Due date (no trailing comma) ── */
  const dueDateStr = inv.due_date
    ? new Date(inv.due_date).toLocaleDateString('pt-AO', { day:'2-digit', month:'2-digit', year:'numeric' })
    : '';

  /* ── Payment status ── */
  const statusStyles: Record<string, string> = {
    pago:    'color:#15803d;background:#dcfce7;border:1px solid #bbf7d0;',
    parcial: 'color:#92400e;background:#fef3c7;border:1px solid #fde68a;',
    default: 'color:#1d4ed8;background:#dbeafe;border:1px solid #bfdbfe;',
  };
  const statusLabels: Record<string, string> = { pago:'✓ PAGA', parcial:'PARCIAL', default: cancelled ? 'CANCELADA' : 'PENDENTE' };
  const statusKey = cancelled ? 'default' : (inv.payment_status === 'pago' ? 'pago' : inv.payment_status === 'parcial' ? 'parcial' : 'default');
  const statusStyle = cancelled ? 'color:#b91c1c;background:#fee2e2;border:1px solid #fecaca;' : statusStyles[statusKey];
  const statusLabel = cancelled ? 'CANCELADA' : statusLabels[statusKey];

  /* ── Logo positioning in header ── */
  let logoLeftHtml = '';
  let logoCenterHtml = '';
  let logoRightHtml = '';
  if (logoUrl && logoPosition === 'top-left')   logoLeftHtml   = `<div style="margin-bottom:10px;">${logoTag}</div>`;
  if (logoUrl && logoPosition === 'top-center') logoCenterHtml = `<div style="text-align:center;margin-bottom:14px;">${logoTag.replace('display:block','display:inline-block')}</div>`;
  if (logoUrl && logoPosition === 'top-right')  logoRightHtml  = `<div style="text-align:right;margin-bottom:10px;">${logoTag.replace('display:block','display:inline-block')}</div>`;

  /* ── Table rows ── */
  const rows = items.map((it: any, i: number) => `
    <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'};">
      <td style="padding:10px 12px;font-size:11px;color:#6b7280;border-bottom:1px solid #f3f4f6;">${i+1}</td>
      <td style="padding:10px 12px;font-size:11.5px;border-bottom:1px solid #f3f4f6;">${esc(it.description)}</td>
      <td style="padding:10px 12px;font-size:11.5px;text-align:center;border-bottom:1px solid #f3f4f6;">${Number(it.quantity).toFixed(0)}</td>
      <td style="padding:10px 12px;font-size:11.5px;text-align:right;border-bottom:1px solid #f3f4f6;white-space:nowrap;">${formatAOA(it.price)}</td>
      <td style="padding:10px 12px;font-size:11.5px;text-align:center;border-bottom:1px solid #f3f4f6;color:#6b7280;">${Number(it.tax_rate).toFixed(0)}%</td>
      <td style="padding:10px 12px;font-size:11.5px;text-align:right;font-weight:600;border-bottom:1px solid #f3f4f6;white-space:nowrap;">${formatAOA(it.total)}</td>
    </tr>`).join('');

  /* ── Tax Summary Calculation ── */
  const taxGroups = new Map<string, { rate: number; reason: string; base: number; tax: number }>();
  for (const it of items) {
    const rate = Number(it.tax_rate ?? 14);
    const reason = rate === 0 ? (it.tax_exemption_reason || inv.tax_exemption_reason || 'Isento nos termos gerais') : '';
    const key = rate === 0 ? `0|${reason}` : `${rate}|`;
    const lineTotal = Number(it.total ?? 0);
    const sub = lineTotal / (1 + rate / 100);
    const taxAmt = lineTotal - sub;

    if (!taxGroups.has(key)) {
      taxGroups.set(key, { rate, reason, base: 0, tax: 0 });
    }
    const group = taxGroups.get(key)!;
    group.base += sub;
    group.tax += taxAmt;
  }
  const taxRowsHtml = Array.from(taxGroups.values()).map(g => `
    <tr>
      <td style="padding:6px 12px;border-bottom:1px solid #f3f4f6;">${g.rate}%</td>
      <td style="padding:6px 12px;border-bottom:1px solid #f3f4f6;text-align:right;">${formatAOA(g.base)}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #f3f4f6;text-align:right;">${formatAOA(g.tax)}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #f3f4f6;font-size:10px;">${esc(g.reason)}</td>
    </tr>
  `).join('');

  const taxSummaryHtml = `
    <div class="no-break" style="margin-top:20px;margin-bottom:20px;">
      <div style="font-size:10.5px;font-weight:700;text-transform:uppercase;color:#6b7280;margin-bottom:6px;">Quadro Resumo de Impostos</div>
      <table style="width:100%;font-size:11px;border:1px solid #e5e7eb;">
        <thead>
          <tr style="background:#f9fafb;border-bottom:1px solid #e5e7eb;">
            <th style="padding:6px 12px;text-align:left;color:#6b7280;font-weight:600;">Taxa</th>
            <th style="padding:6px 12px;text-align:right;color:#6b7280;font-weight:600;">Incidência</th>
            <th style="padding:6px 12px;text-align:right;color:#6b7280;font-weight:600;">Imposto</th>
            <th style="padding:6px 12px;text-align:left;color:#6b7280;font-weight:600;">Motivo Isenção</th>
          </tr>
        </thead>
        <tbody>${taxRowsHtml}</tbody>
      </table>
    </div>
  `;

  /* ── QR Code ── */
  const qrPayload = [company?.nif??'', inv.client_nif??'', inv.invoice_number??'',
    String(inv.issued_at??'').slice(0,10), Number(inv.total??0).toFixed(2),
    Number(inv.tax??0).toFixed(2), String(inv.hash??'').slice(0,16)].join('|');

  let qrDataUrl = '';
  try { qrDataUrl = await QRCode.toDataURL(qrPayload, { width:96, margin:1, errorCorrectionLevel:'M' }); } catch {}

  /* 🔒 Hash (compact) */
  const hashShort = inv.hash ? String(inv.hash).slice(0, 4).toUpperCase() : '';

  return `<!DOCTYPE html>
<html lang="pt-AO"><head><meta charset="utf-8"/>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Segoe UI','Helvetica Neue',Helvetica,Arial,sans-serif;color:#111827;background:#fff;font-size:11.5px;line-height:1.5;}
  @page{size:A4;margin:18mm 18mm 16mm 18mm;}
  .no-break{page-break-inside:avoid;break-inside:avoid;}
  table{border-collapse:collapse;width:100%;}

  /* ── XERO STYLE: cabeçalho limpo, sem fundo pesado ── */
  .xero-header{
    background:${headerBg};
    padding-bottom:20px;
    border-bottom:1px solid #e5e7eb;
    margin-bottom:22px;
  }
  .company-name{
    font-size:24px;font-weight:800;color:${primaryColor};
    letter-spacing:-.5px;line-height:1.1;margin-bottom:5px;
  }
  .company-details{font-size:10.5px;color:#6b7280;line-height:1.7;}
  .company-details strong{color:#374151;}

  .doc-type-label{
    font-size:22px;font-weight:800;color:${primaryColor};
    letter-spacing:-.3px;text-align:right;line-height:1.1;
  }
  .doc-number{font-size:15px;font-weight:600;color:#374151;text-align:right;margin-top:3px;}
  .doc-dates{font-size:10.5px;color:#6b7280;text-align:right;margin-top:6px;line-height:1.7;}

  /* ── SECÇÕES DE INFO (Xero usa caixas com bordas subtis) ── */
  .info-section{
    background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;
    padding:14px 16px;margin-bottom:16px;
  }
  .info-label{
    font-size:9.5px;font-weight:700;text-transform:uppercase;
    letter-spacing:.8px;color:#9ca3af;margin-bottom:8px;
  }
  .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
  .info-field label{font-size:9.5px;color:#9ca3af;display:block;margin-bottom:2px;}
  .info-field strong{font-size:12px;color:#111827;font-weight:600;}

  /* ── TABELA ESTILO XERO ── */
  .items-table thead tr{border-bottom:2px solid #111827;}
  .items-table th{
    font-size:10px;font-weight:700;text-transform:uppercase;
    letter-spacing:.5px;color:#6b7280;padding:10px 12px;text-align:left;
  }
  .items-table th.r{text-align:right;}
  .items-table th.c{text-align:center;}

  /* ── TOTAIS ── */
  .totals-box{
    border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;
    min-width:230px;max-width:260px;
  }
  .totals-row{display:flex;justify-content:space-between;padding:8px 14px;font-size:11.5px;border-bottom:1px solid #f3f4f6;}
  .totals-row span:last-child{font-family:'Courier New',monospace;font-size:11px;}
  .totals-grand{display:flex;justify-content:space-between;padding:12px 14px;background:${primaryColor};}
  .totals-grand span{color:#fff;font-weight:800;font-size:13px;}
  .totals-grand span:last-child{font-family:'Courier New',monospace;}

  /* ── RODAPÉ ── */
  .footer-box{
    background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;
    padding:10px 14px;font-size:9.5px;color:#9ca3af;
  }

  /* ── CANCELADA WATERMARK ── */
  .wm-cancelled{
    position:fixed;top:40%;left:50%;
    transform:translate(-50%,-50%) rotate(-30deg);
    font-size:100px;font-weight:900;
    color:rgba(185,28,28,.07);pointer-events:none;z-index:-1;
    letter-spacing:4px;
  }
</style>
</head><body>

${watermarkDiv}
${cancelled ? '<div class="wm-cancelled">CANCELADA</div>' : ''}

${/* ════ CABEÇALHO — estilo Xero ════ */''}
<div class="xero-header no-break">
  ${logoCenterHtml}
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:24px;">
    ${/* Empresa: esquerda */''}
    <div style="flex:1;">
      ${logoLeftHtml}
      <div class="company-name">${esc(company?.name ?? '')}</div>
      <div class="company-details">
        NIF: <strong>${esc(company?.nif ?? '')}</strong>
        ${company?.address ? `<br>${esc(company.address)}` : ''}
        ${company?.city    ? `<br>${esc(company.city)}` : ''}
        ${company?.email   ? `<br>Email: ${esc(company.email)}` : ''}
        ${company?.phone   ? `<br>Tel: ${esc(company.phone)}` : ''}
      </div>
    </div>
    ${/* Documento: direita */''}
    <div style="flex-shrink:0;min-width:200px;">
      ${logoRightHtml}
      <div style="font-size:11px;color:#6b7280;margin-bottom:4px;font-weight:600;text-align:right;">${viaLabel}</div>
      <div class="doc-type-label">${docLabel}</div>
      <div class="doc-number">${esc(inv.invoice_number)}</div>
      <div style="margin-top:6px;text-align:right;">
        <span style="font-size:10px;padding:3px 10px;border-radius:20px;font-weight:700;${statusStyle}">${statusLabel}</span>
      </div>
      <div class="doc-dates">
        <strong style="color:#374151;">Data de Emissão:</strong> ${esc(formatDateTime(inv.issued_at))}
        ${dueDateStr && docType === 'PP'    ? `<br><strong style="color:${primaryColor};">Válido até:</strong> ${dueDateStr}` : ''}
        ${dueDateStr && docType !== 'PP'    ? `<br><strong style="color:#374151;">Vencimento:</strong> ${dueDateStr}` : ''}
      </div>
    </div>
  </div>
</div>

${cancelled ? `<div class="no-break" style="background:#fee2e2;border-left:3px solid #dc2626;border-radius:0 6px 6px 0;padding:10px 14px;margin-bottom:16px;font-size:11px;color:#991b1b;font-weight:600;">⚠ FATURA CANCELADA — ${esc(inv.cancellation_reason ?? 'Sem motivo registado')}</div>` : ''}
${inv.related_document ? `<div class="no-break" style="background:#eff6ff;border-left:3px solid ${primaryColor};border-radius:0 6px 6px 0;padding:8px 14px;margin-bottom:14px;font-size:10.5px;">Documento relacionado: <strong>${esc(inv.related_document)}</strong></div>` : ''}
${inv.tax_exemption_reason ? `<div class="no-break" style="background:#fffbeb;border-left:3px solid #f59e0b;border-radius:0 6px 6px 0;padding:8px 14px;margin-bottom:14px;font-size:10.5px;"><strong>Isenção de IVA:</strong> ${esc(inv.tax_exemption_reason)}</div>` : ''}

${/* ════ CLIENTE + EMITENTE — estilo Xero (caixas subtis) ════ */''}
<div class="no-break" style="display:grid;grid-template-columns:1fr 1fr${inv.notes ? ' 1fr' : ''};gap:12px;margin-bottom:20px;">
  <div class="info-section">
    <div class="info-label">Emitente</div>
    <div style="font-size:12px;font-weight:600;color:#111827;margin-bottom:3px;">${esc(company?.name ?? '')}</div>
    <div style="font-size:10.5px;color:#6b7280;">NIF: ${esc(company?.nif ?? '')}</div>
    ${company?.address ? `<div style="font-size:10.5px;color:#6b7280;">${esc(company.address)}</div>` : ''}
  </div>
  <div class="info-section">
    <div class="info-label">Cliente / Destinatário</div>
    <div style="font-size:12px;font-weight:600;color:#111827;margin-bottom:3px;">${esc(inv.client_name || 'Consumidor Final')}</div>
    <div style="font-size:10.5px;color:#6b7280;">NIF: ${esc(inv.client_nif || '000000000')}</div>
    ${inv.client_address ? `<div style="font-size:10.5px;color:#6b7280;">${esc(inv.client_address)}</div>` : ''}
    ${inv.client_email   ? `<div style="font-size:10.5px;color:#6b7280;">${esc(inv.client_email)}</div>` : ''}
    ${inv.client_phone   ? `<div style="font-size:10.5px;color:#6b7280;">Tel: ${esc(inv.client_phone)}</div>` : ''}
  </div>
  ${inv.notes ? `<div class="info-section"><div class="info-label">Notas</div><div style="font-size:10.5px;color:#374151;">${esc(inv.notes)}</div></div>` : ''}
</div>

${/* ════ TABELA DE ITENS — estilo Xero ════ */''}
<table class="items-table" style="margin-bottom:0;">
  <thead>
    <tr>
      <th style="width:26px;">#</th>
      <th>Descrição / Produto ou Serviço</th>
      <th class="c" style="width:44px;">Qtd</th>
      <th class="r" style="width:110px;">Preço Unit.</th>
      <th class="c" style="width:44px;">IVA</th>
      <th class="r" style="width:110px;">Total</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>

${/* ════ TOTAIS + QR — nunca parte de página ════ */''}
<div class="no-break" style="margin-top:0;border-top:2px solid #111827;padding-top:18px;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:20px;">

    ${/* QR e verificação */''}
    <div>
      ${qrDataUrl ? `
      <div style="display:inline-flex;align-items:flex-start;gap:10px;border:1px solid #e5e7eb;border-radius:8px;padding:10px;">
        <img src="${qrDataUrl}" width="86" height="86" style="display:block;border-radius:3px;">
        <div style="font-size:9px;color:#9ca3af;max-width:90px;line-height:1.5;padding-top:2px;">
          <strong style="color:#6b7280;display:block;margin-bottom:4px;">Verificação AGT</strong>
          NIF<br>Nº Fatura<br>Data<br>Total<br>Hash
        </div>
      </div>` : ''}
      
      ${(company?.bank_iban || company?.bank_account) && !cancelled && Number(inv.total) > Number(inv.amount_paid ?? 0) ? `
      <div style="margin-top:12px;padding:8px 12px;background:#f3f4f6;border-radius:6px;max-width:250px;font-size:9.5px;color:#4b5563;line-height:1.5;">
        <strong style="color:#111827;font-size:10px;display:block;margin-bottom:2px;">Pagamento por Transferência:</strong>
        ${company.bank_name ? `Banco: ${esc(company.bank_name)}<br>` : ''}
        ${company.bank_account ? `Conta: ${esc(company.bank_account)}<br>` : ''}
        ${company.bank_iban ? `IBAN: <strong>${esc(company.bank_iban)}</strong>` : ''}
      </div>` : ''}

      ${footerText ? `<div style="margin-top:10px;max-width:220px;font-size:10.5px;color:#374151;font-style:italic;line-height:1.6;">${esc(footerText)}</div>` : ''}
    </div>

    ${/* Totais */''}
    <div class="totals-box">
      <div class="totals-row"><span style="color:#6b7280;">Subtotal</span><span>${formatAOA(inv.subtotal)}</span></div>
      <div class="totals-row"><span style="color:#6b7280;">IVA</span><span>${formatAOA(inv.tax)}</span></div>
      ${Number(inv.discount ?? 0) > 0 ? `<div class="totals-row"><span style="color:#6b7280;">Desconto</span><span style="color:#dc2626;">-${formatAOA(inv.discount)}</span></div>` : ''}
      <div class="totals-grand"><span>TOTAL (AOA)</span><span>${formatAOA(inv.total)}</span></div>
      ${!cancelled && Number(inv.amount_paid ?? 0) > 0 ? `
      <div class="totals-row"><span style="color:#6b7280;">Já recebido</span><span style="color:#15803d;">${formatAOA(Number(inv.amount_paid))}</span></div>
      <div class="totals-row"><span style="font-weight:600;">Em dívida</span><span style="font-weight:600;">${formatAOA(Math.max(0, Number(inv.total) - Number(inv.amount_paid)))}</span></div>
      ` : ''}
    </div>

  </div>
</div>

${taxSummaryHtml}

${/* ════ RODAPÉ AGT compacto ════ */''}
<div class="no-break" style="margin-top:20px;">
  <div class="footer-box">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
      <div>
        ${hashShort ? `<span>Hash: <code style="font-size:8.5px;color:#9ca3af;">${hashShort}</code></span>` : ''}
        ${inv.signature ? `&nbsp;&bull;&nbsp;<span>Assinado digitalmente RSA-SHA256</span>` : ''}
      </div>
      <div style="text-align:right;">${certifiedFooter}</div>
    </div>
  </div>
</div>

</body></html>`;
}

/**
 * Gera PDF via AbacusAI com backoff exponencial (max 30s).
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
        margin: { top: '18mm', right: '18mm', bottom: '16mm', left: '18mm' },
      },
    }),
  });

  if (!createResp.ok) throw new Error(`Falha PDF: ${createResp.status}`);
  const { request_id } = await createResp.json();
  if (!request_id) throw new Error('Sem request_id');

  const deadline = Date.now() + 30_000;
  let delay = 500;

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

  throw new Error('Timeout PDF (>30s)');
}
