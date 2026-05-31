'use client';

import { useMemo, useState } from 'react';
import { Plus, Search, Users, Loader2, X, RefreshCw, Pencil, Trash2 } from 'lucide-react';
import SupplierModal from '@/components/modals/supplier-modal';
import ConfirmModal from '@/components/modals/confirm-modal';
import ExportButton from '@/components/export-button';
import { toast } from 'sonner';
import { useResource, invalidateCache } from '@/lib/hooks/use-resource';
import { useDebounced } from '@/lib/hooks/use-debounced';
import { useProfile } from '@/lib/hooks/use-profile';

type Supplier = { id: string; name: string; nif: string; address?: string; phone?: string; email?: string; created_at: string };

export default function SuppliersView() {
  const { isAdmin } = useProfile();
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{ open: boolean; edit: Supplier | null }>({ open: false, edit: null });
  const [confirm, setConfirm] = useState<Supplier | null>(null);

  const debounced = useDebounced(search.trim(), 300);
  const url = debounced ? `/api/suppliers?search=${encodeURIComponent(debounced)}` : '/api/suppliers';

  const { data, loading, validating, reload, error, mutate } = useResource<{ suppliers: Supplier[] }>(url, {
    ttl: 60_000,
    onError: (e: any) => toast.error(e?.message ?? 'Erro a carregar fornecedores'),
  });
  const suppliers = data?.suppliers ?? [];
  const firstLoad = loading && !data;

  const onSaved = (s: Supplier, mode: 'create' | 'update') => {
    invalidateCache('/api/suppliers');
    mutate((prev) => {
      const list = prev?.suppliers ?? [];
      if (mode === 'update') return { suppliers: list.map((x) => x.id === s.id ? { ...x, ...s } : x) };
      return { suppliers: [s, ...list] };
    });
    setModal({ open: false, edit: null });
  };

  const onDelete = async () => {
    if (!confirm) return;
    try {
      const r = await fetch(`/api/suppliers/${confirm.id}`, { method: 'DELETE' });
      if (!r.ok) { 
        const j = await r.json();
        toast.error(j?.error ?? 'Erro ao eliminar'); 
        return; 
      }
      toast.success('Fornecedor eliminado');
      invalidateCache('/api/suppliers');
      mutate((prev) => ({ suppliers: (prev?.suppliers ?? []).filter((x) => x.id !== confirm.id) }));
      setConfirm(null);
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro');
    }
  };

  const exportCols = useMemo(() => ([
    { header: 'Nome', accessor: (s: Supplier) => s.name },
    { header: 'NIF', accessor: (s: Supplier) => s.nif },
    { header: 'Telefone', accessor: (s: Supplier) => s.phone ?? '' },
    { header: 'Email', accessor: (s: Supplier) => s.email ?? '' },
    { header: 'Endereço', accessor: (s: Supplier) => s.address ?? '' },
    { header: 'Criado em', accessor: (s: Supplier) => s.created_at },
  ]), []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fornecedores</h1>
          <p className="text-sm text-muted-foreground">Base de fornecedores da sua empresa</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <ExportButton rows={suppliers} columns={exportCols} filenameBase="fornecedores" sheetName="Fornecedores" />
          <button onClick={reload} disabled={loading || validating} title="Atualizar" className="ms-btn-secondary inline-flex items-center gap-2">
            {(loading || validating) ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} 
            <span>Atualizar</span>
          </button>
          <button onClick={() => setModal({ open: true, edit: null })} className="ms-btn-primary"><Plus className="w-4 h-4" /> Novo fornecedor</button>
        </div>
      </div>

      <div className="ms-card p-4 flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input placeholder="Buscar por nome, NIF ou email..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-10 pl-10 pr-10 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          {loading && !firstLoad && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
        </div>
        {search && (
          <button type="button" onClick={() => setSearch('')}
            className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md border border-input bg-background text-sm font-medium hover:bg-secondary shrink-0">
            <X className="w-4 h-4" /> Limpar
          </button>
        )}
      </div>

      <div className="ms-card overflow-hidden">
        {firstLoad ? <div className="p-10 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div> : suppliers.length === 0 ? (
          <div className="p-10 text-center">
            <Users className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
            <div className="text-muted-foreground mb-3">{debounced ? `Nenhum fornecedor encontrado para "${debounced}"` : 'Nenhum fornecedor'}</div>
            {!debounced && <button onClick={() => setModal({ open: true, edit: null })} className="ms-btn-primary"><Plus className="w-4 h-4" />Adicionar primeiro fornecedor</button>}
          </div>
        ) : (
          <>
            <div className="px-4 py-2 text-xs text-muted-foreground bg-secondary/30 border-b">
              {suppliers.length} {suppliers.length === 1 ? 'fornecedor' : 'fornecedores'}{debounced ? ` para "${debounced}"` : ''}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/60">
                  <tr className="text-left text-xs uppercase text-muted-foreground">
                    <th className="py-3 px-4">Nome</th><th className="py-3 px-4">NIF</th>
                    <th className="py-3 px-4">Telefone</th><th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((s) => (
                    <tr key={s.id} className="border-t hover:bg-secondary/40">
                      <td className="py-3 px-4 font-medium">{s.name}</td>
                      <td className="py-3 px-4 font-mono text-xs">{s.nif}</td>
                      <td className="py-3 px-4 text-muted-foreground">{s.phone ?? '-'}</td>
                      <td className="py-3 px-4 text-muted-foreground">{s.email ?? '-'}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex gap-1">
                          <button onClick={() => setModal({ open: true, edit: s })} className="p-2 rounded hover:bg-secondary text-muted-foreground hover:text-foreground" title="Editar">
                            <Pencil className="w-4 h-4" />
                          </button>
                          {isAdmin && (
                            <button onClick={() => setConfirm(s)} className="p-2 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Eliminar">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {modal.open && <SupplierModal initial={modal.edit} onClose={() => setModal({ open: false, edit: null })} onSaved={onSaved} />}

      {confirm && (
        <ConfirmModal
          title="Eliminar fornecedor"
          message={`Tem a certeza que quer eliminar "${confirm.name}"?`}
          confirmLabel="Eliminar"
          onConfirm={onDelete}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
