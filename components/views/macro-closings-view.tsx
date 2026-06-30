'use client';

import { useState } from 'react';
import { useResource } from '@/lib/hooks/use-resource';
import { formatAOA, formatDateTime } from '@/lib/utils';
import { RefreshCw, Loader2, Calendar, Archive, Lock, FileCheck, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

type MacroClosing = {
  id: string;
  type: string;
  reference_date: string;
  total_revenue: number;
  total_tax: number;
  total_cash: number;
  sales_count: number;
  sessions_count: number;
  status: string;
  closed_at: string;
};

type ClosingsData = { closings: MacroClosing[] };

export default function MacroClosingsView() {
  const [activeTab, setActiveTab] = useState<'DAILY' | 'MONTHLY' | 'YEARLY'>('DAILY');
  
  const { data, loading, reload } = useResource<ClosingsData>(`/api/accounting/closings?type=${activeTab}`, { ttl: 30_000, dependencies: [activeTab] });
  
  const [submitting, setSubmitting] = useState(false);
  const [newDate, setNewDate] = useState('');

  const handleCreateClosing = async () => {
    if (!newDate) return toast.error('Selecione uma data para o fecho.');
    
    setSubmitting(true);
    try {
      const res = await fetch('/api/accounting/closings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: activeTab, reference_date: newDate, notes: 'Fecho processado manualmente pelo Contabilista' })
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      
      toast.success('Fecho criado e consolidado com sucesso!');
      reload();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao processar o fecho.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fechos Globais Consolidados</h1>
          <p className="text-sm text-muted-foreground">Consolidação definitiva de fechos operacionais (Imutável)</p>
        </div>
        <button
          onClick={reload}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 h-10 rounded border border-border bg-background text-sm font-medium hover:bg-secondary disabled:opacity-60"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Atualizar
        </button>
      </div>

      <div className="border-b border-border flex gap-4">
        {[
          { id: 'DAILY', label: 'Diário', desc: 'Consolida todos os fechos de caixa do dia' },
          { id: 'MONTHLY', label: 'Mensal', desc: 'Fecho mensal definitivo e emissão de SAF-T' },
          { id: 'YEARLY', label: 'Anual', desc: 'Apuramento de fim de ano fiscal' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Novo Fecho Form */}
      <div className="ms-card p-5 bg-secondary/30 flex flex-col sm:flex-row sm:items-end gap-4 border border-border">
        <div className="flex-1">
          <h3 className="text-sm font-bold flex items-center gap-2 mb-1">
            <Archive className="w-4 h-4 text-primary" /> Processar Novo Fecho {activeTab === 'DAILY' ? 'Diário' : activeTab === 'MONTHLY' ? 'Mensal' : 'Anual'}
          </h3>
          <p className="text-xs text-muted-foreground">
            Atenção: Ao processar este fecho, todos os documentos do período serão selados e não poderão ser alterados nem emitidos com data retroativa.
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 sm:w-48">
            <input
              type="date"
              className="w-full h-10 px-3 rounded-md border border-input text-sm focus:ring-2 focus:ring-primary outline-none"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
            />
          </div>
          <button
            onClick={handleCreateClosing}
            disabled={submitting || !newDate}
            className="ms-btn-primary h-10 px-4 flex items-center gap-2 whitespace-nowrap"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />} Consolidar
          </button>
        </div>
      </div>

      {/* Tabela de Fechos Existentes */}
      <div className="ms-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60">
            <tr className="text-left text-xs uppercase text-muted-foreground">
              <th className="py-3 px-4">Data Ref.</th>
              <th className="py-3 px-4 text-right">Terminais</th>
              <th className="py-3 px-4 text-right">Qtd. Faturas</th>
              <th className="py-3 px-4 text-right">Vendas Globais</th>
              <th className="py-3 px-4 text-right">IVA Total</th>
              <th className="py-3 px-4">Estado</th>
              <th className="py-3 px-4">Processado Em</th>
            </tr>
          </thead>
          <tbody>
            {loading && !data ? (
              <tr><td colSpan={7} className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></td></tr>
            ) : data?.closings.length === 0 ? (
              <tr><td colSpan={7} className="py-10 text-center text-muted-foreground">Nenhum fecho {activeTab.toLowerCase()} encontrado.</td></tr>
            ) : (
              data?.closings.map((c) => (
                <tr key={c.id} className="border-t hover:bg-secondary/40">
                  <td className="py-3 px-4 font-bold flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    {new Date(c.reference_date).toLocaleDateString('pt-PT')}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-muted-foreground">{c.sessions_count}</td>
                  <td className="py-3 px-4 text-right font-mono">{c.sales_count}</td>
                  <td className="py-3 px-4 text-right font-mono font-bold">{formatAOA(c.total_revenue)}</td>
                  <td className="py-3 px-4 text-right font-mono text-sky-600">{formatAOA(c.total_tax)}</td>
                  <td className="py-3 px-4">
                    {c.status === 'CLOSED' ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Definitivo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
                        Reaberto
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-muted-foreground text-xs">{formatDateTime(c.closed_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
