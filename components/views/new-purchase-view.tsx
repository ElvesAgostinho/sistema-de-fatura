'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, FileText, UserPlus, PackagePlus, Loader2, Receipt, Calendar, CheckCircle2, Upload, FileUp, X } from 'lucide-react';
import { formatAOA } from '@/lib/utils';
import { toast } from 'sonner';
import SupplierModal from '@/components/modals/supplier-modal';
import ProductSearchSelector from '@/components/selectors/product-search-selector';
import { createClient } from '@/lib/supabase/client';
import { useAppStore } from '@/lib/store/use-app-store';
import { useResource } from '@/lib/hooks/use-resource';

type Supplier = { id: string; name: string; nif: string };
type Product = { id: string; name: string; price: number; tax_rate: number; description?: string | null; sku?: string | null };
type Item = { id: string; description: string; quantity: number; price: number; tax_rate: number; product_id?: string | null };

function uid() { return Math.random().toString(36).slice(2, 10); }

export default function NewPurchaseView() {
  const router = useRouter();
  const { purchaseDraft, setPurchaseDraft } = useAppStore();
  const [supplierId, setSupplierId] = useState(purchaseDraft?.supplierId ?? '');
  const [purchaseNumber, setPurchaseNumber] = useState(purchaseDraft?.purchaseNumber ?? '');
  const [issuedAt, setIssuedAt] = useState(purchaseDraft?.issuedAt ?? new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState<Item[]>(purchaseDraft?.items ?? [{ id: uid(), description: '', quantity: 1, price: 0, tax_rate: 14 }]);
  const [notes, setNotes] = useState(purchaseDraft?.notes ?? '');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentPath, setAttachmentPath] = useState(purchaseDraft?.attachmentPath ?? null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [supplierModal, setSupplierModal] = useState(false);

  // Persistence effect
  useEffect(() => {
    setPurchaseDraft({ supplierId, purchaseNumber, issuedAt, items, notes, attachmentPath });
  }, [supplierId, purchaseNumber, issuedAt, items, notes, attachmentPath, setPurchaseDraft]);

  const { data: suppliersData, mutate: mutateSuppliers } = useResource<{ suppliers: any[] }>('/api/suppliers', { ttl: 60_000 });
  const suppliers = suppliersData?.suppliers ?? [];

  const totals = useMemo(() => {
    let subtotal = 0, tax = 0;
    for (const it of items) {
      const lineSub = (Number(it.quantity) || 0) * (Number(it.price) || 0);
      const rate = Number(it.tax_rate) || 0;
      subtotal += lineSub;
      tax += lineSub * (rate / 100);
    }
    return { subtotal: +subtotal.toFixed(2), tax: +tax.toFixed(2), total: +(subtotal + tax).toFixed(2) };
  }, [items]);

  const updateItem = (id: string, patch: Partial<Item>) => setItems((prev) => prev.map((x) => x.id === id ? { ...x, ...patch } : x));
  const addEmptyItem = () => setItems((prev) => [...prev, { id: uid(), description: '', quantity: 1, price: 0, tax_rate: 14 }]);
  const removeItem = (id: string) => setItems((prev) => prev.filter((x) => x.id !== id));
  
  const applyProduct = (id: string, p: Product) => {
    updateItem(id, { 
      description: p.name + (p.sku ? ` [${p.sku}]` : ''), 
      price: Number(p.price), 
      tax_rate: Number(p.tax_rate), 
      product_id: p.id 
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachment(file);
    setUploading(true);
    try {
      const supabase = createClient();
      const fileExt = file.name.split('.').pop();
      const fileName = `${uid()}.${fileExt}`;
      const filePath = `purchase-invoices/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('purchases')
        .upload(filePath, file);

      if (uploadError) throw uploadError;
      setAttachmentPath(filePath);
      toast.success('Ficheiro carregado com sucesso');
    } catch (error: any) {
      toast.error('Erro ao carregar ficheiro: ' + error.message);
      setAttachment(null);
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async () => {
    if (!supplierId) { toast.error('Selecione um fornecedor'); return; }
    if (!purchaseNumber) { toast.error('Indique o número da fatura do fornecedor'); return; }
    if (items.length === 0) { toast.error('Adicione pelo menos um item'); return; }
    
    for (const it of items) {
      if (!it.description?.trim()) { toast.error('Descrição em falta num item'); return; }
      if (Number(it.quantity) <= 0) { toast.error('Quantidade deve ser > 0'); return; }
      if (Number(it.price) < 0) { toast.error('Preço inválido'); return; }
    }

    setSubmitting(true);
    try {
      const r = await fetch('/api/purchases', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: supplierId,
          purchase_number: purchaseNumber,
          items,
          issued_at: issuedAt,
          notes,
          attachment_path: attachmentPath
        }),
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j?.error ?? 'Falha'); return; }
      useAppStore.getState().setPurchaseDraft(null);
      toast.success(`Compra registada com sucesso!`);
      router.push(`/purchases`);
    } catch (e: any) { toast.error(e?.message ?? 'Erro'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Registar Compra</h1>
        <p className="text-muted-foreground">Registe as faturas de fornecedores para controlo de custos e stock</p>
      </div>

      <div className="grid lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-8">
          {/* Dados da Fatura e Fornecedor */}
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="ms-card p-6 shadow-sm border-t-4 border-t-primary/20">
              <h3 className="font-semibold flex items-center gap-2 mb-5 text-base">
                <FileText className="w-5 h-5 text-primary" />
                Dados da Fatura
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Nº Fatura Fornecedor *</label>
                  <input
                    required
                    value={purchaseNumber}
                    onChange={(e) => setPurchaseNumber(e.target.value)}
                    placeholder="Ex: FT 2026/001"
                    className="w-full h-11 px-4 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Data de Emissão *</label>
                  <input
                    type="date"
                    value={issuedAt}
                    onChange={(e) => setIssuedAt(e.target.value)}
                    className="w-full h-11 px-4 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="ms-card p-6 shadow-sm border-t-4 border-t-primary/20">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-semibold flex items-center gap-2 text-base">
                  <UserPlus className="w-5 h-5 text-primary" />
                  Fornecedor
                </h3>
                <button 
                  onClick={() => setSupplierModal(true)} 
                  type="button" 
                  className="text-xs font-bold text-primary px-2 py-1 rounded bg-primary/5 hover:bg-primary/10 transition-colors"
                >
                  + NOVO
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Selecionar Fornecedor *</label>
                  <select 
                    value={supplierId} 
                    onChange={(e) => setSupplierId(e.target.value)} 
                    className="w-full h-11 px-4 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  >
                    <option value="">-- Selecione --</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.nif})</option>)}
                  </select>
                </div>
                <div className="p-3 rounded-md bg-secondary/50 text-[11px] text-muted-foreground">
                  O fornecedor deve estar registado para associar custos e impostos.
                </div>
              </div>
            </div>
          </div>

          {/* Itens */}
          <div className="ms-card shadow-sm relative z-10">
            <div className="p-6 border-b flex items-center justify-between bg-secondary/10 rounded-t-xl">
              <h3 className="font-semibold flex items-center gap-2 text-base">
                <Receipt className="w-5 h-5 text-primary" />
                Itens da Compra
              </h3>
              <button 
                onClick={addEmptyItem} 
                type="button" 
                className="ms-btn-secondary h-9 px-4 text-xs font-bold uppercase tracking-wider"
              >
                + Adicionar Linha
              </button>
            </div>

            <div className="p-6 space-y-6">
              {items.map((it, idx) => (
                <div key={it.id} className="relative group p-6 rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-md transition-all">
                  <div className="absolute -top-3 -left-2 px-2 py-0.5 rounded bg-primary text-[10px] font-bold text-white uppercase tracking-tighter">
                    Item {idx + 1}
                  </div>
                  
                  {items.length > 1 && (
                    <button 
                      onClick={() => removeItem(it.id)} 
                      type="button" 
                      className="absolute -top-3 -right-2 p-1.5 text-destructive bg-background border border-destructive/20 hover:bg-destructive hover:text-white rounded-full shadow-sm transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mt-2">
                    <div className="md:col-span-12 lg:col-span-5 space-y-4">
                      <div>
                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Produto do Catálogo</label>
                        <ProductSearchSelector 
                          onSelect={(p) => applyProduct(it.id, p)} 
                          placeholder="Pesquise por nome ou SKU..."
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Descrição na Fatura</label>
                        <input 
                          value={it.description} 
                          onChange={(e) => updateItem(it.id, { description: e.target.value })} 
                          placeholder="Descrição detalhada..." 
                          className="w-full h-11 px-4 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" 
                        />
                      </div>
                    </div>

                    <div className="md:col-span-12 lg:col-span-7">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Quantidade</label>
                          <input 
                            type="number" 
                            min="0" 
                            step="0.001" 
                            value={it.quantity} 
                            onChange={(e) => updateItem(it.id, { quantity: Number(e.target.value) })} 
                            className="w-full h-11 px-4 rounded-lg border border-input bg-background text-sm font-mono focus:ring-2 focus:ring-primary/20 outline-none transition-all" 
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Preço Unit.</label>
                          <div className="relative">
                            <input 
                              type="number" 
                              min="0" 
                              step="0.01" 
                              value={it.price} 
                              onChange={(e) => updateItem(it.id, { price: Number(e.target.value) })} 
                              className="w-full h-11 px-4 rounded-lg border border-input bg-background text-sm font-mono focus:ring-2 focus:ring-primary/20 outline-none transition-all" 
                            />
                            <span className="absolute right-3 top-3 text-[10px] text-muted-foreground font-bold">AOA</span>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">IVA %</label>
                          <select
                            value={it.tax_rate}
                            onChange={(e) => updateItem(it.id, { tax_rate: Number(e.target.value) })}
                            className="w-full h-11 px-4 rounded-lg border border-input bg-background text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                          >
                            <option value="14">14% (Normal)</option>
                            <option value="7">7% (Reduzido)</option>
                            <option value="5">5% (Setorial)</option>
                            <option value="2">2% (Simplificado)</option>
                            <option value="0">0% (Isento)</option>
                          </select>
                        </div>
                      </div>
                      
                      <div className="mt-4 flex justify-end">
                        <div className="text-xs font-bold text-muted-foreground">
                          Total da Linha: <span className="text-foreground font-mono ml-2 text-sm">
                            {formatAOA((Number(it.quantity) || 0) * (Number(it.price) || 0) * (1 + (Number(it.tax_rate) || 0) / 100))}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="ms-card p-6 shadow-sm border-t-4 border-t-sky-500/20">
            <h3 className="font-semibold mb-4 text-base flex items-center gap-2">
              <Upload className="w-5 h-5 text-sky-600" />
              Anexo da Fatura (Original)
            </h3>
            <div className="space-y-4">
              {!attachmentPath ? (
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-muted-foreground/20 rounded-xl cursor-pointer hover:bg-secondary/30 transition-all">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6 text-muted-foreground">
                      {uploading ? (
                        <Loader2 className="w-8 h-8 animate-spin mb-2" />
                      ) : (
                        <FileUp className="w-8 h-8 mb-2" />
                      )}
                      <p className="text-sm font-medium">Clique para carregar ou arraste</p>
                      <p className="text-[10px] uppercase tracking-wider mt-1">PDF, JPG, PNG (Max 5MB)</p>
                    </div>
                    <input type="file" className="hidden" accept=".pdf,image/*" onChange={handleFileUpload} disabled={uploading} />
                  </label>
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-sky-100 bg-sky-50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-sky-600 flex items-center justify-center text-white">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-sky-900 truncate max-w-[200px]">{attachment?.name || 'Ficheiro carregado'}</div>
                      <div className="text-[10px] font-bold text-sky-600 uppercase tracking-widest">Pronto para guardar</div>
                    </div>
                  </div>
                  <button onClick={() => { setAttachment(null); setAttachmentPath(null); }} className="p-2 text-sky-600 hover:bg-sky-100 rounded-full">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="ms-card p-6 shadow-sm">
            <h3 className="font-semibold mb-3 text-base flex items-center gap-2">
               Observações
            </h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas adicionais sobre esta compra (opcional)..."
              className="w-full h-28 p-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
            />
          </div>
        </div>

        {/* Resumo Lateral */}
        <div className="lg:col-span-1">
          <div className="ms-card p-6 lg:sticky lg:top-4 shadow-lg border-t-4 border-t-primary">
            <h3 className="font-bold mb-6 text-lg tracking-tight uppercase">Resumo Financeiro</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Mercadoria</span>
                <span className="font-mono font-medium">{formatAOA(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">IVA Total</span>
                <span className="font-mono font-medium">{formatAOA(totals.tax)}</span>
              </div>
              <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent my-4" />
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Total a Pagar</span>
                <div className="text-2xl font-black font-mono text-primary leading-tight">
                  {formatAOA(totals.total)}
                </div>
              </div>
            </div>
            
            <button 
              onClick={onSubmit} 
              disabled={submitting} 
              className="mt-8 w-full ms-btn-primary justify-center h-14 text-sm font-bold uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-60 disabled:scale-100"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Processando...
                </>
              ) : (
                'Finalizar Registo'
              )}
            </button>

            <div className="mt-4 p-4 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="text-[10px] leading-tight text-emerald-800 font-medium">
                O stock será atualizado automaticamente após a confirmação.
              </div>
            </div>
          </div>
        </div>
      </div>

      {supplierModal && <SupplierModal onClose={() => setSupplierModal(false)} onSaved={(s) => { mutateSuppliers((prev) => prev ? { suppliers: [s, ...prev.suppliers] } : { suppliers: [s] }); setSupplierId(s.id); setSupplierModal(false); }} />}
    </div>
  );
}
