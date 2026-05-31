import { createAdminClient } from '@/lib/supabase/server';
import { formatAOA, formatDateTime } from '@/lib/utils';
import { notFound } from 'next/navigation';
import { ShieldCheck, FileText, Download } from 'lucide-react';
import Link from 'next/link';
import PrintButton from '@/components/ui/print-button';

export const dynamic = 'force-dynamic';

export default async function PublicInvoicePage({ params }: { params: { token: string } }) {
  const admin = createAdminClient();

  const { data: invoice } = await admin
    .from('invoices')
    .select('*, items:invoice_items(*), company:companies(*), client:clients(*)')
    .eq('public_token', params.token)
    .maybeSingle();

  if (!invoice) return notFound();

  const company = invoice.company;
  const client = invoice.client;

  const docTypeLabels: Record<string, string> = {
    FT: 'Fatura', FR: 'Fatura-Recibo', NC: 'Nota de Crédito',
    ND: 'Nota de Débito', RC: 'Recibo',
  };
  const docLabel = docTypeLabels[invoice.document_type] || invoice.document_type;

  return (
    <div className="min-h-screen bg-secondary/30 flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-3xl bg-card border border-border rounded-xl shadow-sm overflow-hidden mb-8">
        {/* Header */}
        <div className="bg-primary p-8 text-primary-foreground flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div>
            <h1 className="text-2xl font-bold mb-1">{company.name}</h1>
            <p className="text-primary-foreground/80 text-sm">NIF: {company.nif}</p>
            {company.email && <p className="text-primary-foreground/80 text-sm">{company.email}</p>}
            <div className="mt-4 print:hidden">
              <PrintButton />
            </div>
          </div>
          <div className="text-left sm:text-right bg-primary-foreground/10 p-4 rounded-lg">
            <p className="text-primary-foreground/80 text-sm font-medium uppercase tracking-wider mb-1">{docLabel}</p>
            <p className="text-xl font-mono font-bold">{invoice.invoice_number}</p>
            <p className="text-primary-foreground/80 text-xs mt-2">{formatDateTime(invoice.issued_at)}</p>
          </div>
        </div>

        {/* Client Info */}
        <div className="p-8 border-b border-border">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2">Faturado a</p>
          <p className="font-semibold text-lg">{invoice.client_name}</p>
          <p className="text-muted-foreground text-sm mt-1">NIF: {invoice.client_nif}</p>
          {client?.email && <p className="text-muted-foreground text-sm">{client.email}</p>}
          {client?.address && <p className="text-muted-foreground text-sm mt-1">{client.address}</p>}
        </div>

        {/* Items */}
        <div className="p-8">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground uppercase border-b border-border">
                <tr>
                  <th className="text-left py-3 font-medium">Descrição</th>
                  <th className="text-right py-3 font-medium">Qtd</th>
                  <th className="text-right py-3 font-medium">Preço Unit.</th>
                  <th className="text-right py-3 font-medium">Taxa</th>
                  <th className="text-right py-3 font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoice.items?.map((item: any) => (
                  <tr key={item.id}>
                    <td className="py-4">
                      <p className="font-medium">{item.product_name}</p>
                    </td>
                    <td className="py-4 text-right">{item.quantity}</td>
                    <td className="py-4 text-right font-mono">{formatAOA(item.unit_price)}</td>
                    <td className="py-4 text-right">{item.tax_percentage}%</td>
                    <td className="py-4 text-right font-mono font-medium">{formatAOA(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end mt-8">
            <div className="w-full sm:w-72 space-y-3 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="font-mono">{formatAOA(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Total IVA</span>
                <span className="font-mono">{formatAOA(invoice.tax)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg pt-3 border-t border-border">
                <span>Total</span>
                <span className="font-mono text-primary">{formatAOA(invoice.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Hash/Signature */}
        <div className="bg-secondary/50 p-6 border-t border-border flex items-start gap-4">
          <ShieldCheck className="w-6 h-6 text-success flex-shrink-0" />
          <div className="text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Documento Válido e Protegido</p>
            <p className="mb-2">Este documento foi gerado pelo sistema <strong>FaturaAO</strong> e as suas informações estão protegidas por uma assinatura digital.</p>
            <p className="font-mono text-[10px] break-all bg-background p-2 rounded border border-border">
              Hash: {invoice.hash || 'Em processamento...'}
            </p>
          </div>
        </div>
      </div>

      <div className="text-center text-xs text-muted-foreground">
        Processado por <a href="https://faturaao.app" className="font-medium text-primary hover:underline">FaturaAO</a>
      </div>
    </div>
  );
}
