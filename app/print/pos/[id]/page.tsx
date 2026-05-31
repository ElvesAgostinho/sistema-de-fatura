import { createAdminClient } from '@/lib/supabase/server';
import { formatAOA, formatDateTime } from '@/lib/utils';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function PosReceiptPrintPage({ params }: { params: { id: string } }) {
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
    ND: 'Nota de Débito', RC: 'Recibo', PP: 'Pró-forma', GT: 'Guia de Transporte'
  };
  const docLabel = docTypeLabels[invoice.document_type] || invoice.document_type;

  return (
    <div className="bg-white text-black flex justify-center">
      <div className="w-[80mm] p-4 text-sm font-mono leading-tight bg-white print:m-0 print:p-4">
        <div className="text-center mb-2 space-y-1">
          <h1 className="font-bold text-lg uppercase">{company.name}</h1>
          <div>NIF: {company.nif}</div>
          {company.address && <div className="text-xs">{company.address}</div>}
        </div>

        <div className="text-center font-bold uppercase border-t border-b border-dashed border-black py-1 mb-2">
          <div>{docLabel}</div>
          <div>{invoice.invoice_number}</div>
        </div>

        <div className="mb-2 text-xs space-y-0.5">
          <div>Data: {formatDateTime(invoice.issued_at)}</div>
          <div>Cliente: {invoice.client_name}</div>
          <div>NIF: {invoice.client_nif}</div>
          
          {invoice.document_type === 'PP' && invoice.valid_until && (
            <div className="mt-1 font-bold">Válido até: {formatDateTime(invoice.valid_until).split(' ')[0]}</div>
          )}
          
          {invoice.document_type === 'GT' && invoice.transport_details && (
            <div className="mt-1 border-t border-dashed border-gray-400 pt-1">
              <div>Carga: {invoice.transport_details.loadLocation}</div>
              <div>Descarga: {invoice.transport_details.unloadLocation}</div>
              <div>Matrícula: {invoice.transport_details.licensePlate}</div>
              {invoice.transport_details.startDate && <div>Início: {formatDateTime(invoice.transport_details.startDate)}</div>}
            </div>
          )}
        </div>

        <table className="w-full text-xs mb-2">
          <thead className="border-b border-black">
            <tr>
              <th className="text-left py-1">Qtd</th>
              <th className="text-left py-1">Artigo</th>
              <th className="text-right py-1">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items?.map((item: any) => (
              <tr key={item.id}>
                <td className="py-1 align-top">{item.quantity}</td>
                <td className="py-1 align-top pr-1">{item.description}</td>
                <td className="py-1 align-top text-right whitespace-nowrap">{formatAOA(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-t border-black pt-1 space-y-0.5 text-xs mb-2">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>{formatAOA(invoice.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>IVA:</span>
            <span>{formatAOA(invoice.tax)}</span>
          </div>
          <div className="flex justify-between font-bold text-sm mt-1 border-t border-dashed border-black pt-1">
            <span>TOTAL:</span>
            <span>{formatAOA(invoice.total)}</span>
          </div>
        </div>

        {invoice.amount_paid > 0 && (
          <div className="text-center border-t border-dashed border-black py-1 mb-2 text-xs font-bold">
            PAGO: {formatAOA(invoice.amount_paid)}
          </div>
        )}

        <div className="text-center text-[10px] space-y-1 mt-4">
          <p>Obrigado pela preferência!</p>
          <div className="break-all border border-gray-300 p-1 text-[8px]">
            {invoice.hash ? `${invoice.hash.substring(0, 4)} - Processado por programa certificado nº 0000/AGT` : 'Sem assinatura'}
          </div>
          <p className="font-bold">FaturaAO</p>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { margin: 0; size: 80mm 297mm; }
          body, html { width: 80mm; margin: 0; padding: 0; font-family: monospace; background: white; }
        }
      `}} />
      <script dangerouslySetInnerHTML={{__html: `
        window.onload = function() { setTimeout(function(){ window.print(); }, 500); }
      `}} />
    </div>
  );
}
