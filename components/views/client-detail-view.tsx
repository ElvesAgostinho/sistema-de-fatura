'use client';

import { ArrowLeft, Edit, Mail, MapPin, Phone, Building2, Download, AlertTriangle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatAOA, formatDateTime, cn } from '@/lib/utils';
import { useResource } from '@/lib/hooks/use-resource';

type Client = { id: string; name: string; nif?: string; email?: string; phone?: string; address?: string; is_active: boolean };
type Invoice = { id: string; invoice_number: string; total: number; amount_paid: number; status: string; payment_status: string; issued_at: string };

export default function ClientDetailView({ id }: { id: string }) {
  const router = useRouter();
  
  const { data: clientData, loading: loadingClient } = useResource<{ client: Client }>(`/api/clients/${id}`);
  const { data: invData, loading: loadingInv } = useResource<{ invoices: Invoice[] }>(`/api/invoices?client_id=${id}&page_size=200`);

  if (loadingClient) return <div className="flex justify-center p-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!clientData?.client) return <div className="p-10 text-center text-muted-foreground">Cliente não encontrado</div>;

  const client = clientData.client;
  const invoices = invData?.invoices ?? [];

  const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.status === 'issued' ? inv.total : 0), 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + (inv.status === 'issued' ? (inv.amount_paid ?? 0) : 0), 0);
  const totalDebt = totalRevenue - totalPaid;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 rounded hover:bg-secondary"><ArrowLeft className="w-4 h-4" /></button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{client.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm font-mono text-muted-foreground">{client.nif ? `NIF: ${client.nif}` : 'Sem NIF (Consumidor Final)'}</span>
              {!client.is_active && <span className="text-[10px] uppercase font-bold bg-muted px-1.5 py-0.5 rounded text-muted-foreground">Arquivado</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href={`/clients/edit/${id}`} className="ms-btn-secondary"><Edit className="w-4 h-4" /> Editar Cliente</Link>
          <Link href={`/invoices/new?client_id=${id}`} className="ms-btn-primary">Nova Fatura</Link>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Contact Info */}
        <div className="md:col-span-1 space-y-4">
          <div className="ms-card p-5">
            <h3 className="text-xs uppercase font-semibold text-muted-foreground mb-4">Contactos e Morada</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-muted-foreground mt-0.5" />
                <span className={!client.email ? "text-muted-foreground italic" : ""}>{client.email || 'Sem email'}</span>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-muted-foreground mt-0.5" />
                <span className={!client.phone ? "text-muted-foreground italic" : ""}>{client.phone || 'Sem telefone'}</span>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                <span className={!client.address ? "text-muted-foreground italic" : ""}>{client.address || 'Sem morada registada'}</span>
              </div>
            </div>
          </div>

          <div className="ms-card p-5 bg-primary/5 border-l-4 border-primary">
            <h3 className="text-xs uppercase font-semibold text-primary mb-2">Resumo Financeiro</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Faturado</span>
                <span className="font-mono">{formatAOA(totalRevenue)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Pago</span>
                <span className="font-mono text-success">{formatAOA(totalPaid)}</span>
              </div>
              <div className="h-px bg-primary/10 my-1" />
              <div className="flex justify-between font-semibold">
                <span>Em Dívida</span>
                <span className={cn("font-mono", totalDebt > 0 ? "text-warning" : "text-success")}>
                  {formatAOA(totalDebt)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Extrato / Invoices */}
        <div className="md:col-span-2">
          <div className="ms-card h-full flex flex-col">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2"><Building2 className="w-4 h-4 text-primary" /> Conta Corrente</h3>
              <div className="text-xs text-muted-foreground">{invoices.length} faturas registadas</div>
            </div>
            
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/60">
                  <tr className="text-left text-xs uppercase text-muted-foreground">
                    <th className="py-3 px-4">Nº Fatura</th>
                    <th className="py-3 px-4">Data Emissão</th>
                    <th className="py-3 px-4 text-right">Total</th>
                    <th className="py-3 px-4 text-right">Em Dívida</th>
                    <th className="py-3 px-4">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loadingInv ? (
                    <tr><td colSpan={5} className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground mx-auto" /></td></tr>
                  ) : invoices.length === 0 ? (
                    <tr><td colSpan={5} className="py-10 text-center text-muted-foreground">Nenhuma fatura emitida para este cliente.</td></tr>
                  ) : (
                    invoices.map((inv) => {
                      const debt = inv.total - (inv.amount_paid ?? 0);
                      const isCancelled = inv.status === 'cancelled';
                      return (
                        <tr key={inv.id} className="hover:bg-secondary/40 transition-colors">
                          <td className="py-3 px-4">
                            <Link href={`/invoices/${inv.id}`} className="font-mono font-medium text-primary hover:underline">
                              {inv.invoice_number}
                            </Link>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">{formatDateTime(inv.issued_at)}</td>
                          <td className="py-3 px-4 text-right font-mono">{formatAOA(inv.total)}</td>
                          <td className="py-3 px-4 text-right font-mono font-semibold">
                            {!isCancelled && debt > 0 ? (
                              <span className="text-warning">{formatAOA(debt)}</span>
                            ) : !isCancelled ? (
                              <span className="text-success">0,00</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {isCancelled ? (
                              <span className="inline-flex text-[10px] uppercase font-bold bg-destructive/10 text-destructive px-2 py-0.5 rounded">Cancelada</span>
                            ) : inv.payment_status === 'pago' ? (
                              <span className="inline-flex text-[10px] uppercase font-bold bg-success/10 text-success px-2 py-0.5 rounded">Pago</span>
                            ) : inv.payment_status === 'parcial' ? (
                              <span className="inline-flex text-[10px] uppercase font-bold bg-warning/10 text-warning px-2 py-0.5 rounded">Parcial</span>
                            ) : (
                              <span className="inline-flex text-[10px] uppercase font-bold bg-secondary text-muted-foreground px-2 py-0.5 rounded">Pendente</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
