'use client';

import { useState } from 'react';
import { X, Loader2, Package, Image as ImageIcon, BarChart3, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

type Product = {
  id?: string;
  name: string;
  description?: string | null;
  price: number;
  tax_rate: number;
  sku?: string | null;
  code?: string | null;
  barcode?: string | null;
  base_uom?: string;
  image_url?: string | null;
  product_type?: string | null;
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
  const [tab, setTab] = useState<'general' | 'sales' | 'inventory'>('general');
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    product_type: initial?.product_type ?? 'P',
    price: initial?.price ?? 0,
    tax_rate: initial?.tax_rate ?? 14,
    sku: initial?.sku ?? '',
    code: initial?.code ?? '',
    barcode: initial?.barcode ?? '',
    base_uom: initial?.base_uom ?? 'un',
    image_url: initial?.image_url ?? '',
    track_stock: !!initial?.track_stock,
    quantity_in_stock: initial?.quantity_in_stock ?? 0,
    stock_alert_threshold: initial?.stock_alert_threshold ?? 0,
  });
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const supabase = createClient();

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Imagem muito grande (máx 2MB)');
      return;
    }

    setUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('products')
        .upload(fileName, file);
        
      if (error) throw error;
      
      const { data: { publicUrl } } = supabase.storage
        .from('products')
        .getPublicUrl(fileName);
        
      setForm({ ...form, image_url: publicUrl });
      toast.success('Imagem carregada com sucesso');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao carregar imagem');
    } finally {
      setUploadingImage(false);
    }
  };

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
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        
        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-card z-10">
          <div className="flex items-center gap-4">
            <label className="w-14 h-14 rounded-md bg-secondary flex items-center justify-center text-muted-foreground overflow-hidden border cursor-pointer relative group flex-shrink-0">
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
              {form.image_url ? (
                <img src={form.image_url} alt="Produto" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="w-6 h-6" />
              )}
              {uploadingImage && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-white" />
                </div>
              )}
              {!uploadingImage && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-center">
                  <span className="text-[9px] font-bold text-white uppercase tracking-wider px-1">Mudar<br/>Foto</span>
                </div>
              )}
            </label>
            <div>
              <h3 className="font-bold text-lg leading-none">{form.name || (isEdit ? 'Editar Produto' : 'Novo Produto/Serviço')}</h3>
              <p className="text-xs text-muted-foreground mt-1">{form.sku || 'Sem Ref. Interna'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-secondary rounded-full transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={submit} className="flex-1 overflow-y-auto">
          {/* TABS */}
          <div className="flex border-b px-6 gap-6 sticky top-0 bg-card z-10">
            <button type="button" onClick={() => setTab('general')} className={`py-3 text-sm font-medium border-b-2 transition-colors ${tab === 'general' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>Informação Geral</button>
            <button type="button" onClick={() => setTab('sales')} className={`py-3 text-sm font-medium border-b-2 transition-colors ${tab === 'sales' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>Vendas & Preço</button>
            {form.product_type === 'P' && (
              <button type="button" onClick={() => setTab('inventory')} className={`py-3 text-sm font-medium border-b-2 transition-colors ${tab === 'inventory' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>Inventário</button>
            )}
          </div>

          <div className="p-6 space-y-6">
            {tab === 'general' && (
              <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-200">
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="text-sm font-semibold mb-1.5 block">Nome do Produto *</label>
                    <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full h-10 px-3 rounded-md border bg-background focus:ring-2 focus:ring-primary" placeholder="Ex: T-Shirt Básica" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold mb-1.5 block">Tipo de Artigo</label>
                    <select value={form.product_type ?? ''} onChange={e => setForm({ ...form, product_type: e.target.value })} className="w-full h-10 px-3 rounded-md border bg-background focus:ring-2 focus:ring-primary">
                      <option value="P">📦 Produto Físico (Stock)</option>
                      <option value="S">🔧 Serviço</option>
                      <option value="O">📋 Outro</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold mb-1.5 block">Descrição (Aparece na fatura)</label>
                  <textarea rows={3} value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full p-3 rounded-md border bg-background focus:ring-2 focus:ring-primary resize-none" placeholder="Detalhes do produto ou serviço..." />
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div className="flex flex-col justify-center text-muted-foreground bg-secondary/30 p-3 rounded-md border border-dashed text-[11px] leading-tight">
                    <strong className="text-primary mb-1 block">📸 Fotografia do Artigo</strong>
                    Clica na imagem no cabeçalho acima para fazeres upload direto do teu computador ou telemóvel.
                  </div>
                  <div>
                    <label className="text-sm font-semibold mb-1.5 block">Unidade de Medida Base</label>
                    <select value={form.base_uom} onChange={e => setForm({ ...form, base_uom: e.target.value })} className="w-full h-10 px-3 rounded-md border bg-background focus:ring-2 focus:ring-primary">
                      <option value="un">Unidade (un)</option>
                      <option value="kg">Kilograma (kg)</option>
                      <option value="l">Litro (l)</option>
                      <option value="m">Metro (m)</option>
                      <option value="cx">Caixa (cx)</option>
                      <option value="serv">Serviço (h/dia)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {tab === 'sales' && (
              <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-200">
                <div className="grid grid-cols-2 gap-5">
                  <div className="p-4 rounded-xl border bg-secondary/20">
                    <label className="text-sm font-semibold mb-1.5 block text-primary">Preço de Venda (AOA) *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">Kz</span>
                      <input type="number" min="0" step="0.01" required value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} className="w-full h-12 pl-10 pr-4 text-lg rounded-md border bg-background focus:ring-2 focus:ring-primary font-mono font-bold" />
                    </div>
                  </div>
                  <div className="p-4 rounded-xl border bg-secondary/20">
                    <label className="text-sm font-semibold mb-1.5 block">Imposto Aplicável (IVA) *</label>
                    <div className="relative">
                      <select value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: Number(e.target.value) })} className="w-full h-12 pl-3 pr-10 text-lg rounded-md border bg-background focus:ring-2 focus:ring-primary font-mono font-bold appearance-none">
                        <option value={0}>Isento (0%)</option>
                        <option value={5}>5%</option>
                        <option value={7}>7%</option>
                        <option value={14}>Normal (14%)</option>
                      </select>
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-mono pointer-events-none">%</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border space-y-4">
                  <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Settings className="w-4 h-4" /> Códigos de Identificação
                  </h4>
                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <label className="text-xs font-semibold mb-1.5 block">SKU (Referência Interna)</label>
                      <input value={form.sku ?? ''} onChange={e => setForm({ ...form, sku: e.target.value })} className="w-full h-10 px-3 rounded-md border bg-background font-mono text-sm" placeholder="Ex: TSH-BR-01" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold mb-1.5 block">Código de Barras (EAN13)</label>
                      <input value={form.barcode ?? ''} onChange={e => setForm({ ...form, barcode: e.target.value })} className="w-full h-10 px-3 rounded-md border bg-background font-mono text-sm" placeholder="Ex: 560123456789" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === 'inventory' && form.product_type === 'P' && (
              <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-200">
                <div className="p-4 rounded-xl border">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={form.track_stock} onChange={(e) => setForm({ ...form, track_stock: e.target.checked })} className="w-5 h-5 rounded text-primary focus:ring-primary" />
                    <div>
                      <span className="text-sm font-bold block">Controlar Stock deste produto</span>
                      <span className="text-xs text-muted-foreground">O sistema irá deduzir automaticamente as quantidades vendidas</span>
                    </div>
                  </label>
                </div>
                
                {form.track_stock && (
                  <div className="p-4 rounded-xl border bg-secondary/10 space-y-4">
                    <h4 className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" /> Gestão de Quantidades
                    </h4>
                    <div className="grid grid-cols-2 gap-5">
                      <div>
                        <label className="text-xs font-semibold mb-1.5 block">Stock Atual Inicial</label>
                        <input type="number" min="0" step="0.01" value={form.quantity_in_stock} onChange={(e) => setForm({ ...form, quantity_in_stock: Number(e.target.value) })} className="w-full h-10 px-3 rounded-md border bg-background font-mono text-sm" disabled={isEdit} title={isEdit ? "Para ajustar o stock num produto existente, use a aba de Inventário." : ""} />
                        {isEdit && <span className="text-[10px] text-muted-foreground mt-1 block">Use movimentos de stock para ajustar o stock existente.</span>}
                      </div>
                      <div>
                        <label className="text-xs font-semibold mb-1.5 block">Alerta de Stock Mínimo</label>
                        <input type="number" min="0" step="0.01" value={form.stock_alert_threshold} onChange={(e) => setForm({ ...form, stock_alert_threshold: Number(e.target.value) })} className="w-full h-10 px-3 rounded-md border bg-background font-mono text-sm" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="p-6 border-t bg-muted/30 flex justify-end gap-3 sticky bottom-0">
            <button type="button" onClick={onClose} className="px-5 h-10 rounded-md text-sm font-medium border bg-background hover:bg-secondary transition-colors">Cancelar</button>
            <button type="submit" disabled={loading} className="ms-btn-primary h-10 px-8 text-sm font-bold shadow-md hover:shadow-lg transition-all">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (isEdit ? 'Guardar Alterações' : 'Criar Produto')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
