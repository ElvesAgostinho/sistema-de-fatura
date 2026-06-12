import { createAdminClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import QRCode from 'qrcode';

export const dynamic = 'force-dynamic';

function esc(s: any) {
  return String(s ?? '').replace(/[&<>"']/g, (c: string) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
function fmtAOA(n: any) {
  return `${Number(n ?? 0).toLocaleString('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kz`;
}
function fmtDate(d: any) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('pt-AO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default async function A4PrintPage({ params }: { params: { id: string } }) {
  const admin = createAdminClient();

  const { data: invoice } = await admin
    .from('invoices')
    .select('*, items:invoice_items(*), company:companies(*)')
    .eq('id', params.id)
    .maybeSingle();

  if (!invoice) return notFound();

  const { data: fcfg } = await admin
    .from('fiscal_config')
    .select('mode, agt_certificado_numero')
    .eq('company_id', invoice.company_id)
    .maybeSingle();

  const company = invoice.company ?? {};
  const items = invoice.items ?? [];
  const cancelled = invoice.status === 'cancelled';

  const DOC_LABELS: Record<string, string> = {
    FT: 'FATURA', FR: 'FATURA-RECIBO', NC: 'NOTA DE CRÉDITO',
    ND: 'NOTA DE DÉBITO', RC: 'RECIBO', PP: 'FATURA PRÓ-FORMA', GT: 'GUIA DE TRANSPORTE',
  };
  const docLabel = DOC_LABELS[invoice.document_type] ?? invoice.document_type;
  const primaryColor = company.invoice_primary_color || '#2563eb';

  // QR Code
  const qrPayload = [
    company.nif ?? '', invoice.client_nif ?? '', invoice.invoice_number ?? '',
    String(invoice.issued_at ?? '').slice(0, 10),
    Number(invoice.total ?? 0).toFixed(2),
    Number(invoice.tax ?? 0).toFixed(2),
    String(invoice.hash ?? '').slice(0, 16),
  ].join('|');
  let qrDataUrl = '';
  try { qrDataUrl = await QRCode.toDataURL(qrPayload, { width: 100, margin: 1, errorCorrectionLevel: 'M' }); } catch {}

  // Logo
  const logoUrl = company.logo_url ?? '';
  const logoTag = logoUrl ? `<img src="${esc(logoUrl)}" alt="logo" style="max-height:60px;max-width:160px;object-fit:contain;display:block;margin-bottom:10px;">` : '';

  // Status badge
  const statusStyle = cancelled
    ? 'color:#b91c1c;background:#fee2e2;border:1px solid #fecaca;'
    : invoice.payment_status === 'pago'
    ? 'color:#15803d;background:#dcfce7;border:1px solid #bbf7d0;'
    : 'color:#1d4ed8;background:#dbeafe;border:1px solid #bfdbfe;';
  const statusLabel = cancelled ? 'CANCELADA' : invoice.payment_status === 'pago' ? '✓ PAGA' : 'PENDENTE';

  // Footer AGT
  const certFooter = fcfg?.mode === 'certificado' && fcfg?.agt_certificado_numero
    ? `Processado por programa certificado nº ${esc(fcfg.agt_certificado_numero)} · FaturaAO`
    : 'Processado por FaturaAO · Em conformidade com AGT';

  const hashShort = invoice.hash
    ? String(invoice.hash).slice(0, 4).toUpperCase()
    : '';

  // Due date
  const dueDate = invoice.due_date
    ? new Date(invoice.due_date).toLocaleDateString('pt-AO', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '';

  // Item rows
  const rows = items.map((it: any, i: number) => `
    <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'};">
      <td style="padding:10px 12px;font-size:11px;color:#6b7280;border-bottom:1px solid #f3f4f6;">${i + 1}</td>
      <td style="padding:10px 12px;font-size:11.5px;border-bottom:1px solid #f3f4f6;">${esc(it.description)}</td>
      <td style="padding:10px 12px;font-size:11.5px;text-align:center;border-bottom:1px solid #f3f4f6;">${Number(it.quantity).toFixed(0)}</td>
      <td style="padding:10px 12px;font-size:11.5px;text-align:right;border-bottom:1px solid #f3f4f6;white-space:nowrap;">${fmtAOA(it.price)}</td>
      <td style="padding:10px 12px;font-size:11.5px;text-align:center;border-bottom:1px solid #f3f4f6;color:#6b7280;">${Number(it.tax_rate ?? 14).toFixed(0)}%</td>
      <td style="padding:10px 12px;font-size:11.5px;text-align:right;font-weight:600;border-bottom:1px solid #f3f4f6;white-space:nowrap;">${fmtAOA(it.total)}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html lang="pt-AO"><head><meta charset="utf-8">
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Segoe UI','Helvetica Neue',Helvetica,Arial,sans-serif;color:#111827;background:#fff;font-size:11.5px;line-height:1.5;}
  .no-break{page-break-inside:avoid;break-inside:avoid;}
  table{border-collapse:collapse;width:100%;}
  .totals-grand{display:flex;justify-content:space-between;padding:12px 14px;background:${primaryColor};}
  .totals-grand span{color:#fff;font-weight:800;font-size:13px;}
  ${cancelled ? '.wm-cancelled{position:fixed;top:40%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:100px;font-weight:900;color:rgba(185,28,28,.07);pointer-events:none;z-index:-1;letter-spacing:4px;}' : ''}
</style></head><body>

${cancelled ? '<div class="wm-cancelled">CANCELADA</div>' : ''}

<!-- CABEÇALHO XERO -->
<div class="no-break" style="padding-bottom:20px;border-bottom:2px solid #e5e7eb;margin-bottom:22px;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:24px;">
    <div style="flex:1;">
      ${logoTag}
      <div style="font-size:24px;font-weight:800;color:${primaryColor};letter-spacing:-.5px;line-height:1.1;margin-bottom:5px;">${esc(company.name)}</div>
      <div style="font-size:10.5px;color:#6b7280;line-height:1.7;">
        NIF: <strong style="color:#374151;">${esc(company.nif)}</strong>
        ${company.address ? `<br>${esc(company.address)}` : ''}
        ${company.city ? `<br>${esc(company.city)}` : ''}
        ${company.email ? `<br>Email: ${esc(company.email)}` : ''}
        ${company.phone ? `<br>Tel: ${esc(company.phone)}` : ''}
      </div>
    </div>
    <div style="flex-shrink:0;min-width:200px;text-align:right;">
      <div style="font-size:22px;font-weight:800;color:${primaryColor};letter-spacing:-.3px;">${docLabel}</div>
      <div style="font-size:15px;font-weight:600;color:#374151;margin-top:3px;">${esc(invoice.invoice_number)}</div>
      <div style="margin-top:6px;">
        <span style="font-size:10px;padding:3px 10px;border-radius:20px;font-weight:700;${statusStyle}">${statusLabel}</span>
      </div>
      <div style="font-size:10.5px;color:#6b7280;margin-top:6px;line-height:1.7;">
        <strong style="color:#374151;">Data de Emissão:</strong> ${fmtDate(invoice.issued_at)}
        ${dueDate && invoice.document_type === 'PP' ? `<br><strong style="color:${primaryColor};">Válido até:</strong> ${dueDate}` : ''}
        ${dueDate && invoice.document_type !== 'PP' ? `<br><strong style="color:#374151;">Vencimento:</strong> ${dueDate}` : ''}
      </div>
    </div>
  </div>
</div>

${cancelled ? `<div class="no-break" style="background:#fee2e2;border-left:3px solid #dc2626;border-radius:0 6px 6px 0;padding:10px 14px;margin-bottom:16px;font-size:11px;color:#991b1b;font-weight:600;">⚠ FATURA CANCELADA — ${esc(invoice.cancellation_reason ?? 'Sem motivo')}</div>` : ''}

<!-- EMITENTE + CLIENTE -->
<div class="no-break" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;">
    <div style="font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#9ca3af;margin-bottom:8px;">Emitente</div>
    <div style="font-size:12px;font-weight:600;color:#111827;margin-bottom:3px;">${esc(company.name)}</div>
    <div style="font-size:10.5px;color:#6b7280;">NIF: ${esc(company.nif)}</div>
    ${company.address ? `<div style="font-size:10.5px;color:#6b7280;">${esc(company.address)}</div>` : ''}
  </div>
  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;">
    <div style="font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#9ca3af;margin-bottom:8px;">Cliente / Destinatário</div>
    <div style="font-size:12px;font-weight:600;color:#111827;margin-bottom:3px;">${esc(invoice.client_name || 'Consumidor Final')}</div>
    <div style="font-size:10.5px;color:#6b7280;">NIF: ${esc(invoice.client_nif || '000000000')}</div>
    ${invoice.client_address ? `<div style="font-size:10.5px;color:#6b7280;">${esc(invoice.client_address)}</div>` : ''}
  </div>
</div>

<!-- TABELA DE ITENS -->
<table style="margin-bottom:0;">
  <thead>
    <tr style="border-bottom:2px solid #111827;">
      <th style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;padding:10px 12px;text-align:left;width:26px;">#</th>
      <th style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;padding:10px 12px;text-align:left;">Artigo / Descrição</th>
      <th style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;padding:10px 12px;text-align:center;width:44px;">Qtd</th>
      <th style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;padding:10px 12px;text-align:right;width:110px;">Preço Unit.</th>
      <th style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;padding:10px 12px;text-align:center;width:44px;">IVA</th>
      <th style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;padding:10px 12px;text-align:right;width:110px;">Total</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>

<!-- TOTAIS + QR -->
<div class="no-break" style="margin-top:0;border-top:2px solid #111827;padding-top:18px;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:20px;">
    <div>
      ${qrDataUrl ? `
      <div style="display:inline-flex;align-items:flex-start;gap:10px;border:1px solid #e5e7eb;border-radius:8px;padding:10px;">
        <img src="${qrDataUrl}" width="90" height="90" style="display:block;border-radius:3px;">
        <div style="font-size:9px;color:#9ca3af;max-width:90px;line-height:1.5;padding-top:2px;">
          <strong style="color:#6b7280;display:block;margin-bottom:4px;">Verificação AGT</strong>
          NIF<br>Nº Fatura<br>Data<br>Total<br>Hash
        </div>
      </div>` : ''}
      ${company.invoice_footer_text ? `<div style="margin-top:10px;max-width:220px;font-size:10.5px;color:#374151;font-style:italic;line-height:1.6;">${esc(company.invoice_footer_text)}</div>` : ''}
    </div>
    <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;min-width:230px;max-width:260px;">
      <div style="display:flex;justify-content:space-between;padding:8px 14px;font-size:11.5px;border-bottom:1px solid #f3f4f6;">
        <span style="color:#6b7280;">Subtotal</span><span style="font-family:'Courier New',monospace;font-size:11px;">${fmtAOA(invoice.subtotal)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:8px 14px;font-size:11.5px;border-bottom:1px solid #f3f4f6;">
        <span style="color:#6b7280;">IVA</span><span style="font-family:'Courier New',monospace;font-size:11px;">${fmtAOA(invoice.tax)}</span>
      </div>
      <div class="totals-grand"><span>TOTAL (AOA)</span><span>${fmtAOA(invoice.total)}</span></div>
      ${Number(invoice.amount_paid ?? 0) > 0 ? `
      <div style="display:flex;justify-content:space-between;padding:8px 14px;font-size:11.5px;border-bottom:1px solid #f3f4f6;">
        <span style="color:#6b7280;">Já recebido</span><span style="color:#15803d;font-family:'Courier New',monospace;font-size:11px;">${fmtAOA(invoice.amount_paid)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:8px 14px;font-size:11.5px;">
        <span style="font-weight:600;">Em dívida</span><span style="font-weight:600;font-family:'Courier New',monospace;font-size:11px;">${fmtAOA(Math.max(0, Number(invoice.total) - Number(invoice.amount_paid)))}</span>
      </div>` : ''}
    </div>
  </div>
</div>

<!-- RODAPÉ AGT -->
<div class="no-break" style="margin-top:20px;">
  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:10px 14px;font-size:9.5px;color:#9ca3af;">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
      <div>${hashShort ? `Hash: <code style="font-size:8.5px;color:#9ca3af;">${hashShort}</code>` : ''}</div>
      <div style="text-align:right;">${certFooter}</div>
    </div>
  </div>
</div>

</body></html>`;

  return (
    <div
      style={{ background: '#f3f4f6', minHeight: '100vh', display: 'flex', justifyContent: 'center', padding: '32px 0' }}
      className="print:p-0 print:bg-white print:block"
    >
      <div
        dangerouslySetInnerHTML={{ __html: html }}
        style={{ 
          background: 'white', 
          width: '210mm', 
          minHeight: '297mm',
          padding: '18mm', 
          boxSizing: 'border-box',
          boxShadow: '0 4px 24px rgba(0,0,0,0.12)' 
        }}
        className="print:shadow-none print:w-full print:min-h-0 print:m-0"
      />
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: A4; margin: 0; }
          body { background: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      ` }} />
      <script dangerouslySetInnerHTML={{ __html: `window.onload = function(){ setTimeout(function(){ window.print(); }, 600); }` }} />
    </div>
  );
}
