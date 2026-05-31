'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Users, MoreHorizontal, Edit, Trash2, Phone, Mail, MapPin, X, Loader2, Download, FileText, Filter, RefreshCw, Eye, Upload } from 'lucide-react';
import { useResource, invalidateCache } from '@/lib/hooks/use-resource';
import { useDebounced } from '@/lib/hooks/use-debounced';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import ExportButton from '@/components/export-button';
import CsvImportModal from '@/components/modals/csv-import-modal';

type Client = {
  id: string;
  name: string;
  nif: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  is_active: boolean;
  created_at: string;
};

export default function ClientsView() {
  const [modal, setModal] = useState<{ open: boolean; edit: Client | null }>({ open: false, edit: null });
  const [showImport, setShowImport] = useState(false);
  const [search, setSearch] = useState('');
  const [confirm, setConfirm] = useState<Client | null>(null);

  const debounced = useDebounced(search.trim(), 300);
  const url = debounced ? `/api/clients?search=${encodeURIComponent(debounced)}` : '/api/clients';

  const { data, loading, reload, mutate, error } = useResource<{ clients: Client[] }>(url, {
    ttl: 60_000,
    onError: (e: any) => toast.error(e?.message ?? 'Erro ao carregar clientes'),
  });
  
  const clients = data?.clients ?? [];
  const showEmpty = !loading && clients.length === 0;

  const onSaved = (c: Client, mode: 'create' | 'update') => {
    invalidateCache('/api/clients');
    mutate((prev) => {
      const list = prev?.clients ?? [];
      if (mode === 'update') return { clients: list.map((x) => x.id === c.id ? { ...x, ...c } : x) };
      return { clients: [c, ...list] };
    });
    setModal({ open: false, edit: null });
  };

  const deleteClient = async (id: string) => {
    try {
      const r = await fetch(`/api/clients/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('Falha ao eliminar');
      mutate((prev) => ({ clients: (prev?.clients ?? []).filter((x) => x.id !== id) }));
      toast.success('Cliente eliminado');
      setConfirm(null);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">Gerencie a base de dados dos seus clientes</p>
        </div>
        <div className="flex gap-2">
          <ExportButton rows={clients} columns={[
            { header: 'Nome', accessor: (c: Client) => c.name },
            { header: 'NIF', accessor: (c: Client) => c.nif },
            { header: 'Email', accessor: (c: Client) => c.email ?? '' },
            { header: 'Telefone', accessor: (c: Client) => c.phone ?? '' },
          ]} filenameBase="clientes" sheetName="Clientes" />
          <button onClick={() => setShowImport(true)} className="ms-btn-secondary inline-flex items-center gap-2" title="Importar via CSV"><Upload className="w-4 h-4" /> <span className="hidden sm:inline">Importar</span></button>
          <button onClick={reload} disabled={loading} className="ms-btn-secondary inline-flex items-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} 
            <span>Atualizar</span>
          </button>
          <button onClick={() => setModal({ open: true, edit: null })} className="ms-btn-primary"><Plus className="w-4 h-4" /> Novo Cliente</button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input placeholder="Buscar por nome, NIF ou email..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-10 pl-10 pr-10 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
      </div>

      {error && !data && (
        <div className="ms-card p-4 border-l-4 border-destructive bg-destructive/5 text-sm text-destructive">Erro a carregar clientes: {error.message}</div>
      )}

      <div className="ms-card overflow-hidden">
        {loading && !data ? (
          <div className="p-10 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
        ) : showEmpty ? (
          <div className="p-10 text-center text-muted-foreground">Nenhum cliente encontrado</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60">
                <tr className="text-left text-xs uppercase text-muted-foreground">
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">NIF</th>
                  <th className="py-3 px-4">Contato</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id} className="border-t hover:bg-secondary/40 transition-colors">
                    <td className="py-3 px-4">
                      <Link href={`/clients/${c.id}`} className="font-medium text-primary hover:underline">{c.name}</Link>
                      <div className="text-xs text-muted-foreground">{c.address || 'Sem morada'}</div>
                    </td>
                    <td className="py-3 px-4 font-mono">{c.nif}</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1">
                        {c.email && <div className="flex items-center gap-1.5 text-xs"><Mail className="w-3 h-3" /> {c.email}</div>}
                        {c.phone && <div className="flex items-center gap-1.5 text-xs"><Phone className="w-3 h-3" /> {c.phone}</div>}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${c.is_active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                        {c.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link href={`/clients/${c.id}`} className="p-2 inline-flex hover:bg-secondary rounded-md text-muted-foreground hover:text-foreground mr-1" title="Ver conta corrente">
                        <Eye className="w-4 h-4" />
                      </Link>
                      <button onClick={() => setModal({ open: true, edit: c })} className="p-2 hover:bg-secondary rounded-md text-muted-foreground hover:text-foreground"><Edit className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showImport && (
        <CsvImportModal 
          type="clients" 
          onClose={() => setShowImport(false)} 
          onImported={() => {
            setShowImport(false);
            reload();
          }} 
        />
      )}
    </div>
  );
}
