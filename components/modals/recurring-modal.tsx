'use client';

import { useState } from 'react';
import { useResource } from '@/lib/hooks/use-resource';
import { Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

export default function RecurringModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const { data: clientsData, loading: loadingClients } = useResource<{ clients: { id: string; name: string }[] }>('/api/clients');

  const [formData, setFormData] = useState({
    client_id: '',
    frequency: 'monthly',
    amount: '',
    next_issue_date: '',
    description: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.client_id || !formData.amount || !formData.next_issue_date) return toast.error('Preencha os campos obrigatórios');
    setSaving(true);
    try {
      const r = await fetch('/api/recurring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
        }),
      });
      if (!r.ok) {
        const j = await r.json();
        throw new Error(j.error || 'Erro ao guardar avença');
      }
      toast.success('Avença registada com sucesso');
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-md rounded-xl shadow-lg border border-border flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Nova Avença</h2>
          <button onClick={onClose} className="p-2 -mr-2 rounded-md hover:bg-secondary text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <form id="recurring-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Cliente *</label>
              <select 
                value={formData.client_id} 
                onChange={e => setFormData({ ...formData, client_id: e.target.value })}
                className="w-full h-10 px-3 rounded-md border bg-background text-sm"
                required
              >
                <option value="">Selecione o cliente</option>
                {clientsData?.clients?.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {loadingClients && <p className="text-xs text-muted-foreground mt-1">A carregar clientes...</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Descrição</label>
              <input 
                type="text" 
                value={formData.description} 
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="w-full h-10 px-3 rounded-md border bg-background text-sm"
                placeholder="Ex: Avença de Contabilidade"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Valor Mensal (AOA) *</label>
                <input 
                  type="number" 
                  step="0.01" 
                  min="0"
                  value={formData.amount} 
                  onChange={e => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full h-10 px-3 rounded-md border bg-background text-sm font-mono"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Periodicidade</label>
                <select 
                  value={formData.frequency} 
                  onChange={e => setFormData({ ...formData, frequency: e.target.value })}
                  className="w-full h-10 px-3 rounded-md border bg-background text-sm"
                >
                  <option value="monthly">Mensal</option>
                  <option value="quarterly">Trimestral</option>
                  <option value="yearly">Anual</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Próxima Emissão *</label>
              <input 
                type="date" 
                value={formData.next_issue_date} 
                onChange={e => setFormData({ ...formData, next_issue_date: e.target.value })}
                className="w-full h-10 px-3 rounded-md border bg-background text-sm"
                required
              />
            </div>
          </form>
        </div>
        <div className="px-6 py-4 border-t bg-secondary/30 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="ms-btn-secondary">Cancelar</button>
          <button type="submit" form="recurring-form" disabled={saving} className="ms-btn-primary">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Guardar Avença
          </button>
        </div>
      </div>
    </div>
  );
}
