'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Plug,
  Loader2,
  Save,
  Wand2,
  RefreshCw,
  Trash2,
  CheckCircle2,
  XCircle,
  Users,
  Package,
  FileText,
  Activity,
} from 'lucide-react';

type Integration = {
  id: string;
  provider: string;
  base_url: string | null;
  username: string | null;
  db_name: string | null;
  status: string;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  config: Record<string, any>;
  created_at: string;
  updated_at: string;
};

type LogEntry = {
  id: string;
  direction: string;
  entity: string;
  status: string;
  message: string | null;
  created_at: string;
};

function fmtDate(v: string | null) {
  if (!v) return '—';
  try { return new Date(v).toLocaleString('pt-PT'); } catch { return '—'; }
}

export default function ErpIntegrationPanel() {
  const [loading, setLoading] = useState(true);
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [form, setForm] = useState({
    provider: 'odoo',
    base_url: '',
    db_name: '',
    username: '',
    api_key: '',
    status: 'active',
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch('/api/erp', { cache: 'no-store' });
      const j = await r.json();
      if (r.ok) {
        const odoo = (j.integrations || []).find((i: any) => i.provider === 'odoo') ?? null;
        setIntegration(odoo);
        if (odoo) {
          setForm({
            provider: 'odoo',
            base_url: odoo.base_url || '',
            db_name: odoo.db_name || '',
            username: odoo.username || '',
            api_key: '',
            status: odoo.status || 'active',
          });
        }
      }
      const rl = await fetch('/api/erp/logs?limit=20', { cache: 'no-store' });
      const jl = await rl.json();
      if (rl.ok) setLogs(jl.logs || []);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true);
    try {
      const body: any = { ...form };
      if (!body.api_key) delete body.api_key;
      const r = await fetch('/api/erp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j?.error || 'Erro ao guardar'); return; }
      toast.success('Integração guardada');
      setForm((p) => ({ ...p, api_key: '' }));
      await load();
    } finally { setSaving(false); }
  }

  async function testConnection() {
    setTesting(true);
    try {
      const body: any = { ...form };
      if (!body.api_key) delete body.api_key;
      const r = await fetch('/api/erp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (j.ok) {
        toast.success(`Conexão OK — Odoo v${j.version} (uid ${j.uid})`);
      } else {
        toast.error(j.error || 'Falha na conexão');
      }
    } finally { setTesting(false); }
  }

  async function sync(entity: 'clients' | 'products' | 'invoices' | 'all') {
    if (!integration) return;
    setSyncing(entity);
    try {
      const r = await fetch('/api/erp/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ integration_id: integration.id, entity }),
      });
      const j = await r.json();
      if (j.ok) {
        const summary = Object.entries(j.results || {})
          .map(([k, v]: any) => `${k}: ${v.created} novos, ${v.updated} atualizados`)
          .join(' · ');
        toast.success(`Sincronização concluída — ${summary}`);
      } else {
        toast.error(j.error || (j.errors?.[0] ?? 'Erros durante a sincronização'));
      }
      await load();
    } finally { setSyncing(null); }
  }

  async function remove() {
    if (!integration) return;
    if (!confirm('Remover a integração Odoo? Os dados já sincronizados não serão apagados do Odoo.')) return;
    const r = await fetch(`/api/erp?id=${integration.id}`, { method: 'DELETE' });
    const j = await r.json();
    if (!r.ok) { toast.error(j?.error || 'Erro'); return; }
    toast.success('Integração removida');
    setIntegration(null);
    setForm({ provider: 'odoo', base_url: '', db_name: '', username: '', api_key: '', status: 'active' });
    await load();
  }

  if (loading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Credentials */}
      <div className="ms-card p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold flex items-center gap-2"><Plug className="w-4 h-4 text-primary" /> Odoo — Credenciais</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Conecte o Top Fatura ao seu Odoo (on-premise ou SaaS). Use uma{' '}
              <span className="font-medium">API Key</span> em vez da password — gere em Odoo &rarr;
              <span className="font-mono"> Preferências &rarr; Account Security</span>.
            </p>
          </div>
          {integration && (
            <span className={`text-xs px-2 py-1 rounded font-medium ${
              integration.last_sync_status === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
              integration.last_sync_status === 'partial' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
              integration.last_sync_status === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
              'bg-secondary text-muted-foreground border'
            }`}>
              {integration.last_sync_status === 'success' && <CheckCircle2 className="w-3 h-3 inline mr-1" />}
              {integration.last_sync_status === 'error' && <XCircle className="w-3 h-3 inline mr-1" />}
              Último sync: {fmtDate(integration.last_sync_at)}
            </span>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="text-xs text-muted-foreground mb-1 block">URL base do Odoo *</label>
            <input
              placeholder="https://meudominio.odoo.com"
              value={form.base_url}
              onChange={(e) => setForm((p) => ({ ...p, base_url: e.target.value }))}
              className="w-full h-10 px-3 rounded border border-input bg-background text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Nome da base de dados *</label>
            <input
              placeholder="ex: minhaempresa"
              value={form.db_name}
              onChange={(e) => setForm((p) => ({ ...p, db_name: e.target.value }))}
              className="w-full h-10 px-3 rounded border border-input bg-background text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Utilizador (email) *</label>
            <input
              placeholder="admin@minhaempresa.com"
              value={form.username}
              onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
              className="w-full h-10 px-3 rounded border border-input bg-background text-sm"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-muted-foreground mb-1 block">
              API Key {integration && <span className="text-muted-foreground">— deixar em branco para manter a atual</span>}{!integration && ' *'}
            </label>
            <input
              type="password"
              placeholder={integration ? '•••••••• (não alterada)' : 'Cole aqui a API key do Odoo'}
              value={form.api_key}
              onChange={(e) => setForm((p) => ({ ...p, api_key: e.target.value }))}
              className="w-full h-10 px-3 rounded border border-input bg-background text-sm font-mono"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={save}
            disabled={saving || !form.base_url || !form.db_name || !form.username}
            className="ms-btn-primary disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar
          </button>
          <button
            onClick={testConnection}
            disabled={testing || !form.base_url || !form.db_name || !form.username || (!form.api_key && !integration)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded border text-sm font-medium hover:bg-secondary disabled:opacity-60"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            Testar conexão
          </button>
          {integration && (
            <button
              onClick={remove}
              className="inline-flex items-center gap-2 px-4 py-2 rounded border border-red-200 text-red-700 text-sm font-medium hover:bg-red-50 ml-auto"
            >
              <Trash2 className="w-4 h-4" /> Remover
            </button>
          )}
        </div>
      </div>

      {/* Sync actions */}
      {integration && (
        <div className="ms-card p-6 space-y-4">
          <h3 className="font-semibold flex items-center gap-2"><RefreshCw className="w-4 h-4 text-primary" /> Sincronização manual</h3>
          <p className="text-xs text-muted-foreground">
            O envio é sempre em sentido único: Top Fatura &rarr; Odoo. As faturas são criadas como <span className="font-medium">rascunhos</span> para revisão no Odoo.
          </p>
          <div className="grid md:grid-cols-4 gap-3">
            <button
              onClick={() => sync('clients')}
              disabled={!!syncing}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded border text-sm font-medium hover:bg-secondary disabled:opacity-60"
            >
              {syncing === 'clients' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
              Clientes
            </button>
            <button
              onClick={() => sync('products')}
              disabled={!!syncing}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded border text-sm font-medium hover:bg-secondary disabled:opacity-60"
            >
              {syncing === 'products' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
              Produtos
            </button>
            <button
              onClick={() => sync('invoices')}
              disabled={!!syncing}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded border text-sm font-medium hover:bg-secondary disabled:opacity-60"
            >
              {syncing === 'invoices' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Faturas emitidas
            </button>
            <button
              onClick={() => sync('all')}
              disabled={!!syncing}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
            >
              {syncing === 'all' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Sincronizar tudo
            </button>
          </div>
          {integration.last_sync_error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
              Último erro: {integration.last_sync_error}
            </div>
          )}
        </div>
      )}

      {/* Logs */}
      <div className="ms-card p-6">
        <h3 className="font-semibold flex items-center gap-2 mb-4"><Activity className="w-4 h-4 text-primary" /> Histórico de sincronizações</h3>
        {logs.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">Sem registos ainda.</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left py-2 font-medium">Quando</th>
                  <th className="text-left py-2 font-medium">Entidade</th>
                  <th className="text-left py-2 font-medium">Estado</th>
                  <th className="text-left py-2 font-medium">Mensagem</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b last:border-0">
                    <td className="py-2 text-xs">{fmtDate(l.created_at)}</td>
                    <td className="py-2">{l.entity}</td>
                    <td className="py-2">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                        l.status === 'success' ? 'bg-green-50 text-green-700' :
                        l.status === 'partial' ? 'bg-amber-50 text-amber-700' :
                        'bg-red-50 text-red-700'
                      }`}>{l.status}</span>
                    </td>
                    <td className="py-2 text-xs text-muted-foreground max-w-xs truncate">{l.message || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
