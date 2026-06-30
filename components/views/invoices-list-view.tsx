'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Plus, FileText, Download, XCircle, CheckCircle2, ChevronLeft, ChevronRight, Filter, Loader2, RefreshCw, Calendar, X, Ban } from 'lucide-react';
import { formatAOA, formatDateTime } from '@/lib/utils';
import { toast } from 'sonner';
import { useResource } from '@/lib/hooks/use-resource';
import { useDebounced } from '@/lib/hooks/use-debounced';
import { useProfile } from '@/lib/hooks/use-profile';
import ExportButton from '@/components/export-button';

type Invoice = {
  id: string; invoice_number: string; document_type: string;
  total: number; status: string; issued_at: string;
  payment_status?: string; amount_paid?: number;
  agt_status?: string;
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

  const { isAdmin } = useProfile();
  const [cancelData, setCancelData] = useState<{ id: string, number: string } | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

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

  const submitCancel = async () => {
    if (!cancelData) return;
    if (cancelReason.trim().length < 5) { toast.error('Motivo obrigatório (min 5 chars)'); return; }
    
    setCancelling(true);
    try {
      const r = await fetch(`/api/invoices/${cancelData.id}/cancel`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ reason: cancelReason }) 
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j?.error ?? 'Falha ao anular'); return; }
      toast.success('Fatura anulada com sucesso!');
      setCancelData(null);
      setCancelReason('');
      reload();
    } catch { 
      toast.error('Erro ao comunicar com o servidor'); 
    } finally { 
      setCancelling(false); 
    }
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
          <p className="text-sm text-muted-foreground">Consulte, filtre e anule as faturas emitidas</p>
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

      <div className="ms-card p-4 space-y-3 border-l-4 border-l-primary">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
            <input type="search" placeholder="Filtro rápido: Escreva o número (ex: FR 2026/3) ou o nome do cliente..." value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full h-11 pl-10 pr-10 rounded-md border-2 border-primary/20 bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all" />
            {isRefreshing && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <select value={docType} onChange={(e) => { setDocType(e.target.value); setPage(1); }}
              className="h-11 pl-10 pr-8 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="">Todos tipos</option>
              <option value="FT">FT — Fatura</option>
              <option value="FR">FR — Fatura-Recibo</option>
              <option value="NC">NC — Nota de Crédito</option>
              <option value="ND">ND — Nota de Débito</option>
              <option value="RC">RC — Recibo</option>
              <option value="PP">PP — Pró-forma</option>
              <option value="OR">OR — Orçamento</option>
              <option value="GT">GT — Guia de Transporte</option>
            </select>
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="h-11 pl-10 pr-8 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary">
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
        <div className="flex-1 overflow-x-auto rounded-md border bg-card">
          <table className="w-full text-[13px]">
            <thead className="bg-muted/50 sticky top-0 backdrop-blur-sm z-10 border-b">
              <tr className="text-left font-medium text-muted-foreground">
                <th className="py-2.5 px-3">Número</th>
                <th className="py-2.5 px-3">Cliente</th>
                <th className="py-2.5 px-3 hidden sm:table-cell">Data</th>
                <th className="py-2.5 px-3">Total</th>
                <th className="py-2.5 px-3 hidden md:table-cell">Em Dívida</th>
                <th className="py-2.5 px-3">Estado</th>
                <th className="py-2.5 px-3">AGT</th>
                <th className="py-2.5 px-3 hidden sm:table-cell">Pagamento</th>
                <th className="py-2.5 px-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading || validating ? (
                <tr><td colSpan={8} className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground mx-auto" /></td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={8} className="py-10 text-center text-muted-foreground">Nenhuma fatura encontrada. Tente ajustar os filtros.</td></tr>
              ) : (
                invoices.map((inv) => {
                  const clientName = inv.client?.name || 'Consumidor Final';
                  const debt = inv.total - (inv.amount_paid ?? 0);
                  const isCancelled = inv.status === 'cancelled';
                  return (
                    <tr key={inv.id} className="hover:bg-muted/40 even:bg-muted/10 transition-colors">
                      <td className="py-2 px-3">
                        <Link href={`/invoices/${inv.id}`} className="font-mono font-medium text-primary hover:underline text-xs sm:text-sm">
                          {inv.invoice_number}
                        </Link>
                      </td>
                      <td className="py-2 px-3 font-medium max-w-[120px] truncate">{clientName}</td>
                      <td className="py-2 px-3 text-muted-foreground hidden sm:table-cell">{formatDateTime(inv.issued_at)}</td>
                      <td className="py-2 px-3 font-mono text-xs sm:text-sm">{formatAOA(inv.total)}</td>
                      <td className="py-2 px-3 font-mono hidden md:table-cell">
                        {!['PP', 'OR', 'GT'].includes(inv.document_type) ? (
                          !isCancelled && debt > 0 ? <span className="text-warning font-medium">{formatAOA(debt)}</span> : !isCancelled ? <span className="text-success">0,00</span> : <span className="text-muted-foreground">-</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        {isCancelled ? <span className="inline-flex text-[10px] uppercase font-bold bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">Cancelada</span> : <span className="inline-flex text-[10px] uppercase font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded">Emitida</span>}
                      </td>
                      <td className="py-2 px-3">
                        {inv.agt_status === 'SYNCED' ? <span className="flex items-center gap-1 text-success text-[10px] font-bold uppercase"><CheckCircle2 className="w-3 h-3" /> Integrado</span> :
                         inv.agt_status === 'FAILED' ? <span className="flex items-center gap-1 text-destructive text-[10px] font-bold uppercase"><XCircle className="w-3 h-3" /> Falhou</span> :
                         inv.agt_status === 'SYNCING' ? <span className="flex items-center gap-1 text-warning text-[10px] font-bold uppercase"><Loader2 className="w-3 h-3 animate-spin" /> A Enviar</span> :
                         <span className="flex items-center gap-1 text-muted-foreground text-[10px] font-bold uppercase">Pendente</span>}
                      </td>
                      <td className="py-2 px-3 hidden sm:table-cell">
                        {!['PP', 'OR', 'GT'].includes(inv.document_type) ? (
                          isCancelled ? <span className="text-muted-foreground">-</span> : inv.payment_status === 'pago' ? <span className="inline-flex text-[10px] uppercase font-bold bg-success/10 text-success px-1.5 py-0.5 rounded">Pago</span> : inv.payment_status === 'parcial' ? <span className="inline-flex text-[10px] uppercase font-bold bg-warning/10 text-warning px-1.5 py-0.5 rounded">Parcial</span> : <span className="inline-flex text-[10px] uppercase font-bold bg-secondary text-muted-foreground px-1.5 py-0.5 rounded">Pendente</span>
                        ) : (
                          <span className="inline-flex text-[10px] uppercase font-bold bg-secondary/50 text-muted-foreground px-1.5 py-0.5 rounded border border-border">N/A</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/invoices/${inv.id}`} className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Ver fatura"><FileText className="w-4 h-4" /></Link>
                          <button onClick={() => onDownloadPdf(inv.id, inv.invoice_number.replace(/[^a-zA-Z0-9]/g, '_'))} className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Descarregar PDF"><Download className="w-4 h-4" /></button>
                          {!isCancelled && isAdmin && (
                            <button onClick={() => setCancelData({ id: inv.id, number: inv.invoice_number })} className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Anular Fatura">
                              <Ban className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <div className="text-xs text-muted-foreground">Página {page} de {totalPages} &middot; {total} resultados</div>
            <div className="flex gap-1">
              <button disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))} className="w-11 h-11 rounded-lg border flex items-center justify-center disabled:opacity-40 hover:bg-secondary transition-colors active:scale-95"><ChevronLeft className="w-4 h-4" /></button>
              <button disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)} className="w-11 h-11 rounded-lg border flex items-center justify-center disabled:opacity-40 hover:bg-secondary transition-colors active:scale-95"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>

      {cancelData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold flex items-center gap-2"><Ban className="w-5 h-5 text-destructive" /> Anular Fatura</h2>
              <button onClick={() => setCancelData(null)} className="p-1 hover:bg-secondary rounded-full"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm font-medium mb-1">Fatura: {cancelData.number}</p>
            <p className="text-sm text-muted-foreground mb-4">A fatura continuará a constar no ficheiro SAF-T (exigência AGT), mas ficará com o estado "Cancelada". Esta acção é irreversível.</p>
            <div className="mb-4">
              <label className="text-xs font-semibold mb-1 block uppercase text-muted-foreground">Motivo de Anulação</label>
              <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Ex: Erro nos dados do cliente..." rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"></textarea>
            </div>
            <div className="flex justify-end gap-2">
              <button disabled={cancelling} onClick={() => setCancelData(null)} className="px-4 py-2 rounded-md text-sm font-medium border bg-background hover:bg-secondary">Voltar</button>
              <button disabled={cancelling} onClick={submitCancel} className="px-4 py-2 rounded-md text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 inline-flex items-center gap-2">
                {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />} Confirmar Anulação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
