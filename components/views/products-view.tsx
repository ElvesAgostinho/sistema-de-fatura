'use client';

import { useMemo, useState } from 'react';
import { Plus, Package, Upload, Loader2, Search, X, RefreshCw, Filter, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import ProductModal from '@/components/modals/product-modal';
import CsvImportModal from '@/components/modals/csv-import-modal';
import ConfirmModal from '@/components/modals/confirm-modal';
import ExportButton from '@/components/export-button';
import { formatAOA } from '@/lib/utils';
import { toast } from 'sonner';
import { useResource, invalidateCache } from '@/lib/hooks/use-resource';
import { useProfile } from '@/lib/hooks/use-profile';

type Product = {
  id: string; name: string; description?: string | null;
  price: number; tax_rate: number;
  sku?: string | null;
  product_type?: string | null;  // P=Produto, S=Serviço, O=Outro, E=Encargos, I=Imobilizado
  track_stock?: boolean;
  quantity_in_stock?: number;
  stock_alert_threshold?: number;
  is_active?: boolean;
  created_at: string;
};

export default function ProductsView() {
  const { isAdmin } = useProfile();
  const [modal, setModal] = useState<{ open: boolean; edit: Product | null }>({ open: false, edit: null });
  const [confirm, setConfirm] = useState<Product | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [taxFilter, setTaxFilter] = useState<string>('');
  const [stockFilter, setStockFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');

  const { data, loading, validating, reload, mutate, error } = useResource<{ products: Product[] }>('/api/products', {
    ttl: 60_000,
    refreshInterval: 60_000, // Auto-update every 60s
    onError: (e: any) => toast.error(e?.message ?? 'Erro a carregar produtos'),
  });
  const all = data?.products ?? [];
  const isRefreshing = validating && !!data;

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return all.filter((p) => {
      if (s) {
        const hay = `${p.name ?? ''} ${p.description ?? ''} ${p.sku ?? ''}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      if (taxFilter !== '' && Number(p.tax_rate) !== Number(taxFilter)) return false;
      if (typeFilter !== '' && (p.product_type ?? 'P') !== typeFilter) return false;
      if (stockFilter === 'low') {
        if (!p.track_stock) return false;
        if (Number(p.quantity_in_stock ?? 0) > Number(p.stock_alert_threshold ?? 0)) return false;
      }
      if (stockFilter === 'tracked' && !p.track_stock) return false;
      return true;
    });
  }, [all, search, taxFilter, stockFilter, typeFilter]);

  const hasFilters = Boolean(search || taxFilter || stockFilter || typeFilter);
  const clearFilters = () => { setSearch(''); setTaxFilter(''); setStockFilter(''); setTypeFilter(''); };

  const lowStockCount = all.filter((p) => p.track_stock && Number(p.quantity_in_stock ?? 0) <= Number(p.stock_alert_threshold ?? 0)).length;

  const onSaved = (p: Product, mode: 'create' | 'update') => {
    mutate((prev) => {
      const list = prev?.products ?? [];
      if (mode === 'update') return { products: list.map((x) => x.id === p.id ? { ...x, ...p } : x) };
      return { products: [p, ...list] };
    });
    setModal({ open: false, edit: null });
  };

  const onDelete = async () => {
    if (!confirm) return;
    try {
      const r = await fetch(`/api/products/${confirm.id}`, { method: 'DELETE' });
      const j = await r.json();
      if (!r.ok) { toast.error(j?.error ?? 'Erro'); return; }
      if (j.archived) toast.info(j.message ?? 'Produto arquivado');
      else toast.success('Produto eliminado');
      mutate((prev) => ({ products: (prev?.products ?? []).filter((x) => x.id !== confirm.id) }));
      setConfirm(null);
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro');
    }
  };

  const exportCols = useMemo(() => ([
    { header: 'Nome', accessor: (p: Product) => p.name },
    { header: 'SKU', accessor: (p: Product) => p.sku ?? '' },
    { header: 'Tipo', accessor: (p: Product) => p.product_type ?? 'P' },
    { header: 'Descrição', accessor: (p: Product) => p.description ?? '' },
    { header: 'Preço', accessor: (p: Product) => p.price },
    { header: 'IVA %', accessor: (p: Product) => p.tax_rate },
    { header: 'Stock', accessor: (p: Product) => p.track_stock ? p.quantity_in_stock : '' },
    { header: 'Criado em', accessor: (p: Product) => p.created_at },
  ]), []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Produtos & serviços</h1>
          <p className="text-sm text-muted-foreground">Catálogo para agilizar a emissão de faturas</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <ExportButton rows={filtered} columns={exportCols} filenameBase="produtos" sheetName="Produtos" />
          <button onClick={reload} disabled={loading || validating} title="Atualizar" className="ms-btn-secondary inline-flex items-center gap-2">
            {(loading || validating) ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} 
            <span>Atualizar</span>
          </button>
          {isAdmin && (
            <button onClick={() => setImportOpen(true)} className="inline-flex items-center gap-2 px-4 h-10 rounded border border-border bg-background text-sm font-medium hover:bg-secondary">
              <Upload className="w-4 h-4" /> Importar
            </button>
          )}
          <button onClick={() => setModal({ open: true, edit: null })} className="ms-btn-primary"><Plus className="w-4 h-4" /> Novo produto</button>
        </div>
      </div>

      {lowStockCount > 0 && (
        <div className="ms-card p-3 border-l-4 border-warning bg-warning/5 flex items-center gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 text-warning" />
          <span><strong>{lowStockCount}</strong> produto(s) com stock abaixo do alerta.</span>
          <button onClick={() => setStockFilter('low')} className="ml-auto text-xs underline text-primary">Ver</button>
        </div>
      )}

      <div className="ms-card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="search" placeholder="Buscar por nome, descrição ou SKU" value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          {isRefreshing && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <select value={taxFilter} onChange={(e) => setTaxFilter(e.target.value)}
            className="h-10 pl-10 pr-8 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="">Todos IVA</option>
            <option value="0">Isento (0%)</option>
            <option value="5">5%</option>
            <option value="7">7%</option>
            <option value="14">14%</option>
          </select>
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
            className="h-10 pl-10 pr-8 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="">Todos os tipos</option>
            <option value="P">📦 Produto físico</option>
            <option value="S">🔧 Serviço</option>
            <option value="O">📋 Outro</option>
            <option value="E">💼 Encargos</option>
            <option value="I">🏗️ Imobilizado</option>
          </select>
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)}
            className="h-10 pl-10 pr-8 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="">Todo stock</option>
            <option value="tracked">Com gestão</option>
            <option value="low">Stock baixo</option>
          </select>
        </div>
        {hasFilters && (
          <button type="button" onClick={clearFilters}
            className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-md border border-input bg-background text-sm font-medium hover:bg-secondary shrink-0">
            <X className="w-4 h-4" /> Limpar
          </button>
        )}
      </div>

      {error && !data && (
        <div className="ms-card p-4 border-l-4 border-destructive bg-destructive/5 text-sm text-destructive">Erro a carregar produtos: {error.message}</div>
      )}

      <div className="ms-card overflow-hidden">
        {loading ? <div className="p-10 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div> : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <Package className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
            <div className="text-muted-foreground mb-3 font-medium">
              {hasFilters ? 'Nenhum produto corresponde aos filtros aplicados.' : 'Ainda não tem produtos cadastrados no seu catálogo.'}
            </div>
            {!hasFilters && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">Cadastre os seus produtos e serviços para agilizar a emissão de faturas e controlar o seu stock.</p>
                <button onClick={() => setModal({ open: true, edit: null })} className="ms-btn-primary mx-auto"><Plus className="w-4 h-4" />Adicionar primeiro produto</button>
              </div>
            )}
            {hasFilters && (
              <button onClick={clearFilters} className="ms-btn-primary mx-auto"><X className="w-4 h-4" /> Limpar filtros para ver todos</button>
            )}
          </div>
        ) : (
          <>
            <div className="px-4 py-2 text-xs text-muted-foreground bg-secondary/30 border-b">
              {filtered.length} de {all.length} produtos
            </div>
            <div className="flex-1 overflow-x-auto rounded-b-md border bg-card">
              <table className="w-full text-[13px]">
                <thead className="bg-muted/50 sticky top-0 backdrop-blur-sm z-10 border-b">
                  <tr className="text-left font-medium text-muted-foreground">
                    <th className="py-2.5 px-3">Nome</th>
                    <th className="py-2.5 px-3 hidden sm:table-cell">SKU</th>
                    <th className="py-2.5 px-3">Tipo <span className="text-[9px] text-primary font-normal">(SAF-T)</span></th>
                    <th className="py-2.5 px-3 text-right">Preço</th>
                    <th className="py-2.5 px-3 text-right hidden sm:table-cell">IVA</th>
                    <th className="py-2.5 px-3 text-right hidden md:table-cell">Stock</th>
                    <th className="py-2.5 px-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((p) => {
                    const lowStock = p.track_stock && Number(p.quantity_in_stock ?? 0) <= Number(p.stock_alert_threshold ?? 0);
                    return (
                      <tr key={p.id} className="hover:bg-muted/40 even:bg-muted/10 transition-colors">
                        <td className="py-2 px-3">
                          <div className="font-medium text-foreground">{p.name}</div>
                          {p.description && <div className="text-[11px] text-muted-foreground truncate max-w-[200px]">{p.description}</div>}
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px] text-muted-foreground hidden sm:table-cell">{p.sku ?? '-'}</td>
                        <td className="py-2 px-3">
                          {(() => {
                            const types: Record<string, { label: string; color: string }> = {
                              P: { label: 'Produto', color: 'bg-sky-50 text-sky-700' },
                              S: { label: 'Serviço', color: 'bg-purple-50 text-purple-700' },
                              O: { label: 'Outro',   color: 'bg-slate-100 text-slate-600' },
                              E: { label: 'Encargos',color: 'bg-amber-50 text-amber-700' },
                              I: { label: 'Imobil.', color: 'bg-green-50 text-green-700' },
                            };
                            const t = types[p.product_type ?? 'P'] ?? types['P'];
                            return <span className={`inline-flex text-[10px] font-bold px-1.5 py-0.5 rounded ${t.color}`}>{t.label}</span>;
                          })()}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-semibold">{formatAOA(p.price)}</td>
                        <td className="py-2 px-3 text-right font-mono text-[11px] hidden sm:table-cell">{Number(p.tax_rate).toFixed(2)}%</td>
                        <td className="py-2 px-3 text-right hidden md:table-cell">
                          {p.track_stock ? (
                            <span className={`inline-flex items-center gap-1 text-[11px] font-mono font-bold px-1.5 py-0.5 rounded ${lowStock ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'}`}>
                              {lowStock && <AlertTriangle className="w-3 h-3" />}
                              {Number(p.quantity_in_stock ?? 0).toFixed(0)}
                            </span>
                          ) : <span className="text-[11px] text-muted-foreground">—</span>}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => setModal({ open: true, edit: p })} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground" title="Editar">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            {isAdmin && (
                              <button onClick={() => setConfirm(p)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Eliminar">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {modal.open && <ProductModal initial={modal.edit} onClose={() => setModal({ open: false, edit: null })} onSaved={onSaved} />}

      {confirm && (
        <ConfirmModal
          title="Eliminar produto"
          message={`Tem a certeza que quer eliminar "${confirm.name}"? Se este produto estiver em alguma fatura, será arquivado (soft delete) em vez de eliminado — para preservar o histórico fiscal.`}
          confirmLabel="Eliminar"
          onConfirm={onDelete}
          onClose={() => setConfirm(null)}
        />
      )}

      {importOpen && (
        <CsvImportModal 
          type="products" 
          onClose={() => setImportOpen(false)} 
          onImported={() => {
            setImportOpen(false);
            invalidateCache('/api/products'); 
            reload();
          }} 
        />
      )}
    </div>
  );
}
