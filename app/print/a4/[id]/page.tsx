import { createAdminClient } from '@/lib/supabase/server';
import { formatAOA, formatDateTime } from '@/lib/utils';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function A4ReceiptPrintPage({ params }: { params: { id: string } }) {
  const admin = createAdminClient();

  const { data: invoice } = await admin
    .from('invoices')
    .select('*, items:invoice_items(*), company:companies(*), client:clients(*)')
    .eq('id', params.id)
    .maybeSingle();

  if (!invoice) return notFound();

  const company = invoice.company;
  const docTypeLabels: Record<string, string> = {
    FT: 'Fatura', FR: 'Fatura-Recibo', NC: 'Nota de Crédito',
    ND: 'Nota de Débito', RC: 'Recibo', PP: 'Fatura Pró-forma', GT: 'Guia de Transporte'
  };
  const docLabel = docTypeLabels[invoice.document_type] || invoice.document_type;

  return (
    <div className="bg-gray-100 min-h-screen flex justify-center py-8 print:py-0 print:bg-white text-black">
      <div className="w-[210mm] min-h-[297mm] flex flex-col bg-white shadow-lg p-[15mm] print:shadow-none print:m-0 print:p-[10mm] print:min-h-0 box-border">
        
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-gray-200 pb-6 mb-6 mt-4 print:mt-0">
          <div>
            <h1 className="font-bold text-3xl text-gray-800 uppercase tracking-wide mb-1">{company.name}</h1>
            <div className="text-sm text-gray-600 space-y-0.5">
              <div>NIF: <span className="font-medium text-gray-800">{company.nif}</span></div>
              {company.address && <div>{company.address}</div>}
              {company.email && <div>Email: {company.email}</div>}
              {company.phone && <div>Tel: {company.phone}</div>}
            </div>
          </div>
          <div className="text-right">
            <h2 className="font-bold text-2xl text-gray-800 uppercase">{docLabel}</h2>
            <div className="text-lg font-medium text-gray-600 mt-1">{invoice.invoice_number}</div>
            <div className="text-sm text-gray-500 mt-2">Data de Emissão: {formatDateTime(invoice.issued_at)}</div>
            {invoice.status === 'cancelled' && (
              <div className="text-red-600 font-bold uppercase mt-2 border border-red-600 px-2 py-1 inline-block rounded">
                Anulado
              </div>
            )}
          </div>
        </div>

        {/* Client Info */}
        <div className="bg-gray-50 rounded-lg p-5 mb-8 border border-gray-100">
          <h3 className="text-xs font-bold uppercase text-gray-500 mb-3 tracking-wider">Dados do Cliente</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-500">Nome / Razão Social</div>
              <div className="font-bold text-gray-800">{invoice.client_name}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">NIF</div>
              <div className="font-bold text-gray-800">{invoice.client_nif || 'Consumidor Final'}</div>
            </div>
          </div>
        </div>

        {/* Proforma Validity */}
        {invoice.document_type === 'PP' && invoice.valid_until && (
          <div className="bg-blue-50/50 rounded-lg p-4 mb-6 border border-blue-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-blue-800 uppercase tracking-wide">Orçamento Válido Até:</span>
            <span className="font-bold text-lg text-blue-900">{formatDateTime(invoice.valid_until).split(' ')[0]}</span>
          </div>
        )}

        {/* Transport Details */}
        {invoice.document_type === 'GT' && invoice.transport_details && (
          <div className="bg-gray-50 rounded-lg p-5 mb-8 border border-gray-100">
            <h3 className="text-xs font-bold uppercase text-gray-500 mb-3 tracking-wider">Detalhes de Transporte</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Local de Carga:</span> <span className="font-medium text-gray-800">{invoice.transport_details.loadLocation}</span></div>
              <div><span className="text-gray-500">Local de Descarga:</span> <span className="font-medium text-gray-800">{invoice.transport_details.unloadLocation}</span></div>
              <div><span className="text-gray-500">Matrícula:</span> <span className="font-bold text-gray-800 uppercase">{invoice.transport_details.licensePlate}</span></div>
              <div><span className="text-gray-500">Início:</span> <span className="font-medium text-gray-800">{invoice.transport_details.startDate ? formatDateTime(invoice.transport_details.startDate) : '-'}</span></div>
            </div>
          </div>
        )}

        {/* Items Table */}
        <div className="min-h-[120mm]">
          <table className="w-full text-sm mb-6">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Artigo / Descrição</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Qtd</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Preço Unit.</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">IVA</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 border-b border-gray-200">
              {invoice.items?.map((item: any) => (
                <tr key={item.id} className="hover:bg-gray-50/50">
                  <td className="py-4 px-4 text-gray-800">
                    <div className="font-medium">{item.description}</div>
                  </td>
                  <td className="py-4 px-4 text-right text-gray-600">{item.quantity}</td>
                  <td className="py-4 px-4 text-right text-gray-600">{formatAOA(item.price)}</td>
                  <td className="py-4 px-4 text-right text-gray-600">{item.tax_rate}%</td>
                  <td className="py-4 px-4 text-right font-medium text-gray-800">{formatAOA(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end mb-12">
          <div className="w-1/2 md:w-1/3">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center text-gray-600">
                <span>Subtotal:</span>
                <span className="font-medium text-gray-800">{formatAOA(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between items-center text-gray-600">
                <span>Impostos (IVA):</span>
                <span className="font-medium text-gray-800">{formatAOA(invoice.tax)}</span>
              </div>
              <div className="flex justify-between items-center text-lg font-bold text-gray-900 border-t-2 border-gray-800 pt-3 mt-3">
                <span>Total:</span>
                <span>{formatAOA(invoice.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 pt-8 mt-auto text-center text-xs text-gray-500 space-y-2">
          <p className="font-medium text-gray-600">Obrigado pela preferência!</p>
          <div className="mx-auto font-mono text-[10px] bg-gray-50 p-2 rounded border border-gray-100 inline-block">
            {invoice.hash ? `${invoice.hash.substring(0, 4)} - Processado por programa certificado nº 0000/AGT (FaturaAO)` : 'Processado sem assinatura - Documento não fiscal'}
          </div>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { margin: 0; size: A4; }
          body, html { width: 100%; height: 100%; margin: 0; padding: 0; background: white; }
          /* Enforce background colors in print */
          * {
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}} />
      <script dangerouslySetInnerHTML={{__html: `
        window.onload = function() { setTimeout(function(){ window.print(); }, 500); }
      `}} />
    </div>
  );
}
