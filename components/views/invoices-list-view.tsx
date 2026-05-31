'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Plus, FileText, Download, XCircle, CheckCircle2, ChevronLeft, ChevronRight, Filter, Loader2, RefreshCw, Calendar, X } from 'lucide-react';
import { formatAOA, formatDateTime } from '@/lib/utils';
import { toast } from 'sonner';
import { useResource } from '@/lib/hooks/use-resource';
import { useDebounced } from '@/lib/hooks/use-debounced';
import ExportButton from '@/components/export-button';

type Invoice = {
  id: string; invoice_number: string; document_type: string;
  total: number; status: string; issued_at: string;
  client?: { name?: string; nif?: string } | null;
};

type ApiResp = { invoices: Invoice[]; total: number };

export default function InvoicesListView() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [docType, setDocType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const debounced = useDebounced(search.trim(), 300);
  const hasFilters = Boolean(debounced || status || docType || dateFrom || dateTo);

  const url = useMemo(() => {
    const params = new URLSearchParams();
    if (debounced) params.set('search', debounced);
    if (status) params.set('status', status);
    if (docType) params.set('document_type', docType);
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    params.set('page', String(page));
    params.set('page_size', String(pageSize));
    return `/api/invoices?${params.toString()}`;
  }, [debounced, status, docType, dateFrom, dateTo, page]);

  const clearFilters = () => {
    setSearch('');
    setStatus('');
    setDocType('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const { data, loading, validating, reload, error } = useResource<ApiResp>(url, {
    ttl: 60_000,
    refreshInterval: 60_000,
    onError: (e: any) => toast.error(e?.message ?? 'Erro a carregar faturas'),
  });
  const invoices = data?.invoices ?? [];
  const total = data?.total ?? 0;
  const isRefreshing = validating && !!data;
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  const onDownloadPdf = async (id: string, num: string) => {
    toast.info('A gerar PDF...');
    try {
      const r = await fetch(`/api/invoices/${id}/pdf`);
      if (!r.ok) { const j = await r.json().catch(() => ({})); toast.error(j?.error ?? 'Falha PDF'); return; }
      const blob = await r.blob();
      const url2 = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url2; a.download = `${num}.pdf`; document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url2);
    } catch { toast.error('Erro PDF'); }
  };

  const exportCols = useMemo(() => ([
    { header: 'Número', accessor: (i: Invoice) => i.invoice_number },
    { header: 'Tipo', accessor: (i: Invoice) => i.document_type },
    { header: 'Cliente', accessor: (i: Invoice) => i.client?.name ?? '' },
    { header: 'NIF Cliente', accessor: (i: Invoice) => i.client?.nif ?? '' },
    { header: 'Data', accessor: (i: Invoice) => i.issued_at },
    { header: 'Estado', accessor: (i: Invoice) => i.status === 'issued' ? 'Emitida' : 'Cancelada' },
    { header: 'Total (AOA)', accessor: (i: Invoice) => i.total },
  ]), []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Faturas</h1>
          <p className="text-sm text-muted-foreground">Consulte e gerencie as faturas emitidas</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportButton rows={invoices} columns={exportCols} filenameBase="faturas" sheetName="Faturas" />
          <button onClick={reload} disabled={loading || validating} title="Atualizar" className="ms-btn-secondary inline-flex items-center gap-2">
            {(loading || validating) ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} 
            <span>Atualizar</span>
          </button>
          <Link href="/invoices/new" className="ms-btn-primary"><Plus className="w-4 h-4" /> Emitir fatura</Link>
        </div>
      </div>

      <div className="ms-card p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="search" placeholder="Buscar por número (ex: FT 2026/0001)" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full h-10 pl-10 pr-10 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            {isRefreshing && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <select value={docType} onChange={(e) => { setDocType(e.target.value); setPage(1); }}
              className="h-10 pl-10 pr-8 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="">Todos tipos</option>
              <option value="FT">FT — Fatura</option>
              <option value="FR">FR — Fatura-Recibo</option>
              <option value="NC">NC — Nota de Crédito</option>
              <option value="ND">ND — Nota de Débito</option>
              <option value="RC">RC — Recibo</option>
              <option value="PP">PP — Pró-forma</option>
              <option value="GT">GT — Guia de Transporte</option>
            </select>
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="h-10 pl-10 pr-8 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="">Todos estados</option>
              <option value="issued">Emitidas</option>
              <option value="cancelled">Canceladas</option>
            </select>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
          <div className="flex-1 grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> De</label>
              <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> Até</label>
              <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
          </div>
          {hasFilters && (
            <button type="button" onClick={clearFilters}
              className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md border border-input bg-background text-sm font-medium hover:bg-secondary shrink-0">
              <X className="w-4 h-4" /> Limpar filtros
            </button>
          )}
        </div>
      </div>

      {error && !data && (
        <div className="ms-card p-4 border-l-4 border-destructive bg-destructive/5 text-sm text-destructive">Erro: {error.message}</div>
      )}

      <div className="ms-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60">
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="py-3 px-4">Número</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">NIF</th>
                <th className="py-3 px-4">Data</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4 text-right">Total</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && !data ? (
                <tr><td colSpan={7} className="py-10 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={7} className="py-10 text-center text-muted-foreground">Nenhuma fatura encontrada</td></tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="border-t hover:bg-secondary/40 transition-colors">
                    <td className="py-3 px-4"><Link href={`/invoices/${inv.id}`} className="font-mono text-primary font-medium hover:underline">{inv.invoice_number}</Link></td>
                    <td className="py-3 px-4">{inv.client?.name ?? '-'}</td>
                    <td className="py-3 px-4 font-mono text-xs text-muted-foreground">{inv.client?.nif ?? '-'}</td>
                    <td className="py-3 px-4 text-muted-foreground">{formatDateTime(inv.issued_at)}</td>
                    <td className="py-3 px-4">
                      {inv.status === 'issued' ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-success/10 text-success font-medium"><CheckCircle2 className="w-3 h-3" /> Emitida</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-destructive/10 text-destructive font-medium"><XCircle className="w-3 h-3" /> Cancelada</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold">{formatAOA(inv.total)}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex gap-1">
                        <Link href={`/invoices/${inv.id}`} className="p-2 rounded hover:bg-secondary text-muted-foreground hover:text-foreground" title="Ver"><FileText className="w-4 h-4" /></Link>
                        <button onClick={() => onDownloadPdf(inv.id, inv.invoice_number.replace(/[^a-zA-Z0-9]/g, '_'))} className="p-2 rounded hover:bg-secondary text-muted-foreground hover:text-foreground" title="PDF"><Download className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <div className="text-xs text-muted-foreground">Página {page} de {totalPages} &middot; {total} resultados</div>
            <div className="flex gap-1">
              <button disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))} className="p-2 rounded border disabled:opacity-40 hover:bg-secondary"><ChevronLeft className="w-4 h-4" /></button>
              <button disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)} className="p-2 rounded border disabled:opacity-40 hover:bg-secondary"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
