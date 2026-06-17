'use client';

import { useState } from 'react';
import { X, Loader2, ListChecks } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatAOA } from '@/lib/utils';

type Purchase = { id: string; purchase_number: string; total: number; amount_paid?: number; };

type Props = {
  purchases: Purchase[];
  onClose: () => void;
  onSuccess: () => void;
};

const METHODS = [
  { value: 'transferencia', label: 'Transferência bancária' },
  { value: 'numerario', label: 'Numerário' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'multicaixa', label: 'Multicaixa' },
  { value: 'outro', label: 'Outro' },
];

export default function PurchasePaymentModal({ purchases, onClose, onSuccess }: Props) {
  const isSingle = purchases.length === 1;
  
  const totalRemaining = purchases.reduce((sum, pur) => sum + (Number(pur.total) - Number(pur.amount_paid ?? 0)), 0);
  const totalOriginal = purchases.reduce((sum, pur) => sum + Number(pur.total), 0);
  const totalPaid = purchases.reduce((sum, pur) => sum + Number(pur.amount_paid ?? 0), 0);

  const [amount, setAmount] = useState<string>(totalRemaining.toFixed(2));
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState('transferencia');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) { toast.error('Valor inválido'); return; }
    if (amt > totalRemaining + 0.01) { toast.error(`Valor excede o remanescente (${formatAOA(totalRemaining)})`); return; }
    
    setSaving(true);
    
    let remainingAmountToDistribute = amt;
    const allocations: { purchase_id: string, amount: number }[] = [];
    
    for (const pur of purchases) {
       if (remainingAmountToDistribute <= 0) break;
       const purRemaining = Number(pur.total) - Number(pur.amount_paid ?? 0);
       const allocAmount = Math.min(purRemaining, remainingAmountToDistribute);
       allocations.push({ purchase_id: pur.id, amount: allocAmount });
       remainingAmountToDistribute -= allocAmount;
    }

    try {
      const res = await fetch('/api/purchases/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allocations,
          payment_date: new Date(paymentDate).toISOString(),
          method, reference, notes,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao registar pagamento');
      toast.success('Pagamento registado com sucesso');
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao registar pagamento');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-background rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            {!isSingle && <ListChecks className="w-5 h-5 text-primary" />}
            Registar pagamento a fornecedor
            {!isSingle && <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full ml-2">{purchases.length} faturas</span>}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-secondary rounded"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="bg-secondary/50 rounded p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">{isSingle ? 'Fatura' : 'Faturas selecionadas'}</span><span className="font-mono font-semibold">{isSingle ? purchases[0].purchase_number : `${purchases.length} docs`}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Total original</span><span className="font-mono">{formatAOA(totalOriginal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Já pago</span><span className="font-mono">{formatAOA(totalPaid)}</span></div>
            <div className="flex justify-between border-t pt-1 mt-1"><span className="font-medium">Remanescente</span><span className="font-mono font-semibold text-primary">{formatAOA(totalRemaining)}</span></div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Valor pago *</label>
            <input type="number" step="0.01" min="0.01" max={totalRemaining} value={amount} onChange={(e) => setAmount(e.target.value)} required className="w-full px-3 h-10 rounded border border-border bg-background text-sm font-mono focus:ring-2 focus:ring-primary focus:border-primary" />
            {!isSingle && Number(amount) < totalRemaining && <p className="text-xs text-muted-foreground mt-1">O valor será distribuído pelas faturas por ordem.</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Data *</label>
              <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required className="w-full px-3 h-10 rounded border border-border bg-background text-sm focus:ring-2 focus:ring-primary focus:border-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Método *</label>
              <select value={method} onChange={(e) => setMethod(e.target.value)} required className="w-full px-3 h-10 rounded border border-border bg-background text-sm focus:ring-2 focus:ring-primary focus:border-primary">
                {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Referência</label>
            <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Ex: TRF2024001" className="w-full px-3 h-10 rounded border border-border bg-background text-sm focus:ring-2 focus:ring-primary focus:border-primary" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notas</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2 rounded border border-border bg-background text-sm focus:ring-2 focus:ring-primary focus:border-primary" />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <button type="button" onClick={onClose} className="px-4 h-10 rounded border border-border bg-background text-sm font-medium hover:bg-secondary">Cancelar</button>
            <button type="submit" disabled={saving} className="ms-btn-primary disabled:opacity-60">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Registar'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
