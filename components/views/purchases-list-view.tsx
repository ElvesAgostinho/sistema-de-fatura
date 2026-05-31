'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, FileText, Loader2, X, RefreshCw, Filter, Calendar, Eye, Paperclip, ExternalLink } from 'lucide-react';
import { formatAOA, formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { useResource } from '@/lib/hooks/use-resource';
import { useDebounced } from '@/lib/hooks/use-debounced';
import { createClient } from '@/lib/supabase/client';

type Purchase = { 
  id: string; 
  purchase_number: string; 
  total: number; 
  status: string; 
  issued_at: string; 
  attachment_path?: string | null;
  supplier: { name: string; nif: string } 
};

export default function PurchasesListView() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debounced = useDebounced(search.trim(), 300);

  const url = `/api/purchases?page=${page}&search=${encodeURIComponent(debounced)}`;
  const { data, loading, validating, reload, error } = useResource<{ purchases: Purchase[]; total: number }>(url, {
    ttl: 60_000,
    refreshInterval: 60_000, // Auto-update every 1m
    onError: (e: any) => toast.error(e?.message ?? 'Erro ao carregar compras'),
  });

  const purchases = data?.purchases ?? [];
  const isRefreshing = validating && !!data;

  const viewAttachment = async (path: string) => {
    const supabase = createClient();
    const { data } = await supabase.storage.from('purchases').getPublicUrl(path);
    if (data?.publicUrl) {
      window.open(data.publicUrl, '_blank');
    } else {
      toast.error('Erro ao obter link do ficheiro');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Compras</h1>
          <p className="text-muted-foreground">Histórico de faturas e custos de fornecedores</p>
        </div>
        <div className="flex gap-2">
          <button onClick={reload} disabled={loading || validating} title="Atualizar" className="inline-flex items-center gap-2 px-3 h-10 rounded border border-border bg-background text-sm font-medium hover:bg-secondary disabled:opacity-60">
            {(loading || validating) ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Atualizar
          </button>
          <Link href="/purchases/new" className="ms-btn-primary h-11 px-6"><Plus className="w-4 h-4" /> Registar Compra</Link>
        </div>
      </div>

      <div className="ms-card p-4 flex flex-col md:flex-row gap-4 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input 
            placeholder="Buscar por nº de fatura..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            className="w-full h-11 pl-10 pr-10 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" 
          />
          {isRefreshing && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      <div className="ms-card overflow-hidden shadow-sm">
        {loading ? <div className="p-20 text-center text-muted-foreground"><Loader2 className="w-8 h-8 animate-spin mx-auto opacity-20" /></div> : purchases.length === 0 ? (
          <div className="p-20 text-center">
            <FileText className="w-16 h-16 mx-auto text-muted-foreground/20 mb-4" />
            <div className="text-lg font-medium text-muted-foreground mb-4">{debounced ? `Nenhuma compra encontrada para "${debounced}"` : 'Nenhuma compra registada'}</div>
            {!debounced && <Link href="/purchases/new" className="ms-btn-primary inline-flex items-center gap-2 px-8 h-12"><Plus className="w-5 h-5" />Registar primeira compra</Link>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-widest text-muted-foreground border-b bg-secondary/10">
                  <th className="py-4 px-6 font-bold">Data</th>
                  <th className="py-4 px-6 font-bold">Nº Fatura</th>
                  <th className="py-4 px-6 font-bold">Fornecedor</th>
                  <th className="py-4 px-6 font-bold">Total</th>
                  <th className="py-4 px-6 font-bold">Anexo</th>
                  <th className="py-4 px-6 font-bold">Estado</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {purchases.map((p) => (
                  <tr key={p.id} className="hover:bg-secondary/20 transition-colors group">
                    <td className="py-4 px-6 font-mono text-[11px] text-muted-foreground whitespace-nowrap">{formatDate(p.issued_at)}</td>
                    <td className="py-4 px-6 font-bold text-foreground">{p.purchase_number}</td>
                    <td className="py-4 px-6">
                      <div className="font-bold text-foreground">{p.supplier?.name}</div>
                      <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-tighter">{p.supplier?.nif}</div>
                    </td>
                    <td className="py-4 px-6 font-mono font-black text-primary">{formatAOA(p.total)}</td>
                    <td className="py-4 px-6">
                      {p.attachment_path ? (
                        <button 
                          onClick={() => viewAttachment(p.attachment_path!)}
                          className="flex items-center gap-2 px-2 py-1 rounded bg-sky-50 text-sky-700 hover:bg-sky-100 transition-all border border-sky-100"
                        >
                          <Paperclip className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Ver Fatura</span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/40 italic">Sem anexo</span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Concluída
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button className="p-2 hover:bg-primary/10 text-primary rounded-lg transition-colors" title="Ver Detalhes">
                            <Eye className="w-4 h-4" />
                         </button>
                      </div>
                    </td>
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
