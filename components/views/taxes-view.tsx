'use client';

import { useState } from 'react';
import { useResource } from '@/lib/hooks/use-resource';
import { formatAOA } from '@/lib/utils';
import { Loader2, Calculator, Info, FileJson } from 'lucide-react';
import SaftExportPanel from '@/components/views/saft-export-panel';

export default function TaxesView() {
  const [tab, setTab] = useState<'iva' | 'saft'>('iva');
  const { data, loading } = useResource<any>('/api/dashboard', { ttl: 60_000 });
  const monthlyChart = data?.monthlyChart ?? [];
  const currentMonthIVA = monthlyChart.length > 0 ? monthlyChart[monthlyChart.length - 1].tax : 0;
  const totalIVA = monthlyChart.reduce((acc: number, m: any) => acc + m.tax, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Impostos & SAF-T</h1>
          <p className="text-sm text-muted-foreground">Resumo de impostos a declarar e exportação SAF-T</p>
        </div>
      </div>

      <div className="flex gap-4 border-b border-border">
        <button
          onClick={() => setTab('iva')}
          className={`pb-2 text-sm font-medium border-b-2 transition-colors ${tab === 'iva' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          Resumo de IVA
        </button>
        <button
          onClick={() => setTab('saft')}
          className={`pb-2 text-sm font-medium border-b-2 transition-colors ${tab === 'saft' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          Exportar SAF-T
        </button>
      </div>

      {tab === 'iva' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="ms-card p-6 flex flex-col justify-center items-center text-center">
              <Calculator className="w-8 h-8 text-primary mb-2" />
              <h3 className="text-muted-foreground text-sm font-medium">IVA do Mês Atual</h3>
              <p className="text-2xl font-bold">{loading ? '...' : formatAOA(currentMonthIVA)}</p>
            </div>
            <div className="ms-card p-6 flex flex-col justify-center items-center text-center">
              <Calculator className="w-8 h-8 text-muted-foreground mb-2" />
              <h3 className="text-muted-foreground text-sm font-medium">IVA Acumulado no Ano</h3>
              <p className="text-2xl font-bold">{loading ? '...' : formatAOA(totalIVA)}</p>
            </div>
          </div>

          <div className="ms-card p-4 border-l-4 border-blue-500 bg-blue-50/50 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-blue-800">Declaração de IVA à AGT</p>
              <p className="text-blue-700/80 mt-1">O apuramento do IVA deve ser submetido mensalmente até ao último dia do mês seguinte através do Portal do Contribuinte da AGT ou extraindo o ficheiro SAF-T.</p>
            </div>
          </div>

          <div className="ms-card overflow-hidden">
            <div className="px-5 py-4 border-b">
              <h3 className="font-semibold">Resumo Mensal de IVA</h3>
            </div>
            {loading ? (
              <div className="p-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-secondary/60">
                  <tr className="text-left text-xs uppercase text-muted-foreground">
                    <th className="py-3 px-5">Mês</th>
                    <th className="py-3 px-5 text-right">IVA Cobrado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {monthlyChart.map((m: any, i: number) => (
                    <tr key={i} className="hover:bg-secondary/40">
                      <td className="py-3 px-5 font-medium">{m.month}</td>
                      <td className="py-3 px-5 text-right font-mono">{formatAOA(m.tax)}</td>
                    </tr>
                  ))}
                  {monthlyChart.length === 0 && (
                    <tr>
                      <td colSpan={2} className="py-8 text-center text-muted-foreground">Sem dados disponíveis.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === 'saft' && (
        <SaftExportPanel />
      )}
    </div>
  );
}
