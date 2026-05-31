'use client';

import { useMemo, useState } from 'react';
import { ClipboardList, Loader2, RefreshCw, Search, Filter, X } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import { useResource } from '@/lib/hooks/use-resource';
import { useDebounced } from '@/lib/hooks/use-debounced';
import ExportButton from '@/components/export-button';
import { useProfile } from '@/lib/hooks/use-profile';
import { ShieldAlert } from 'lucide-react';

type Log = { id: string; action: string; entity: string; entity_id?: string; details?: any; created_at: string };

const actionLabels: Record<string, string> = {
  'invoice.create': 'Fatura emitida',
  'invoice.cancel': 'Fatura cancelada',
  'client.create': 'Cliente criado',
  'product.create': 'Produto criado',
  'company.update': 'Empresa atualizada',
  'company.create': 'Empresa criada',
  'signup.pending': 'Registo pendente',
  'saft.export': 'SAF-T exportado',
  'fiscal_config.update': 'Configuração fiscal',
  'fiscal_config.activate': 'Ativação AGT',
  'erp.sync': 'Sincronização ERP',
  'erp.integration.upsert': 'Integração ERP atualizada',
  'erp.integration.delete': 'Integração ERP removida',
};
const actionColors: Record<string, string> = {
  'invoice.create': 'bg-success/10 text-success',
  'invoice.cancel': 'bg-destructive/10 text-destructive',
  'client.create': 'bg-primary/10 text-primary',
  'product.create': 'bg-primary/10 text-primary',
  'company.update': 'bg-warning/10 text-warning',
  'company.create': 'bg-primary/10 text-primary',
  'saft.export': 'bg-primary/10 text-primary',
  'fiscal_config.update': 'bg-primary/10 text-primary',
  'fiscal_config.activate': 'bg-success/10 text-success',
  'erp.sync': 'bg-primary/10 text-primary',
};

const ACTION_OPTIONS = [
  { value: '', label: 'Todas as ações' },
  { value: 'invoice.create', label: 'Fatura emitida' },
  { value: 'invoice.cancel', label: 'Fatura cancelada' },
  { value: 'client.create', label: 'Cliente criado' },
  { value: 'product.create', label: 'Produto criado' },
  { value: 'company.update', label: 'Empresa atualizada' },
  { value: 'fiscal_config.update', label: 'Configuração fiscal' },
  { value: 'fiscal_config.activate', label: 'Ativação AGT' },
  { value: 'saft.export', label: 'SAF-T exportado' },
  { value: 'erp.sync', label: 'Sincronização ERP' },
];

const ENTITY_OPTIONS = [
  { value: '', label: 'Todas as entidades' },
  { value: 'invoice', label: 'Faturas' },
  { value: 'client', label: 'Clientes' },
  { value: 'product', label: 'Produtos' },
  { value: 'company', label: 'Empresa' },
  { value: 'fiscal_config', label: 'Configuração fiscal' },
  { value: 'erp_integration', label: 'Integração ERP' },
];

export default function AuditView() {
  const { isAdmin, loading: profileLoading } = useProfile();
  const [action, setAction] = useState('');
  const [entity, setEntity] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search.trim(), 300);

  const url = useMemo(() => {
    const p = new URLSearchParams();
    if (action) p.set('action', action);
    if (entity) p.set('entity', entity);
    if (from) p.set('date_from', from);
    if (to) p.set('date_to', to);
    if (debounced) p.set('search', debounced);
    p.set('limit', '300');
    return `/api/audit-logs?${p.toString()}`;
  }, [action, entity, from, to, debounced]);

  const { data, loading, reload, error } = useResource<{ logs: Log[] }>(url, { ttl: 20_000 });
  const logs = data?.logs ?? [];
  const firstLoad = loading && !data;

  if (profileLoading || firstLoad) return <div className="flex items-center justify-center p-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  const clearFilters = () => { setAction(''); setEntity(''); setFrom(''); setTo(''); setSearch(''); };
  const hasFilters = !!(action || entity || from || to || search);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Auditoria</h1>
          <p className="text-sm text-muted-foreground">Registo completo das ações na sua empresa (compliance AGT)</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <ExportButton
            rows={logs}
            columns={[
              { header: 'Data', accessor: (l: Log) => formatDateTime(l.created_at) },
              { header: 'Ação', accessor: (l: Log) => actionLabels[l.action] ?? l.action },
              { header: 'Entidade', accessor: (l: Log) => l.entity },
              { header: 'ID entidade', accessor: (l: Log) => l.entity_id ?? '' },
              { header: 'Detalhes', accessor: (l: Log) => l.details ? JSON.stringify(l.details) : '' },
            ]}
            filenameBase="auditoria"
            sheetName="Auditoria"
          />
          <button onClick={reload} disabled={loading} className="inline-flex items-center gap-2 px-3 h-10 rounded border border-border bg-background text-sm font-medium hover:bg-secondary disabled:opacity-60">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Actualizar
          </button>
        </div>
      </div>

      {/* Smart filters */}
      <div className="ms-card p-4 flex flex-col lg:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input placeholder="Pesquisar ID da entidade..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-10 pl-10 pr-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <select value={action} onChange={(e) => setAction(e.target.value)} className="h-10 pl-10 pr-8 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary min-w-[170px]">
            {ACTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <select value={entity} onChange={(e) => setEntity(e.target.value)} className="h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary min-w-[150px]">
          {ENTITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">De</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Até</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        {hasFilters && (
          <button onClick={clearFilters} className="inline-flex items-center gap-1 text-xs px-3 h-10 rounded border border-border hover:bg-secondary"><X className="w-3.5 h-3.5" /> Limpar</button>
        )}
      </div>

      {error && !data && (
        <div className="ms-card p-4 border-l-4 border-destructive bg-destructive/5 text-sm text-destructive">Erro a carregar auditoria: {error.message}</div>
      )}

      <div className="ms-card overflow-hidden">
        {firstLoad ? <div className="p-10 text-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground mx-auto" /></div> : logs.length === 0 ? (
          <div className="p-10 text-center">
            <ClipboardList className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
            <div className="text-muted-foreground">{hasFilters ? 'Sem registos para estes filtros' : 'Sem registos'}</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60">
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="py-3 px-4">Data</th><th className="py-3 px-4">Ação</th>
                <th className="py-3 px-4">Entidade</th><th className="py-3 px-4">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-t">
                  <td className="py-3 px-4 text-muted-foreground font-mono text-xs whitespace-nowrap">{formatDateTime(l.created_at)}</td>
                  <td className="py-3 px-4"><span className={`inline-flex px-2 py-0.5 text-xs rounded font-medium ${actionColors[l.action] ?? 'bg-secondary'}`}>{actionLabels[l.action] ?? l.action}</span></td>
                  <td className="py-3 px-4 text-xs">{l.entity}</td>
                  <td className="py-3 px-4 text-xs text-muted-foreground max-w-md truncate" title={l.details ? JSON.stringify(l.details) : ''}>{l.details ? JSON.stringify(l.details) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
        {logs.length > 0 && <div className="px-4 py-3 border-t text-xs text-muted-foreground">{logs.length} registo(s){hasFilters ? ' (filtrados)' : ''}</div>}
      </div>
    </div>
  );
}
