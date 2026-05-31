'use client';

import Link from 'next/link';
import { Banknote, Receipt, FileText, Users as UsersIcon, Plus, ArrowRight, XCircle, CheckCircle2, Loader2, RefreshCw, AlertTriangle, TrendingUp, Package, Clock } from 'lucide-react';
import { formatAOA, formatDateTime, cn } from '@/lib/utils';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, BarChart, Bar, CartesianGrid } from 'recharts';
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

function paymentBadge(status?: string) {
  switch (status) {
    case 'pago': return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-success/10 text-success font-medium"><CheckCircle2 className="w-3 h-3" /> Pago</span>;
    case 'parcial': return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-warning/10 text-warning font-medium"><Clock className="w-3 h-3" /> Parcial</span>;
    case 'pendente': return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-destructive/10 text-destructive font-medium"><Clock className="w-3 h-3" /> Pendente</span>;
    default: return null;
  }
}

export default function DashboardView() {
  const { data: stats, loading, validating, reload, error } = useResource<Stats>('/api/dashboard', { 
    ttl: 30_000,
    refreshInterval: 60_000, // Auto-update dashboard every 1m
  });
  const firstLoad = loading && !stats;
  const isRefreshing = validating && !!stats;

  const cards = [
    { label: 'Receita do mês', value: formatAOA(stats?.monthRevenue ?? 0), icon: Banknote, color: 'text-primary' },
    { label: 'IVA acumulado', value: formatAOA(stats?.monthTax ?? 0), icon: Receipt, color: 'text-success' },
    { label: 'Faturas (mês)', value: String(stats?.monthCount ?? 0), icon: FileText, color: 'text-primary' },
    { label: 'Clientes', value: String(stats?.clientsCount ?? 0), icon: UsersIcon, color: 'text-primary' },
    { label: 'Produtos', value: String(stats?.productsCount ?? 0), icon: Package, color: 'text-primary' },
  ];

  const hasLowStock = (stats?.lowStock ?? []).length > 0;
  const hasUnpaid = (stats?.unpaid?.count ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            Visão geral da sua facturação
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={reload} disabled={loading || validating} title="Atualizar dashboard" className="inline-flex items-center gap-2 px-3 h-10 rounded border border-border bg-background text-sm font-medium hover:bg-secondary disabled:opacity-60">
            {(loading || validating) ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Atualizar
          </button>
          <Link href="/invoices/new" className="ms-btn-primary">
            <Plus className="w-4 h-4" /> Emitir fatura
          </Link>
        </div>
      </div>

      {error && !stats && (
        <div className="ms-card p-4 border-l-4 border-destructive bg-destructive/5 text-sm text-destructive">Erro a carregar dashboard: {error.message}</div>
      )}

      {/* Alerts row */}
      {(hasLowStock || hasUnpaid) && !firstLoad && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {hasUnpaid && (
            <div className="ms-card p-4 border-l-4 border-warning bg-warning/5 flex items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-sm">{stats?.unpaid.count} factura(s) por receber</div>
                  <div className="text-xs text-muted-foreground">Total em dívida: <span className="font-mono font-semibold text-foreground">{formatAOA(stats?.unpaid.total ?? 0)}</span></div>
                </div>
              </div>
              <Link href="/invoices" className="text-xs font-medium text-primary hover:underline whitespace-nowrap">Ver lista →</Link>
            </div>
          )}
          {hasLowStock && (
            <div className="ms-card p-4 border-l-4 border-destructive bg-destructive/5 flex items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-sm">{stats?.lowStock.length} produto(s) com stock baixo</div>
                  <div className="text-xs text-muted-foreground">Reposição necessária</div>
                </div>
              </div>
              <Link href="/products" className="text-xs font-medium text-primary hover:underline whitespace-nowrap">Ver produtos →</Link>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="stat-card">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-muted-foreground font-medium">{c.label}</span>
                <div className={cn('w-8 h-8 rounded bg-secondary flex items-center justify-center', c.color)}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold font-mono">{firstLoad ? <span className="inline-block w-20 h-6 bg-muted rounded animate-pulse" /> : c.value}</div>
            </div>
          );
        })}
      </div>

      {/* Monthly evolution chart */}
      <div className="ms-card p-6">
        <h3 className="font-semibold mb-4">Evolução mensal (ano actual)</h3>
        <div className="h-64">
          {firstLoad ? (
            <div className="h-full flex items-center justify-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats?.monthlyChart ?? []} margin={{ top: 5, right: 20, left: 10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="month" tickLine={false} tick={{ fontSize: 10 }} label={{ value: 'Mês', position: 'insideBottom', offset: -15, style: { textAnchor: 'middle', fontSize: 11 } }} />
                <YAxis tickLine={false} tick={{ fontSize: 10 }} tickFormatter={(v) => {
                  if (v >= 1_000_000) return `${(v/1_000_000).toFixed(1)}M`;
                  if (v >= 1_000) return `${(v/1_000).toFixed(0)}k`;
                  return String(v);
                }} />
                <Tooltip formatter={(v: any) => formatAOA(Number(v))} />
                <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="revenue" name="Receita" stroke="#0078D4" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="tax" name="IVA" stroke="#107C10" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top clients and Top products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="ms-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Top 5 clientes (ano)</h3>
          </div>
          {firstLoad ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : (stats?.topClients ?? []).length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Ainda sem dados.</div>
          ) : (
            <div className="space-y-2">
              {stats?.topClients.map((c, i) => {
                const max = stats!.topClients[0]!.total || 1;
                const pct = (c.total / max) * 100;
                return (
                  <div key={c.id}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="flex items-center gap-2 truncate"><span className="text-xs text-muted-foreground font-mono w-4">#{i+1}</span> <span className="font-medium truncate">{c.name}</span></span>
                      <span className="font-mono text-xs text-muted-foreground flex-shrink-0">{c.count} fat. · <span className="font-semibold text-foreground">{formatAOA(c.total)}</span></span>
                    </div>
                    <div className="h-2 bg-secondary rounded overflow-hidden"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="ms-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Package className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Top 5 produtos (ano)</h3>
          </div>
          {firstLoad ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : (stats?.topProducts ?? []).length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Ainda sem dados.</div>
          ) : (
            <div className="space-y-2">
              {stats?.topProducts.map((p, i) => {
                const max = stats!.topProducts[0]!.total || 1;
                const pct = (p.total / max) * 100;
                return (
                  <div key={p.id}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="flex items-center gap-2 truncate"><span className="text-xs text-muted-foreground font-mono w-4">#{i+1}</span> <span className="font-medium truncate">{p.name}</span></span>
                      <span className="font-mono text-xs text-muted-foreground flex-shrink-0">{p.qty.toFixed(0)} un. · <span className="font-semibold text-foreground">{formatAOA(p.total)}</span></span>
                    </div>
                    <div className="h-2 bg-secondary rounded overflow-hidden"><div className="h-full bg-success" style={{ width: `${pct}%` }} /></div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent invoices */}
      <div className="ms-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Últimas facturas</h3>
          <Link href="/invoices" className="text-sm text-primary font-medium hover:underline flex items-center gap-1">
            Ver todas <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-muted-foreground border-b">
                <th className="py-2 pr-4">Número</th>
                <th className="py-2 pr-4">Cliente</th>
                <th className="py-2 pr-4">Data</th>
                <th className="py-2 pr-4">Estado</th>
                <th className="py-2 pr-4">Pagamento</th>
                <th className="py-2 pl-4 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {firstLoad ? (
                <tr><td colSpan={6} className="py-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
              ) : (stats?.recent ?? []).length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Sem facturas ainda. <Link href="/invoices/new" className="text-primary font-medium">Emita a primeira</Link>.</td></tr>
              ) : (
                (stats?.recent ?? []).map((inv) => (
                  <tr key={inv.id} className="border-b hover:bg-secondary/50">
                    <td className="py-3 pr-4"><Link href={`/invoices/${inv.id}`} className="font-mono text-primary font-medium hover:underline">{inv.invoice_number}</Link></td>
                    <td className="py-3 pr-4">{inv.client?.name ?? '-'}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{formatDateTime(inv.issued_at)}</td>
                    <td className="py-3 pr-4">
                      {inv.status === 'issued' ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-success/10 text-success font-medium"><CheckCircle2 className="w-3 h-3" /> Emitida</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-destructive/10 text-destructive font-medium"><XCircle className="w-3 h-3" /> Cancelada</span>
                      )}
                    </td>
                    <td className="py-3 pr-4">{inv.status === 'issued' ? (paymentBadge(inv.payment_status) ?? <span className="text-xs text-muted-foreground">-</span>) : <span className="text-xs text-muted-foreground">-</span>}</td>
                    <td className="py-3 pl-4 text-right font-mono font-medium">{formatAOA(inv.total)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
