'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Receipt, Clock, Package, Users as UsersIcon, Loader2, RefreshCw,
  ArrowRight, Info, AlertTriangle,
} from 'lucide-react';
import { formatAOA, formatDateTime, cn } from '@/lib/utils';
import { useResource } from '@/lib/hooks/use-resource';

/* ─── Types ────────────────────────────────────────────────────── */
type MonthlyChartItem = { month: string; revenue: number; tax: number; count: number };
type TopProduct = { id: string; name: string; total: number; qty: number };
type Stats = {
  monthlyChart: MonthlyChartItem[];
  topProducts: TopProduct[];
};

type InvoiceItem = {
  id: string;
  invoice_number: string;
  total: number;
  amount_paid: number;
  payment_status: string;
  status: string;
  issued_at: string;
  client?: { id?: string; name?: string; nif?: string } | null;
};
type InvoicesResp = { invoices: InvoiceItem[]; total: number };

type Client = { id: string; name: string; nif?: string };
type ClientsResp = { clients: Client[] };

/* ─── Helpers ───────────────────────────────────────────────────── */
const TABS = [
  { id: 'iva', label: 'IVA do Mês', icon: Receipt },
  { id: 'receivables', label: 'Contas a Receber', icon: Clock },
  { id: 'products', label: 'Vendas por Produto', icon: Package },
  { id: 'client', label: 'Extrato de Cliente', icon: UsersIcon },
] as const;
type TabId = typeof TABS[number]['id'];

