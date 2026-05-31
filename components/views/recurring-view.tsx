'use client';

import { useState } from 'react';
import { useResource, invalidateCache } from '@/lib/hooks/use-resource';
import { Plus, RefreshCw, Loader2, Calendar, FileText, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatAOA, formatDateTime } from '@/lib/utils';
import RecurringModal from '@/components/modals/recurring-modal';

type RecurringInvoice = {
  id: string;
  client: { name: string; nif: string };
  frequency: string;
  amount: number;
  next_issue_date: string;
  is_active: boolean;
  description: string;
};

export default function RecurringView() {
  const { data, loading, reload, mutate } = useResource<{ data: RecurringInvoice[] }>('/api/recurring');
  const [modalOpen, setModalOpen] = useState(false);

  const list = data?.data ?? [];

  const toggleStatus = async (id: string, current: boolean) => {
    try {
      const r = await fetch(`/api/recurring/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !current }),
      });
      if (!r.ok) throw new Error('Erro ao atualizar status');
      toast.success(current ? 'Avença suspensa' : 'Avença ativada');
      invalidateCache('/api/recurring');
      reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Faturação Recorrente</h1>
          <p className="text-sm text-muted-foreground">Gerencie avenças e contratos com emissão automática</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={async () => {
              if(!confirm('Deseja processar todas as avenças pendentes até hoje? As faturas serão geradas como Rascunho.')) return;
              try {
                const res = await fetch('/api/recurring/process', { method: 'POST' });
                const data = await res.json();
                if(data.error) throw new Error(data.error);
                toast.success(data.message);
                reload();
              } catch(e:any) {
                toast.error(e.message);
              }
            }} 
            disabled={loading} 
            className="ms-btn-secondary bg-[#005A9E] text-white hover:bg-[#004A82] border-transparent hover:border-[#003A62] inline-flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Processar Lote Pendente
          </button>
          <button onClick={reload} disabled={loading} className="ms-btn-secondary inline-flex items-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} 
            Atualizar
          </button>
          <button onClick={() => setModalOpen(true)} className="ms-btn-primary"><Plus className="w-4 h-4" /> Nova Avença</button>
        </div>
      </div>

      <div className="ms-card overflow-hidden">
        <div className="flex-1 overflow-x-auto rounded-md border bg-card">
          <table className="w-full text-[13px]">
            <thead className="bg-muted/50 sticky top-0 backdrop-blur-sm z-10 border-b">
              <tr className="text-left font-medium text-muted-foreground">
                <th className="py-2.5 px-3">Cliente</th>
                <th className="py-2.5 px-3">Descrição</th>
                <th className="py-2.5 px-3 text-right">Valor</th>
                <th className="py-2.5 px-3">Periodicidade</th>
                <th className="py-2.5 px-3">Próxima Emissão</th>
                <th className="py-2.5 px-3">Estado</th>
                <th className="py-2.5 px-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={7} className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></td></tr>
              ) : list.length === 0 ? (
                <tr><td colSpan={7} className="py-10 text-center text-muted-foreground">Nenhuma avença registada.</td></tr>
              ) : (
                list.map(r => (
                  <tr key={r.id} className="hover:bg-muted/40 transition-colors">
                    <td className="py-2 px-3 font-medium">{r.client?.name}</td>
                    <td className="py-2 px-3 text-muted-foreground truncate max-w-[200px]">{r.description || '-'}</td>
                    <td className="py-2 px-3 text-right font-mono font-semibold">{formatAOA(r.amount)}</td>
                    <td className="py-2 px-3">
                      {r.frequency === 'monthly' ? 'Mensal' : r.frequency === 'quarterly' ? 'Trimestral' : 'Anual'}
                    </td>
                    <td className="py-2 px-3 font-mono">{r.next_issue_date}</td>
                    <td className="py-2 px-3">
                      {r.is_active ? (
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold bg-success/10 text-success px-1.5 py-0.5 rounded">Ativa</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Suspensa</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <button onClick={() => toggleStatus(r.id, r.is_active)} className="p-1.5 hover:bg-secondary rounded text-muted-foreground hover:text-foreground">
                        {r.is_active ? <XCircle className="w-4 h-4 text-warning" /> : <CheckCircle2 className="w-4 h-4 text-success" />}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && <RecurringModal onClose={() => setModalOpen(false)} onSaved={reload} />}
    </div>
  );
}
