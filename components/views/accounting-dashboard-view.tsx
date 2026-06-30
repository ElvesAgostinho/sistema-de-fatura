'use client';

import { useResource } from '@/lib/hooks/use-resource';
import { formatAOA } from '@/lib/utils';
import { RefreshCw, Loader2, TrendingUp, HandCoins, Receipt, Landmark } from 'lucide-react';
import Link from 'next/link';

type DashboardData = {
  receivables: { total: number; aging: { current: number; days30: number; days60: number; days90plus: number } };
  payables: { total: number };
  billing: { monthly_revenue: number; monthly_tax: number };
  treasury: { active_drawers_cash: number; active_sessions: number };
};

export default function AccountingDashboardView() {
  const { data, loading, validating, reload } = useResource<DashboardData>('/api/accounting/dashboard', { ttl: 60_000 });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Painel Central</h1>
          <p className="text-sm text-muted-foreground">Visão geral financeira para Contabilidade</p>
        </div>
        <button
          onClick={reload}
          disabled={loading || validating}
          className="inline-flex items-center gap-2 px-3 h-10 rounded border border-border bg-background text-sm font-medium hover:bg-secondary disabled:opacity-60"
        >
          {(loading || validating) ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Atualizar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Quadrante 1: Faturação Global */}
        <div className="ms-card p-5 border-l-4 border-primary">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary/10 rounded text-primary"><TrendingUp className="w-5 h-5" /></div>
            <h3 className="font-bold">Faturação Emitida (Mês Atual)</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Base Tributável:</span>
              <span className="font-mono text-lg font-bold">{loading ? '...' : formatAOA(data?.billing.monthly_revenue ?? 0)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">IVA Liquidado:</span>
              <span className="font-mono text-lg font-bold text-sky-600">{loading ? '...' : formatAOA(data?.billing.monthly_tax ?? 0)}</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border flex justify-end">
            <Link href="/invoices" className="text-xs text-primary hover:underline">Ver Livro de Faturas &rarr;</Link>
          </div>
        </div>

        {/* Quadrante 2: Contas a Receber */}
        <div className="ms-card p-5 border-l-4 border-emerald-500">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-500/10 rounded text-emerald-600"><HandCoins className="w-5 h-5" /></div>
            <h3 className="font-bold">Contas a Receber (Dívidas)</h3>
          </div>
          <div className="mb-4">
            <div className="text-sm text-muted-foreground">Dívida Global Pendente</div>
            <div className="font-mono text-2xl font-bold text-emerald-600">{loading ? '...' : formatAOA(data?.receivables.total ?? 0)}</div>
          </div>
          <div className="grid grid-cols-4 gap-2 pt-2 border-t border-border text-center">
            <div>
              <div className="text-[10px] text-muted-foreground uppercase">A vencer</div>
              <div className="text-sm font-mono">{loading ? '...' : formatAOA(data?.receivables.aging.current ?? 0)}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase">+30 dias</div>
              <div className="text-sm font-mono text-amber-600">{loading ? '...' : formatAOA(data?.receivables.aging.days30 ?? 0)}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase">+60 dias</div>
              <div className="text-sm font-mono text-orange-600">{loading ? '...' : formatAOA(data?.receivables.aging.days60 ?? 0)}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase">+90 dias</div>
              <div className="text-sm font-mono font-bold text-red-600">{loading ? '...' : formatAOA(data?.receivables.aging.days90plus ?? 0)}</div>
            </div>
          </div>
        </div>

        {/* Quadrante 3: Contas a Pagar */}
        <div className="ms-card p-5 border-l-4 border-amber-500">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-500/10 rounded text-amber-600"><Receipt className="w-5 h-5" /></div>
            <h3 className="font-bold">Contas a Pagar (Fornecedores)</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Faturas a Liquidar:</span>
              <span className="font-mono text-xl font-bold text-amber-600">{loading ? '...' : formatAOA(data?.payables.total ?? 0)}</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border flex justify-end">
            <Link href="/purchases" className="text-xs text-primary hover:underline">Gerir Compras &rarr;</Link>
          </div>
        </div>

        {/* Quadrante 4: Tesouraria */}
        <div className="ms-card p-5 border-l-4 border-purple-500">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-500/10 rounded text-purple-600"><Landmark className="w-5 h-5" /></div>
            <h3 className="font-bold">Tesouraria Corrente</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Saldos de Gaveta (Caixas Abertas):</span>
              <span className="font-mono text-lg font-bold">{loading ? '...' : formatAOA(data?.treasury.active_drawers_cash ?? 0)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Terminais Abertos:</span>
              <span className="font-bold">{loading ? '...' : (data?.treasury.active_sessions ?? 0)}</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border flex justify-end">
            <Link href="/accounting/closings" className="text-xs text-primary hover:underline">Ver Fechos Globais &rarr;</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
