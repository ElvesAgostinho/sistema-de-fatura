'use client';

import { useState } from 'react';
import { Loader2, Check, X, ShieldCheck, Clock, XCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateTime } from '@/lib/utils';
import { useResource, invalidateCache } from '@/lib/hooks/use-resource';

type Row = {
  id: string; email: string; status: 'pending' | 'approved' | 'rejected';
  full_name: string | null; role: string; approved_at: string | null;
  rejection_reason: string | null; created_at: string;
  company: { id: string; name: string; nif: string; email: string | null; phone: string | null; address: string | null; created_at: string } | null;
  is_platform_admin: boolean;
};

const TABS: Array<{ k: 'pending' | 'approved' | 'rejected'; label: string; Icon: any; color: string }> = [
  { k: 'pending', label: 'Pendentes', Icon: Clock, color: 'text-amber-600' },
  { k: 'approved', label: 'Aprovadas', Icon: ShieldCheck, color: 'text-emerald-600' },
  { k: 'rejected', label: 'Rejeitadas', Icon: XCircle, color: 'text-destructive' },
];

export default function ApprovalsView() {
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [busy, setBusy] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState<Row | null>(null);
  const [reason, setReason] = useState('');

  const url = `/api/admin/approvals?status=${tab}`;
  const { data, loading, reload, error } = useResource<{ items: Row[] }>(url, {
    ttl: 20_000,
    onError: (e: any) => toast.error(e?.message ?? 'Erro a carregar aprovações'),
  });
  const rows = data?.items ?? [];
  const firstLoad = loading && !data;

  const approve = async (row: Row) => {
    if (!confirm(`Aprovar a conta de ${row.email} (${row.company?.name ?? 's/ empresa'})?`)) return;
    setBusy(row.id);
    try {
      const r = await fetch(`/api/admin/approvals/${row.id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j?.error ?? 'Falha'); return; }
      toast.success('Conta aprovada');
      invalidateCache('/api/admin/approvals');
      reload();
    } finally { setBusy(null); }
  };

  const confirmReject = async () => {
    if (!rejectOpen) return;
    if (reason.trim().length < 5) { toast.error('Motivo obrigatório (mín 5 caracteres)'); return; }
    setBusy(rejectOpen.id);
    try {
      const r = await fetch(`/api/admin/approvals/${rejectOpen.id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', reason: reason.trim() }),
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j?.error ?? 'Falha'); return; }
      toast.success('Conta rejeitada');
      setRejectOpen(null); setReason('');
      invalidateCache('/api/admin/approvals');
      reload();
    } finally { setBusy(null); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Aprovação de contas</h1>
          <p className="text-sm text-muted-foreground">Gere novos pedidos de registo na plataforma.</p>
        </div>
        <button onClick={reload} disabled={loading} className="px-3 py-2 rounded border text-sm font-medium hover:bg-secondary inline-flex items-center gap-2 disabled:opacity-60">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Actualizar
        </button>
      </div>

      <div className="flex gap-1 border-b border-border">
        {TABS.map(t => {
          const Icon = t.Icon;
          const active = tab === t.k;
          return (
            <button
              key={t.k}
              onClick={() => { if (!active) setTab(t.k); }}
              aria-pressed={active}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              <Icon className={`w-4 h-4 ${active ? '' : t.color}`} /> {t.label}
            </button>
          );
        })}
      </div>

      {error && !data && (
        <div className="ms-card p-4 border-l-4 border-destructive bg-destructive/5 text-sm text-destructive">Erro: {error.message}</div>
      )}

      {firstLoad ? (
        <div className="flex items-center justify-center p-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <div className="ms-card p-12 text-center text-sm text-muted-foreground">
          Nenhuma conta {tab === 'pending' ? 'pendente' : tab === 'approved' ? 'aprovada' : 'rejeitada'}.
        </div>
      ) : (
        <div className={`space-y-3 transition-opacity ${loading ? 'opacity-70' : ''}`}>
          {rows.map(row => (
            <div key={row.id} className="ms-card p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold truncate">{row.company?.name ?? '(empresa removida)'}</h3>
                    {row.is_platform_admin && <span className="text-[11px] px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">Platform admin</span>}
                    {tab === 'approved' && <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">Aprovada</span>}
                    {tab === 'rejected' && <span className="text-[11px] px-2 py-0.5 rounded bg-destructive/10 text-destructive">Rejeitada</span>}
                  </div>
                  <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 mt-2 text-sm">
                    <div><span className="text-muted-foreground">Responsável:</span> {row.full_name ?? '—'}</div>
                    <div><span className="text-muted-foreground">Email:</span> <span className="font-mono">{row.email}</span></div>
                    <div><span className="text-muted-foreground">NIF:</span> <span className="font-mono">{row.company?.nif ?? '—'}</span></div>
                    <div><span className="text-muted-foreground">Tel:</span> {row.company?.phone ?? '—'}</div>
                    {row.company?.address && <div className="sm:col-span-2"><span className="text-muted-foreground">Endereço:</span> {row.company.address}</div>}
                    <div><span className="text-muted-foreground">Pedido em:</span> {formatDateTime(row.created_at)}</div>
                    {row.approved_at && <div><span className="text-muted-foreground">Aprovada em:</span> {formatDateTime(row.approved_at)}</div>}
                  </div>
                  {row.rejection_reason && (
                    <div className="mt-2 text-xs p-2 rounded bg-destructive/5 border border-destructive/20 text-destructive">
                      <strong>Motivo:</strong> {row.rejection_reason}
                    </div>
                  )}
                </div>
                {!row.is_platform_admin && (
                  <div className="flex gap-2 shrink-0">
                    {tab !== 'approved' && (
                      <button onClick={() => approve(row)} disabled={busy === row.id}
                        className="px-3 py-2 rounded text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center gap-1.5 disabled:opacity-60">
                        {busy === row.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Aprovar
                      </button>
                    )}
                    {tab !== 'rejected' && (
                      <button onClick={() => { setRejectOpen(row); setReason(''); }} disabled={busy === row.id}
                        className="px-3 py-2 rounded text-sm font-medium bg-destructive/10 hover:bg-destructive/20 text-destructive inline-flex items-center gap-1.5 disabled:opacity-60">
                        <X className="w-4 h-4" /> Rejeitar
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {rejectOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setRejectOpen(null)}>
          <div className="ms-card p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-lg">Rejeitar conta</h3>
            <p className="text-sm text-muted-foreground">
              Vai rejeitar a conta de <strong>{rejectOpen.email}</strong> ({rejectOpen.company?.name}).
              O utilizador verá o motivo indicado abaixo.
            </p>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Motivo *</label>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder="Ex.: NIF não verificável, empresa duplicada, informações incompletas..."
                rows={3} className="w-full px-3 py-2 rounded border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setRejectOpen(null)} className="px-4 py-2 rounded text-sm hover:bg-secondary">Cancelar</button>
              <button onClick={confirmReject} disabled={busy === rejectOpen.id}
                className="px-4 py-2 rounded text-sm font-medium bg-destructive text-destructive-foreground hover:opacity-90 disabled:opacity-60 inline-flex items-center gap-2">
                {busy === rejectOpen.id && <Loader2 className="w-4 h-4 animate-spin" />}
                Rejeitar conta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
