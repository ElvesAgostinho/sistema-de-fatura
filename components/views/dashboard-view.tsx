'use client';

import Link from 'next/link';
import { Plus, ArrowRight, Loader2, RefreshCw } from 'lucide-react';
import { formatAOA, formatDateTime, cn } from '@/lib/utils';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { useResource } from '@/lib/hooks/use-resource';

type Stats = {
  monthRevenue: number; monthTax: number; monthCount: number;
  totalIssued: number; totalCancelled: number; clientsCount: number; productsCount: number;
  monthlyChart: { month: string; revenue: number; tax: number; count: number }[];
  recent: { id: string; invoice_number: string; total: number; status: string; payment_status?: string; amount_paid?: number; issued_at: string; client?: { name?: string; nif?: string } | null }[];
  topClients: { id: string; name: string; total: number; count: number }[];
  topProducts: { id: string; name: string; total: number; qty: number }[];
  unpaid: { list: { id: string; invoice_number: string; total: number; amount_paid: number; payment_status: string; issued_at: string; client?: { name?: string } | null }[]; total: number; count: number };
  lowStock: { id: string; name: string; quantity_in_stock: number; stock_alert_threshold: number }[];
};

export default function DashboardView() {
  const { data: stats, loading, validating, reload, error } = useResource<Stats>('/api/dashboard', { 
    ttl: 30_000,
    refreshInterval: 60_000,
  });
  const firstLoad = loading && !stats;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800 tracking-tight">Painel de Controlo</h1>
          <p className="text-sm text-slate-500">Visão geral do negócio</p>
        </div>
        <div className="flex gap-2">
          <button onClick={reload} disabled={loading || validating} title="Atualizar dados" className="inline-flex items-center justify-center w-11 h-11 rounded bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 active:scale-95">
            <RefreshCw className={cn("w-4 h-4", validating && "animate-spin")} />
          </button>
        </div>
      </div>

      {error && !stats && (
        <div className="bg-red-50 text-red-600 p-4 rounded-md border border-red-100 text-sm">
          Erro a carregar dados do painel: {error.message}
        </div>
      )}

      {/* 2-Column Grid for Xero Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* LEFT COLUMN */}
        <div className="space-y-6">
          {/* Bank Accounts / Resumo do Mês */}
          <div className="bg-white rounded shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-semibold text-slate-800">Resumo Financeiro (Mês atual)</h3>
            </div>
            <div className="p-5">
              {firstLoad ? (
                <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-end pb-3 border-b border-slate-100">
                    <div>
                      <div className="text-sm text-slate-500 font-medium mb-1">Receita Faturada</div>
                      <div className="text-2xl font-semibold text-slate-800">{formatAOA(stats?.monthRevenue ?? 0)}</div>
                    </div>
                  </div>
                  <div className="flex justify-between items-end pb-3 border-b border-slate-100">
                    <div>
                      <div className="text-sm text-slate-500 font-medium mb-1">IVA Liquidado</div>
                      <div className="text-2xl font-semibold text-slate-800">{formatAOA(stats?.monthTax ?? 0)}</div>
                    </div>
                  </div>
                  <div className="flex justify-between items-end">
                    <div>
                      <div className="text-sm text-slate-500 font-medium mb-1">Volume de Documentos</div>
                      <div className="text-xl font-semibold text-slate-800">{stats?.monthCount ?? 0} faturas emitidas</div>
                    </div>
                    <Link href="/invoices/new" className="text-sm text-[#13b5ea] hover:underline font-medium">Nova fatura</Link>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Invoices owed to you */}
          <div className="bg-white rounded shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-semibold text-slate-800">Faturas a receber</h3>
              <Link href="/invoices" className="text-sm text-[#13b5ea] hover:underline">Ver detalhes</Link>
            </div>
            <div className="p-5">
              {firstLoad ? (
                <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
              ) : (
                <>
                  <div className="mb-6 flex justify-between">
                    <div>
                      <div className="text-sm text-slate-500 font-medium mb-1">Total em dívida</div>
                      <div className="text-3xl font-semibold text-slate-800">{formatAOA(stats?.unpaid?.total ?? 0)}</div>
                      <div className="text-xs text-slate-500 mt-1">{stats?.unpaid?.count ?? 0} faturas pendentes</div>
                    </div>
                  </div>
                  
                  {stats?.unpaid?.list && stats.unpaid.list.length > 0 ? (
                    <div className="space-y-3">
                      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Dívidas Recentes</div>
                      {stats.unpaid.list.slice(0, 4).map(inv => (
                        <div key={inv.id} className="flex justify-between items-center text-sm">
                          <div className="truncate pr-4">
                            <span className="font-medium text-slate-700">{inv.client?.name ?? 'Cliente'}</span>
                            <div className="text-xs text-slate-500">Vencimento: {formatDateTime(inv.issued_at).split(',')[0]}</div>
                          </div>
                          <div className="font-semibold text-slate-800 whitespace-nowrap">{formatAOA(inv.total - (inv.amount_paid ?? 0))}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500 text-center py-6">Excelente! Não existem faturas em dívida.</div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">
          {/* Total cash in and out (Monthly Chart) */}
          <div className="bg-white rounded shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-semibold text-slate-800">Evolução Mensal (Receita vs IVA)</h3>
            </div>
            <div className="p-5">
              {firstLoad ? (
                <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
              ) : (stats?.monthlyChart && stats.monthlyChart.length > 0) ? (
                <div className="h-48 sm:h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.monthlyChart} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={10} />
                      <YAxis hide={true} />
                      <Tooltip 
                        cursor={{ fill: '#f1f5f9' }}
                        contentStyle={{ borderRadius: '6px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                        formatter={(v: any) => formatAOA(Number(v))} 
                      />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: '10px' }} />
                      <Bar dataKey="revenue" name="Receitas" fill="#13b5ea" radius={[2, 2, 0, 0]} maxBarSize={40} />
                      <Bar dataKey="tax" name="IVA" fill="#107C10" radius={[2, 2, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-sm text-slate-500 text-center py-10">Ainda não existem dados financeiros suficientes.</div>
              )}
            </div>
          </div>

          {/* Recent Invoices */}
          <div className="bg-white rounded shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-semibold text-slate-800">Faturas emitidas recentemente</h3>
              <Link href="/invoices/new" className="text-sm text-[#13b5ea] hover:underline flex items-center gap-1">
                <Plus className="w-3 h-3" /> Nova venda
              </Link>
            </div>
            <div className="p-0">
              {firstLoad ? (
                <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
              ) : stats?.recent && stats.recent.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {stats.recent.map(inv => (
                    <Link href={`/invoices/${inv.id}`} key={inv.id} className="block p-4 hover:bg-slate-50 transition-colors">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-slate-800 text-sm">{inv.client?.name ?? 'Consumidor Final'}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{inv.invoice_number} · {formatDateTime(inv.issued_at).split(',')[0]}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-slate-800 text-sm">{formatAOA(inv.total)}</div>
                          {inv.status === 'cancelled' ? (
                            <span className="text-[10px] uppercase font-bold text-red-500">Cancelada</span>
                          ) : inv.payment_status === 'pago' ? (
                            <span className="text-[10px] uppercase font-bold text-green-600">Paga</span>
                          ) : (
                            <span className="text-[10px] uppercase font-bold text-orange-500">Pendente</span>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-slate-500 text-center py-10">Não emitiu faturas recentemente.</div>
              )}
              <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
                <Link href="/invoices" className="text-sm text-[#13b5ea] font-medium hover:underline">Ver todas as faturas</Link>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