function daysBetween(dateStr: string) {
  const issued = new Date(dateStr).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((now - issued) / 86_400_000));
}

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/* ─── IVA tab ────────────────────────────────────────────────────── */
function IvaTab({ stats, loading }: { stats: Stats | undefined; loading: boolean }) {
  const chart = stats?.monthlyChart ?? [];
  const totalIva = chart.reduce((s, r) => s + r.tax, 0);
  const currentMonth = MONTH_NAMES[new Date().getMonth()];

  return (
    <div className="space-y-4">
      {/* Summary card */}
      <div className="ms-card p-5 flex flex-col sm:flex-row sm:items-center gap-4 border-l-4 border-primary bg-primary/5">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center text-primary">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Total IVA a declarar ({new Date().getFullYear()})</div>
            <div className="text-2xl font-bold font-mono text-primary">
              {loading ? <span className="inline-block w-32 h-7 bg-muted rounded animate-pulse" /> : formatAOA(totalIva)}
            </div>
          </div>
        </div>
        <div className="flex items-start gap-2 p-3 bg-primary/5 border border-primary/20 rounded text-xs text-muted-foreground max-w-sm">
          <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <span>O IVA total acumulado deve ser declarado mensalmente na plataforma da AGT (e-Declarações).</span>
        </div>
      </div>

      <div className="ms-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60">
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="py-3 px-4">Mês</th>
                <th className="py-3 px-4 text-right">Receita (AOA)</th>
                <th className="py-3 px-4 text-right">IVA Cobrado (AOA)</th>
                <th className="py-3 px-4 text-right">Nº Faturas</th>
              </tr>
            </thead>
            <tbody>
              {loading && !stats ? (
                <tr><td colSpan={4} className="py-10 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
              ) : chart.length === 0 ? (
                <tr><td colSpan={4} className="py-10 text-center text-muted-foreground">Sem dados disponíveis.</td></tr>
              ) : (
                chart.map((row) => (
                  <tr
                    key={row.month}
                    className={cn(
                      'border-t hover:bg-secondary/40 transition-colors',
                      row.month === currentMonth && 'bg-primary/5 font-semibold',
                    )}
                  >
                    <td className="py-3 px-4 flex items-center gap-2">
                      {row.month}
                      {row.month === currentMonth && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">Atual</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono">{formatAOA(row.revenue)}</td>
                    <td className="py-3 px-4 text-right font-mono text-success font-semibold">{formatAOA(row.tax)}</td>
                    <td className="py-3 px-4 text-right">{row.count}</td>
                  </tr>
                ))
              )}
            </tbody>
            {!loading && chart.length > 0 && (
              <tfoot className="bg-secondary/40 border-t">
                <tr className="text-sm font-semibold">
                  <td className="py-3 px-4">Total</td>
                  <td className="py-3 px-4 text-right font-mono">{formatAOA(chart.reduce((s, r) => s + r.revenue, 0))}</td>
                  <td className="py-3 px-4 text-right font-mono text-success">{formatAOA(totalIva)}</td>
                  <td className="py-3 px-4 text-right">{chart.reduce((s, r) => s + r.count, 0)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─── Contas a Receber tab ─────────────────────────────────────── */
function ReceivablesTab() {
  const { data, loading, error } = useResource<InvoicesResp>('/api/invoices?status=issued&page_size=200', { ttl: 60_000 });

  const unpaid = useMemo(() => {
    const all = data?.invoices ?? [];
    return all.filter((inv) => inv.payment_status !== 'pago' && inv.status === 'issued');
  }, [data]);

  const totalDebt = unpaid.reduce((s, inv) => s + (inv.total - (inv.amount_paid ?? 0)), 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="ms-card p-5 flex flex-col sm:flex-row sm:items-center gap-4 border-l-4 border-warning bg-warning/5">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded bg-warning/10 flex items-center justify-center text-warning">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Total em dívida</div>
            <div className="text-2xl font-bold font-mono text-warning">
              {loading ? <span className="inline-block w-32 h-7 bg-muted rounded animate-pulse" /> : formatAOA(totalDebt)}
            </div>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          {!loading && <span><strong>{unpaid.length}</strong> fatura(s) por receber</span>}
        </div>
      </div>

      {error && !data && (
        <div className="ms-card p-4 border-l-4 border-destructive bg-destructive/5 text-sm text-destructive">
          Erro a carregar facturas: {error.message}
        </div>
      )}

      <div className="ms-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60">
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="py-3 px-4">Nº Fatura</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Data Emissão</th>
                <th className="py-3 px-4 text-right">Dias em Atraso</th>
                <th className="py-3 px-4 text-right">Total</th>
                <th className="py-3 px-4 text-right">Em Dívida</th>
                <th className="py-3 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {loading && !data ? (
                <tr><td colSpan={7} className="py-10 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
              ) : unpaid.length === 0 ? (
                <tr><td colSpan={7} className="py-10 text-center text-muted-foreground">Sem facturas em dívida. 🎉</td></tr>
              ) : (
                unpaid.map((inv) => {
                  const debt = inv.total - (inv.amount_paid ?? 0);
                  const days = daysBetween(inv.issued_at);
                  return (
                    <tr key={inv.id} className="border-t hover:bg-secondary/40 transition-colors">
                      <td className="py-3 px-4">
                        <Link href={`/invoices/${inv.id}`} className="font-mono text-primary font-medium hover:underline">
                          {inv.invoice_number}
                        </Link>
                      </td>
                      <td className="py-3 px-4">{inv.client?.name ?? '-'}</td>
                      <td className="py-3 px-4 text-muted-foreground">{formatDateTime(inv.issued_at)}</td>
                      <td className="py-3 px-4 text-right">
                        <span className={cn(
                          'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium',
                          days >= 30 ? 'bg-destructive/10 text-destructive' : days >= 15 ? 'bg-warning/10 text-warning' : 'bg-secondary text-muted-foreground',
                        )}>
                          {days > 0 ? `${days}d` : 'Hoje'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono">{formatAOA(inv.total)}</td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-warning">{formatAOA(debt)}</td>
                      <td className="py-3 px-4 text-right">
                        <Link href={`/invoices/${inv.id}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          Ver <ArrowRight className="w-3 h-3" />
                        </Link>
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
  );
}

/* ─── Vendas por Produto tab ────────────────────────────────────── */
function ProductSalesTab({ stats, loading }: { stats: Stats | undefined; loading: boolean }) {
  const products = stats?.topProducts ?? [];

  return (
    <div className="space-y-4">
      <div className="ms-card p-4 flex items-start gap-2 border-l-4 border-primary/40 bg-primary/5 text-sm text-muted-foreground">
        <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
        <span>
          Mostrando os <strong>5 produtos mais vendidos</strong> no ano corrente. Para ver todos os produtos, consulte a{' '}
          <Link href="/products" className="text-primary font-medium hover:underline">página de Produtos</Link>.
        </span>
      </div>

      <div className="ms-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60">
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Produto</th>
                <th className="py-3 px-4 text-right">Qtd Vendida</th>
                <th className="py-3 px-4 text-right">Receita Total</th>
              </tr>
            </thead>
            <tbody>
              {loading && !stats ? (
                <tr><td colSpan={4} className="py-10 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={4} className="py-10 text-center text-muted-foreground">Sem dados de produtos.</td></tr>
              ) : (
                products.map((p, i) => (
                  <tr key={p.id} className="border-t hover:bg-secondary/40 transition-colors">
                    <td className="py-3 px-4 text-xs text-muted-foreground font-mono">#{i + 1}</td>
                    <td className="py-3 px-4 font-medium">{p.name}</td>
                    <td className="py-3 px-4 text-right font-mono">{p.qty.toFixed(0)} un.</td>
                    <td className="py-3 px-4 text-right font-mono font-semibold">{formatAOA(p.total)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {!loading && products.length > 0 && (
              <tfoot className="bg-secondary/40 border-t">
                <tr className="text-sm font-semibold">
                  <td className="py-3 px-4" colSpan={2}>Total (top 5)</td>
                  <td className="py-3 px-4 text-right font-mono">{products.reduce((s, p) => s + p.qty, 0).toFixed(0)} un.</td>
                  <td className="py-3 px-4 text-right font-mono">{formatAOA(products.reduce((s, p) => s + p.total, 0))}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─── Extrato de Cliente tab ────────────────────────────────────── */
function ClientStatementTab() {
  const [selectedClientId, setSelectedClientId] = useState('');

  const { data: clientsData, loading: loadingClients } = useResource<ClientsResp>('/api/clients?page_size=200', { ttl: 120_000 });
  const clients = clientsData?.clients ?? [];

  const invoiceUrl = selectedClientId
    ? `/api/invoices?client_id=${selectedClientId}&page_size=200`
    : null;

  const { data: invData, loading: loadingInv } = useResource<InvoicesResp>(invoiceUrl, { ttl: 60_000, skip: !selectedClientId });
  const invoices = invData?.invoices ?? [];

  const totalRevenue = invoices.reduce((s, inv) => s + (inv.status === 'issued' ? inv.total : 0), 0);
  const totalPaid = invoices.reduce((s, inv) => s + (inv.status === 'issued' ? (inv.amount_paid ?? 0) : 0), 0);
  const totalDebt = totalRevenue - totalPaid;

  return (
    <div className="space-y-4">
      {/* Client picker */}
      <div className="ms-card p-4">
        <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
          <UsersIcon className="w-3 h-3" /> Selecionar cliente
        </label>
        <select
          value={selectedClientId}
          onChange={(e) => setSelectedClientId(e.target.value)}
          className="w-full sm:w-80 h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          disabled={loadingClients}
        >
          <option value="">{loadingClients ? 'Carregando clientes...' : 'Escolha um cliente...'}</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}{c.nif ? ` — ${c.nif}` : ''}</option>
          ))}
        </select>
      </div>

      {selectedClientId && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Total Facturado', value: totalRevenue, color: 'text-primary' },
              { label: 'Total Pago', value: totalPaid, color: 'text-success' },
              { label: 'Em Dívida', value: totalDebt, color: totalDebt > 0 ? 'text-warning' : 'text-success' },
            ].map((s) => (
              <div key={s.label} className="stat-card">
                <div className="text-xs text-muted-foreground mb-2">{s.label}</div>
                <div className={cn('text-xl font-bold font-mono', s.color)}>
                  {loadingInv ? <span className="inline-block w-24 h-6 bg-muted rounded animate-pulse" /> : formatAOA(s.value)}
                </div>
              </div>
            ))}
          </div>

          <div className="ms-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/60">
                  <tr className="text-left text-xs uppercase text-muted-foreground">
                    <th className="py-3 px-4">Nº Fatura</th>
                    <th className="py-3 px-4">Data</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4 text-right">Total</th>
                    <th className="py-3 px-4 text-right">Pago</th>
                    <th className="py-3 px-4 text-right">Em Dívida</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingInv && !invData ? (
                    <tr><td colSpan={6} className="py-10 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
                  ) : invoices.length === 0 ? (
                    <tr><td colSpan={6} className="py-10 text-center text-muted-foreground">Este cliente não tem facturas.</td></tr>
                  ) : (
                    invoices.map((inv) => {
                      const debt = inv.total - (inv.amount_paid ?? 0);
                      return (
                        <tr key={inv.id} className="border-t hover:bg-secondary/40 transition-colors">
                          <td className="py-3 px-4">
                            <Link href={`/invoices/${inv.id}`} className="font-mono text-primary font-medium hover:underline">
                              {inv.invoice_number}
                            </Link>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">{formatDateTime(inv.issued_at)}</td>
                          <td className="py-3 px-4">
                            {inv.status === 'issued' ? (
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-success/10 text-success font-medium">Emitida</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-destructive/10 text-destructive font-medium">Cancelada</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-mono">{formatAOA(inv.total)}</td>
                          <td className="py-3 px-4 text-right font-mono text-success">{formatAOA(inv.amount_paid ?? 0)}</td>
                          <td className={cn('py-3 px-4 text-right font-mono font-semibold', debt > 0 ? 'text-warning' : 'text-success')}>
                            {formatAOA(debt)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!selectedClientId && !loadingClients && (
        <div className="ms-card p-8 text-center text-muted-foreground text-sm">
          Selecione um cliente acima para ver o extrato de facturas.
        </div>
      )}
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────────── */
export default function ReportsView() {
  const [activeTab, setActiveTab] = useState<TabId>('iva');

  const { data: stats, loading, validating, reload } = useResource<Stats>('/api/dashboard', { ttl: 60_000 });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
          <p className="text-sm text-muted-foreground">Análise de IVA, contas a receber e vendas</p>
        </div>
        <button
          onClick={reload}
          disabled={loading || validating}
          title="Atualizar dados"
          className="inline-flex items-center gap-2 px-3 h-10 rounded border border-border bg-background text-sm font-medium hover:bg-secondary disabled:opacity-60"
        >
          {(loading || validating) ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Atualizar
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="flex gap-0 overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors',
                activeTab === id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'iva' && <IvaTab stats={stats} loading={loading} />}
      {activeTab === 'receivables' && <ReceivablesTab />}
      {activeTab === 'products' && <ProductSalesTab stats={stats} loading={loading} />}
      {activeTab === 'client' && <ClientStatementTab />}
    </div>
  );
}
