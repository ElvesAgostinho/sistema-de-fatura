'use client';

import { useState } from 'react';
import { ArrowLeft, Edit, Mail, MapPin, Phone, Building2, DollarSign, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatAOA, formatDateTime, cn } from '@/lib/utils';
import { useResource } from '@/lib/hooks/use-resource';
import PurchasePaymentModal from '@/components/modals/purchase-payment-modal';

type Purchase = { id: string; purchase_number: string; total: number; amount_paid: number; status: string; payment_status: string; issued_at: string; };
type Supplier = { id: string; name: string; nif: string; email?: string; phone?: string; address?: string; purchases?: Purchase[] };

export default function SupplierDetailView({ id }: { id: string }) {
  const router = useRouter();
  
  const { data, loading, reload } = useResource<{ supplier: Supplier }>(`/api/suppliers/${id}`);

  const [selectedPurchaseIds, setSelectedPurchaseIds] = useState<string[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!data?.supplier) return <div className="p-10 text-center text-muted-foreground">Fornecedor não encontrado</div>;

  const supplier = data.supplier;
  const purchases = supplier.purchases ?? [];

  const activePurchases = purchases.filter(p => p.status !== 'cancelled');
  const totalPurchases = activePurchases.reduce((sum, p) => sum + Number(p.total), 0);
  const totalPaid = activePurchases.reduce((sum, p) => sum + Number(p.amount_paid ?? 0), 0);
  const totalDebt = totalPurchases - totalPaid;

  const toggleSelection = (purId: string) => {
    setSelectedPurchaseIds(prev => prev.includes(purId) ? prev.filter(i => i !== purId) : [...prev, purId]);
  };

  const selectedPurchasesData = purchases.filter(p => selectedPurchaseIds.includes(p.id));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 rounded hover:bg-secondary"><ArrowLeft className="w-4 h-4" /></button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{supplier.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm font-mono text-muted-foreground">{supplier.nif ? `NIF: ${supplier.nif}` : 'Sem NIF'}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Pode ser adicionado Link para editar fornecedor aqui futuramente */}
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
                <span className={!supplier.email ? "text-muted-foreground italic" : ""}>{supplier.email || 'Sem email'}</span>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-muted-foreground mt-0.5" />
                <span className={!supplier.phone ? "text-muted-foreground italic" : ""}>{supplier.phone || 'Sem telefone'}</span>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                <span className={!supplier.address ? "text-muted-foreground italic" : ""}>{supplier.address || 'Sem morada registada'}</span>
              </div>
            </div>
          </div>

          <div className="ms-card p-5 bg-warning/5 border-l-4 border-warning">
            <h3 className="text-xs uppercase font-semibold text-warning mb-2">Resumo de Contas a Pagar</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Comprado</span>
                <span className="font-mono">{formatAOA(totalPurchases)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Pago</span>
                <span className="font-mono text-success">{formatAOA(totalPaid)}</span>
              </div>
              <div className="h-px bg-warning/10 my-1" />
              <div className="flex justify-between font-semibold">
                <span>Dívida ao Fornecedor</span>
                <span className={cn("font-mono", totalDebt > 0 ? "text-destructive" : "text-success")}>
                  {formatAOA(totalDebt)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Extrato / Purchases */}
        <div className="md:col-span-2">
          <div className="ms-card h-full flex flex-col">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2"><Building2 className="w-4 h-4 text-primary" /> Conta Corrente</h3>
              
              {selectedPurchaseIds.length > 0 ? (
                <button onClick={() => setShowPaymentModal(true)} className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded shadow hover:bg-primary/90 inline-flex items-center gap-2">
                  <DollarSign className="w-3.5 h-3.5" /> Liquidar ({selectedPurchaseIds.length})
                </button>
              ) : (
                <div className="text-xs text-muted-foreground">{purchases.length} despesas</div>
              )}
            </div>
            
            <div className="flex-1 overflow-x-auto rounded-b-md">
              <table className="w-full text-[13px]">
                <thead className="bg-muted/50 sticky top-0 border-b">
                  <tr className="text-left font-medium text-muted-foreground">
                    <th className="py-2.5 px-3 w-10"></th>
                    <th className="py-2.5 px-3">Nº Fatura</th>
                    <th className="py-2.5 px-3">Data</th>
                    <th className="py-2.5 px-3 text-right">Crédito (Custo)</th>
                    <th className="py-2.5 px-3 text-right">Débito (Pago)</th>
                    <th className="py-2.5 px-3 text-right">Saldo Dívida</th>
                    <th className="py-2.5 px-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {purchases.length === 0 ? (
                    <tr><td colSpan={7} className="py-10 text-center text-muted-foreground">Sem movimentos.</td></tr>
                  ) : (
                    (() => {
                      let currentBalance = 0;
                      const ledgerLines = [...purchases].reverse().map(pur => {
                        const isCancelled = pur.status === 'cancelled';
                        const credit = isCancelled ? 0 : Number(pur.total);
                        const debit = isCancelled ? 0 : Number(pur.amount_paid ?? 0);
                        currentBalance += (credit - debit);
                        return { ...pur, credit, debit, balance: currentBalance, isCancelled };
                      }).reverse();

                      return ledgerLines.map((line) => {
                        const isPayable = !line.isCancelled && line.payment_status !== 'pago';
                        
                        return (
                          <tr key={line.id} className="hover:bg-muted/40 even:bg-muted/10 transition-colors">
                            <td className="py-2.5 px-3">
                              {isPayable && (
                                <input 
                                  type="checkbox" 
                                  className="rounded border-input text-primary focus:ring-primary w-3.5 h-3.5"
                                  checked={selectedPurchaseIds.includes(line.id)}
                                  onChange={() => toggleSelection(line.id)}
                                />
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-medium">
                              <Link href={`/purchases/${line.id}`} className="text-primary hover:underline">
                                {line.purchase_number}
                              </Link>
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">{formatDateTime(line.issued_at)}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">{line.credit > 0 ? formatAOA(line.credit) : '-'}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-success">{line.debit > 0 ? formatAOA(line.debit) : '-'}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-medium">{formatAOA(line.balance)}</td>
                            <td className="py-2.5 px-3 text-center">
                              {line.isCancelled ? (
                                <span className="text-[10px] uppercase font-bold bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Anulada</span>
                              ) : line.payment_status === 'pago' ? (
                                <span className="text-[10px] uppercase font-bold bg-success/10 text-success px-1.5 py-0.5 rounded">Pago</span>
                              ) : line.payment_status === 'parcial' ? (
                                <span className="text-[10px] uppercase font-bold bg-warning/10 text-warning px-1.5 py-0.5 rounded">Parcial</span>
                              ) : (
                                <span className="text-[10px] uppercase font-bold bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">Pendente</span>
                              )}
                            </td>
                          </tr>
                        );
                      });
                    })()
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {showPaymentModal && (
        <PurchasePaymentModal
          purchases={selectedPurchasesData}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={() => {
            setShowPaymentModal(false);
            setSelectedPurchaseIds([]);
            reload();
          }}
        />
      )}
    </div>
  );
}
