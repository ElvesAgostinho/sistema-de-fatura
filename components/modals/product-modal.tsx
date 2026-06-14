'use client';

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type Product = {
  id?: string;
  name: string;
  description?: string | null;
  price: number;
  tax_rate: number;
  sku?: string | null;
  product_type?: string;
  track_stock?: boolean;
  quantity_in_stock?: number;
  stock_alert_threshold?: number;
};

export default function ProductModal({ onClose, onSaved, initial }: {
  onClose: () => void;
  onSaved: (p: any, mode: 'create' | 'update') => void;
  initial?: Product | null;
}) {
  const isEdit = !!initial?.id;
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    product_type: initial?.product_type ?? 'P',
    price: initial?.price ?? 0,
    tax_rate: initial?.tax_rate ?? 14,
    sku: initial?.sku ?? '',
    track_stock: !!initial?.track_stock,
    quantity_in_stock: initial?.quantity_in_stock ?? 0,
    stock_alert_threshold: initial?.stock_alert_threshold ?? 0,
  });
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) { toast.error('Nome obrigatório'); return; }
    setLoading(true);
    try {
      const url = isEdit ? `/api/products/${initial!.id}` : '/api/products';
      const method = isEdit ? 'PUT' : 'POST';
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const j = await r.json();
      if (!r.ok) { toast.error(j?.error ?? 'Erro'); return; }
      toast.success(isEdit ? 'Produto actualizado' : 'Produto criado');
      onSaved(j.product, isEdit ? 'update' : 'create');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-md shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b sticky top-0 bg-card">
          <h3 className="font-semibold">{isEdit ? 'Editar produto' : 'Novo produto / serviço'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-secondary rounded"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Tipo *</label>
              <select value={form.product_type} onChange={(e) => setForm((p) => ({ ...p, product_type: e.target.value, track_stock: e.target.value === 'S' ? false : p.track_stock }))} className="w-full h-10 px-3 rounded border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="P">Produto</option>
                <option value="S">Serviço</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nome *</label>
              <input required value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="w-full h-10 px-3 rounded border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
          </div>
          <div><label className="text-xs text-muted-foreground mb-1 block">Descrição</label>
            <input value={form.description ?? ''} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} className="w-full h-10 px-3 rounded border border-input bg-background text-sm" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-muted-foreground mb-1 block">SKU / código</label>
              <input value={form.sku ?? ''} onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value }))} className="w-full h-10 px-3 rounded border border-input bg-background text-sm font-mono" /></div>
            <div><label className="text-xs text-muted-foreground mb-1 block">IVA %</label>
              <input type="number" min="0" max="100" step="0.01" value={form.tax_rate} onChange={(e) => setForm((p) => ({ ...p, tax_rate: Number(e.target.value) }))} className="w-full h-10 px-3 rounded border border-input bg-background text-sm font-mono" /></div>
          </div>
          <div><label className="text-xs text-muted-foreground mb-1 block">Preço (AOA) *</label>
            <input type="number" min="0" step="0.01" required value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: Number(e.target.value) }))} className="w-full h-10 px-3 rounded border border-input bg-background text-sm font-mono" /></div>

          {form.product_type === 'P' && (
            <div className="border-t pt-3 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.track_stock} onChange={(e) => setForm((p) => ({ ...p, track_stock: e.target.checked }))} className="w-4 h-4 rounded" />
                <span className="text-sm font-medium">Controlar stock</span>
              </label>
              {form.track_stock && (
                <div className="grid grid-cols-2 gap-3 pl-6">
                  <div><label className="text-xs text-muted-foreground mb-1 block">Quantidade em stock</label>
                    <input type="number" min="0" step="0.01" value={form.quantity_in_stock} onChange={(e) => setForm((p) => ({ ...p, quantity_in_stock: Number(e.target.value) }))} className="w-full h-10 px-3 rounded border border-input bg-background text-sm font-mono" /></div>
                  <div><label className="text-xs text-muted-foreground mb-1 block">Alerta stock mín.</label>
                    <input type="number" min="0" step="0.01" value={form.stock_alert_threshold} onChange={(e) => setForm((p) => ({ ...p, stock_alert_threshold: Number(e.target.value) }))} className="w-full h-10 px-3 rounded border border-input bg-background text-sm font-mono" /></div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded text-sm font-medium hover:bg-secondary">Cancelar</button>
            <button type="submit" disabled={loading} className="ms-btn-primary disabled:opacity-60">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (isEdit ? 'Guardar' : 'Criar')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
