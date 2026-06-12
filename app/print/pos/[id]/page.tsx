import { createAdminClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import QRCode from 'qrcode';

export const dynamic = 'force-dynamic';

function fmtAOA(n: any) {
  return `${Number(n ?? 0).toLocaleString('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kz`;
}
function fmtDate(d: any) {
  if (!d) return '';
  return new Date(d).toLocaleString('pt-AO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function esc(s: any) {
  return String(s ?? '').replace(/[&<>"']/g, (c: string) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

export default async function PosReceiptPrintPage({ params, searchParams }: { params: { id: string }, searchParams?: { via?: string } }) {
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

  const DOC_LABELS: Record<string, string> = {
    FT: 'FATURA', FR: 'FATURA-RECIBO', NC: 'NOTA CRÉDITO',
    ND: 'NOTA DÉBITO', RC: 'RECIBO', PP: 'PRÓ-FORMA', GT: 'GUIA TRANSPORTE',
  };
  const docLabel = DOC_LABELS[invoice.document_type] ?? invoice.document_type;
  const viaLabel = searchParams?.via === '2' ? '2ª Via' : 'Original';

  // QR Code for receipt
  const qrPayload = [
    company.nif ?? '', invoice.client_nif ?? '', invoice.invoice_number ?? '',
    String(invoice.issued_at ?? '').slice(0, 10),
    Number(invoice.total ?? 0).toFixed(2),
    Number(invoice.tax ?? 0).toFixed(2),
    String(invoice.hash ?? '').slice(0, 16),
  ].join('|');
  let qrDataUrl = '';
  try { qrDataUrl = await QRCode.toDataURL(qrPayload, { width: 120, margin: 2, errorCorrectionLevel: 'M' }); } catch {}

  const certFooter = fcfg?.agt_certificado_numero
    ? `Cert. AGT Nº ${fcfg.agt_certificado_numero}`
    : 'Proc. por programa certificado AGT';

  const hashShort = invoice.hash ? String(invoice.hash).slice(0, 4).toUpperCase() : '';

  // Tax Summary Calculation
  const taxGroups = new Map<string, { rate: number; reason: string; base: number; tax: number }>();
  for (const it of items) {
    const rate = Number(it.tax_rate ?? 14);
    const reason = rate === 0 ? (it.tax_exemption_reason || invoice.tax_exemption_reason || 'Isento') : '';
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
  const taxRows = Array.from(taxGroups.values());

  return (
    <div style={{ background: '#f5f5f5', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0' }}>
      
      {/* Instrução visible on screen, hidden on print */}
      <div style={{ background: '#0b4a6f', color: 'white', padding: '10px 20px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', maxWidth: '300px', textAlign: 'center' }} className="print:hidden">
        📄 Clique em <strong>Imprimir</strong> no diálogo do browser para enviar para a impressora
      </div>

      {/* Talão 80mm — centro */}
      <div
        style={{
          width: '80mm',
          background: 'white',
          fontFamily: "'Courier New', Courier, monospace",
          fontSize: '11px',
          lineHeight: '1.4',
          padding: '4mm',
          boxSizing: 'border-box',
          boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
        }}
        className="print:shadow-none print:m-0 print:p-1"
      >
        {/* Cabeçalho empresa */}
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <div style={{ fontWeight: 'bold', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>{company.name}</div>
          <div style={{ fontSize: '10px' }}>NIF: {company.nif}</div>
          {company.address && <div style={{ fontSize: '10px' }}>{company.address}</div>}
          {company.phone && <div style={{ fontSize: '10px' }}>Tel: {company.phone}</div>}
          {company.email && <div style={{ fontSize: '9px' }}>{company.email}</div>}
        </div>

        {/* Linha separadora */}
        <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

        {/* Tipo e número */}
        <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '12px' }}>{docLabel}</div>
        <div style={{ textAlign: 'center', fontSize: '10px', color: '#555', marginBottom: '2px' }}>{viaLabel}</div>
        <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '11px' }}>{invoice.invoice_number}</div>

        <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

        {/* Dados */}
        <div style={{ fontSize: '10px', marginBottom: '4px' }}>
          <div>Data: {fmtDate(invoice.issued_at)}</div>
          <div>Cliente: {invoice.client_name || 'Consumidor Final'}</div>
          <div>NIF: {invoice.client_nif || '000000000'}</div>
          {invoice.payment_method && <div>Pagamento: {invoice.payment_method}</div>}
        </div>

        <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

        {/* Itens */}
        <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #000' }}>
              <th style={{ textAlign: 'left', paddingBottom: '3px', fontWeight: 'bold' }}>Artigo</th>
              <th style={{ textAlign: 'center', width: '24px', fontWeight: 'bold' }}>Qtd</th>
              <th style={{ textAlign: 'right', fontWeight: 'bold' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: any, i: number) => (
              <tr key={i} style={{ verticalAlign: 'top' }}>
                <td style={{ paddingTop: '4px', paddingRight: '4px' }}>
                  <div>{item.description?.slice(0, 28)}</div>
                  <div style={{ color: '#555', fontSize: '9px' }}>
                    {fmtAOA(item.price)} x {item.quantity} (IVA {item.tax_rate}%)
                  </div>
                </td>
                <td style={{ paddingTop: '4px', textAlign: 'center' }}>{item.quantity}</td>
                <td style={{ paddingTop: '4px', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtAOA(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

        {/* Totais */}
        <div style={{ fontSize: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Subtotal:</span><span>{fmtAOA(invoice.subtotal)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Total IVA:</span><span>{fmtAOA(invoice.tax)}</span>
          </div>
        </div>

        <div style={{ borderTop: '2px solid #000', margin: '4px 0' }} />
        
        {/* Total Grand */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold', margin: '6px 0' }}>
          <span>TOTAL</span><span>{fmtAOA(invoice.total)}</span>
        </div>

        {/* Quadro de Impostos */}
        <div style={{ borderTop: '1px dashed #000', margin: '8px 0 6px 0' }} />
        <div style={{ textAlign: 'center', fontSize: '9px', fontWeight: 'bold', marginBottom: '4px' }}>RESUMO DE IMPOSTOS</div>
        <table style={{ width: '100%', fontSize: '9px', borderCollapse: 'collapse', marginBottom: '4px' }}>
          <thead>
            <tr style={{ borderBottom: '1px dashed #ccc' }}>
              <th style={{ textAlign: 'left' }}>Taxa</th>
              <th style={{ textAlign: 'right' }}>Incidência</th>
              <th style={{ textAlign: 'right' }}>Imposto</th>
            </tr>
          </thead>
          <tbody>
            {taxRows.map((g, i) => (
              <tr key={i}>
                <td>{g.rate}%</td>
                <td style={{ textAlign: 'right' }}>{fmtAOA(g.base)}</td>
                <td style={{ textAlign: 'right' }}>{fmtAOA(g.tax)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {taxRows.filter(g => g.rate === 0).map((g, i) => (
          <div key={i} style={{ fontSize: '8px', color: '#555', textAlign: 'center' }}>
            Isento: {g.reason}
          </div>
        ))}
        <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

        {Number(invoice.amount_paid ?? 0) > 0 && (
          <div style={{ marginTop: '4px', fontSize: '10px', borderTop: '1px dashed #000', paddingTop: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 'bold' }}>PAGO:</span><span>{fmtAOA(invoice.amount_paid)}</span>
            </div>
            {Number(invoice.amount_paid) > Number(invoice.total) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                <span>TROCO:</span><span>{fmtAOA(Number(invoice.amount_paid) - Number(invoice.total))}</span>
              </div>
            )}
          </div>
        )}

        <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />

        {/* QR Code — verificação AGT */}
        {qrDataUrl && (
          <div style={{ textAlign: 'center', marginBottom: '6px' }}>
            <img src={qrDataUrl} width={100} height={100} style={{ display: 'inline-block' }} alt="QR AGT" />
            <div style={{ fontSize: '8px', color: '#555', marginTop: '2px' }}>Verificação AGT</div>
          </div>
        )}

        {/* Hash AGT */}
        {hashShort && (
          <div style={{ fontSize: '9px', textAlign: 'center', marginBottom: '4px', color: '#333' }}>
            Hash: {hashShort}...
          </div>
        )}

        {/* Rodapé */}
        <div style={{ textAlign: 'center', fontSize: '9px', marginTop: '6px', borderTop: '1px dashed #000', paddingTop: '6px' }}>
          <div style={{ fontWeight: 'bold', fontSize: '10px' }}>Obrigado pela preferência!</div>
          <div style={{ marginTop: '3px' }}>{certFooter}</div>
          <div style={{ marginTop: '3px', fontWeight: 'bold' }}>FaturaAO · Angola</div>
        </div>

        {/* Espaço de corte */}
        <div style={{ marginTop: '12px' }} />
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: 80mm auto; margin: 0; }
          body { background: white !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      ` }} />
      <script dangerouslySetInnerHTML={{ __html: `window.onload = function(){ setTimeout(function(){ window.print(); }, 700); }` }} />
    </div>
  );
}
