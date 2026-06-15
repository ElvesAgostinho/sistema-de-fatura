'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Package, Check, X } from 'lucide-react';
import { useDebounce } from 'react-use';
import { formatAOA } from '@/lib/utils';

type Product = {
  id: string;
  name: string;
  price: number;
  tax_rate: number;
  description?: string | null;
  sku?: string | null;
  quantity_in_stock?: number;
};

interface Props {
  onSelect: (product: Product) => void;
  placeholder?: string;
  className?: string;
}

export default function ProductSearchSelector({ onSelect, placeholder = "Pesquisar produto por nome ou SKU...", className }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useDebounce(() => setDebouncedSearch(search), 300, [search]);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const url = `/api/products?search=${encodeURIComponent(debouncedSearch)}`;
        const r = await fetch(url);
        const j = await r.json();
        if (r.ok) setProducts(j.products ?? []);
      } catch (e) {
        console.error('Error fetching products:', e);
      } finally {
        setLoading(false);
      }
    };

    if (open) {
      fetchProducts();
    }
  }, [debouncedSearch, open]);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div 
        className="flex h-11 w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background cursor-pointer hover:border-primary/50 focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 transition-all"
        onClick={() => setOpen(true)}
      >
        <div className="flex items-center gap-2 text-muted-foreground overflow-hidden">
          <Search className="h-4 w-4 shrink-0" />
          <span className="truncate">{search || placeholder}</span>
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin shrink-0 text-primary" />}
      </div>

      {open && (
        <div className="absolute top-full left-0 z-[100] mt-2 w-full overflow-hidden rounded-xl border border-border bg-white text-popover-foreground shadow-2xl animate-in fade-in slide-in-from-top-2">
          <div className="flex h-full w-full flex-col overflow-hidden bg-white">
            <div className="flex items-center border-b px-3 bg-secondary/10">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <input
                className="flex h-12 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Pesquisar catálogo de produtos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
              {search && (
                 <button onClick={() => setSearch('')} className="p-1 hover:bg-secondary rounded-full text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                 </button>
              )}
            </div>
            <div className="max-h-[300px] overflow-y-auto overflow-x-hidden p-2">
              {loading && products.length === 0 && (
                <div className="py-10 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                   <Loader2 className="w-5 h-5 animate-spin" />
                   Procurando no catálogo...
                </div>
              )}
              {!loading && products.length === 0 && search && (
                <div className="py-10 text-center text-sm text-muted-foreground">
                   Nenhum produto encontrado para "{search}"
                </div>
              )}
              {products.map((p) => (
                <div
                  key={p.id}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onSelect(p);
                    setSearch('');
                    setOpen(false);
                  }}
                  className="group relative flex cursor-pointer select-none items-center rounded-lg px-3 py-3 text-sm outline-none transition-colors border border-transparent hover:border-primary/20 hover:bg-primary/5 hover:text-primary mb-1"
                >
                  <div className="mr-3 h-8 w-8 rounded-lg bg-secondary/50 flex items-center justify-center shrink-0 group-hover:bg-primary/10">
                    <Package className="h-4 w-4 opacity-70 group-hover:opacity-100 group-hover:text-primary" />
                  </div>
                  <div className="flex flex-col flex-1 overflow-hidden">
                    <div className="font-bold truncate text-foreground group-hover:text-primary">{p.name}</div>
                    <div className="flex items-center gap-2 text-[10px] opacity-80 uppercase tracking-widest font-medium mt-0.5">
                      {p.sku && <span className="bg-black/5 px-1.5 py-0.5 rounded text-muted-foreground group-hover:text-primary/70">{p.sku}</span>}
                      <span className="font-semibold text-primary/80">{formatAOA(p.price)}</span>
                      {p.quantity_in_stock !== undefined && (
                        <span className={p.quantity_in_stock <= 0 ? 'text-destructive font-bold' : 'text-muted-foreground'}>
                          Stock: {p.quantity_in_stock}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
