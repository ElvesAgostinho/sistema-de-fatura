'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, FileText, UserPlus, PackagePlus, Loader2, AlertCircle, Receipt } from 'lucide-react';
import { formatAOA } from '@/lib/utils';
import { toast } from 'sonner';
import ClientModal from '@/components/modals/client-modal';
import ProductModal from '@/components/modals/product-modal';
import ProductSearchSelector from '@/components/selectors/product-search-selector';
import { useAppStore } from '@/lib/store/use-app-store';
import { useResource } from '@/lib/hooks/use-resource';

type Client = { id: string; name: string; nif: string };
type Product = { id: string; name: string; price: number; tax_rate: number; description?: string | null };
type Item = { id: string; description: string; quantity: number; price: number; tax_rate: number; product_id?: string | null };

const DOC_TYPES = [
  { value: 'FT', label: 'Fatura (FT)', desc: 'Documento fiscal padrão de venda' },
  { value: 'FR', label: 'Fatura-Recibo (FR)', desc: 'Fatura paga no ato da emissão' },
  { value: 'NC', label: 'Nota de Crédito (NC)', desc: 'Retifica / anula FT anterior (devoluções, descontos)' },
  { value: 'ND', label: 'Nota de Débito (ND)', desc: 'Adiciona valor a FT anterior (juros, encargos)' },
  { value: 'RC', label: 'Recibo (RC)', desc: 'Comprovativo de recebimento' },
  { value: 'PP', label: 'Pró-forma (PP)', desc: 'Orçamento/Proforma para produtos' },
  { value: 'OR', label: 'Orçamento (OR)', desc: 'Orçamento para prestação de serviços' },
  { value: 'GT', label: 'Guia de Transporte (GT)', desc: 'Acompanha bens em circulação' },
] as const;

function uid() { return Math.random().toString(36).slice(2, 10); }

export default function NewInvoiceView() {
  const router = useRouter();
  const { invoiceDraft, setInvoiceDraft } = useAppStore();
  const [mounted, setMounted] = useState(false);
  const [docType, setDocType] = useState<'FT'|'FR'|'NC'|'ND'|'RC'|'PP'|'OR'|'GT'>(invoiceDraft?.docType ?? 'FT');
  const [relatedDocument, setRelatedDocument] = useState(invoiceDraft?.relatedDocument ?? '');
  const [clientId, setClientId] = useState(invoiceDraft?.clientId ?? '');
  const [items, setItems] = useState<Item[]>(invoiceDraft?.items ?? [{ id: uid(), description: '', quantity: 1, price: 0, tax_rate: 14 }]);
  const [taxExempt, setTaxExempt] = useState(invoiceDraft?.taxExempt ?? false);
  const [taxExemptionReason, setTaxExemptionReason] = useState(invoiceDraft?.taxExemptionReason ?? '');
  const [paymentMethod, setPaymentMethod] = useState<'Dinheiro'|'Multicaixa'|'Transferência'|'Cheque'>('Dinheiro');
  const [validUntil, setValidUntil] = useState('');
  const [transportDetails, setTransportDetails] = useState({ loadLocation: '', unloadLocation: '', licensePlate: '', startDate: '' });
  const [applyRetention, setApplyRetention] = useState(invoiceDraft?.applyRetention ?? false);
  const [submitting, setSubmitting] = useState(false);
  const [clientModal, setClientModal] = useState(false);
  const [productModal, setProductModal] = useState<string | null>(null);

  // Draft persistence
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      setInvoiceDraft({ docType, relatedDocument, clientId, items, taxExempt, taxExemptionReason, applyRetention });
    }
  }, [mounted, docType, relatedDocument, clientId, items, taxExempt, taxExemptionReason, applyRetention, setInvoiceDraft]);

  const { data: clientsData, mutate: mutateClients } = useResource<{ clients: any[] }>('/api/clients', { ttl: 60_000 });
  const { data: productsData, mutate: mutateProducts } = useResource<{ products: any[] }>('/api/products', { ttl: 60_000 });

  const clients = clientsData?.clients ?? [];
  const products = productsData?.products ?? [];

  const totals = useMemo(() => {
    let subtotal = 0, tax = 0;
    for (const it of items) {
      const lineSub = (Number(it.quantity) || 0) * (Number(it.price) || 0);
      const rate = taxExempt ? 0 : (Number(it.tax_rate) || 0);
      subtotal += lineSub;
      tax += lineSub * (rate / 100);
    }
    const retentionTax = applyRetention ? subtotal * 0.065 : 0;
    return { 
      subtotal: +subtotal.toFixed(2), 
      tax: +tax.toFixed(2), 
      retentionTax: +retentionTax.toFixed(2),
      total: +(subtotal + tax - retentionTax).toFixed(2) 
    };
  }, [items, taxExempt, applyRetention]);

  const updateItem = (id: string, patch: Partial<Item>) => setItems((prev) => prev.map((x) => x.id === id ? { ...x, ...patch } : x));
  const addEmptyItem = () => setItems((prev) => [...prev, { id: uid(), description: '', quantity: 1, price: 0, tax_rate: 14 }]);
  const removeItem = (id: string) => setItems((prev) => prev.filter((x) => x.id !== id));
  const applyProduct = (id: string, p: any) => {
    if (!p) return;
    updateItem(id, { description: p.name + (p.description ? ` - ${p.description}` : ''), price: Number(p.price), tax_rate: Number(p.tax_rate), product_id: p.id });
  };

  const onSubmit = async () => {
    if (!clientId) { toast.error('Selecione um cliente'); return; }
    if (items.length === 0) { toast.error('Adicione pelo menos um item'); return; }
    for (const it of items) {
      if (!it.description?.trim()) { toast.error('Descrição em falta num item'); return; }
      if (Number(it.quantity) <= 0) { toast.error('Quantidade deve ser > 0'); return; }
      if (Number(it.price) < 0) { toast.error('Preço inválido'); return; }
    }
    if (taxExempt && taxExemptionReason.trim().length < 5) { toast.error('Motivo de isenção obrigatório (min 5 chars)'); return; }
    if ((docType === 'NC' || docType === 'ND') && !relatedDocument.trim()) {
      toast.error(`${docType === 'NC' ? 'Nota de Crédito' : 'Nota de Débito'}: indique o número da fatura original (ex: FT 2026/0001)`);
      return;
    }
    if ((docType === 'PP' || docType === 'OR') && !validUntil) { toast.error('A data de validade é obrigatória para Pró-forma ou Orçamento.'); return; }
    if (docType === 'GT') {
      if (!transportDetails.loadLocation || !transportDetails.unloadLocation || !transportDetails.licensePlate || !transportDetails.startDate) {
        toast.error('Preencha todos os detalhes da Guia de Transporte.'); return;
      }
    }

    setSubmitting(true);
    try {
      const r = await fetch('/api/invoices', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId, items,
          tax_exempt: taxExempt,
          tax_exemption_reason: taxExempt ? taxExemptionReason : null,
          document_type: docType,
          related_document: (docType === 'NC' || docType === 'ND') ? relatedDocument.trim() : null,
          payment_method: (docType === 'FR' || docType === 'RC') ? paymentMethod : null,
          valid_until: (docType === 'PP' || docType === 'OR') ? new Date(validUntil).toISOString() : null,
          transport_details: docType === 'GT' ? transportDetails : null,
          apply_retention: applyRetention,
        }),
      });
      const text = await r.text();
      let j: any = {};
      try { j = text ? JSON.parse(text) : {}; } catch { j = { error: 'Resposta inválida do servidor' }; }
      
      if (!r.ok) { toast.error(j?.error ?? 'Falha ao emitir fatura'); return; }
      useAppStore.getState().setInvoiceDraft(null);
      toast.success(`Fatura ${j.invoice?.invoice_number ?? ''} emitida!`);
      if (j.invoice?.id) router.push(`/invoices/${j.invoice.id}`);
    } catch (e: any) { toast.error(e?.message ?? 'Erro de conexão'); }
    finally { setSubmitting(false); }
  };

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Emitir documento</h1>
        <p className="text-sm text-muted-foreground">Emita faturas, notas de crédito/débito, recibos — todos em conformidade com a AGT</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Tipo de documento */}
          <div className="ms-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2"><FileText className="w-4 h-4 text-primary" />Tipo de documento</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {DOC_TYPES.map((dt) => (
                <button
                  key={dt.value}
                  type="button"
                  onClick={() => setDocType(dt.value as any)}
                  className={`text-left p-3 rounded-md border-2 transition ${docType === dt.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
                >
                  <div className={`text-sm font-semibold ${docType === dt.value ? 'text-primary' : 'text-foreground'}`}>{dt.label}</div>
                  <div className="text-[11px] text-muted-foreground mt-1 leading-tight">{dt.desc}</div>
                </button>
              ))}
            </div>
            {(docType === 'NC' || docType === 'ND') && (
              <div className="mt-4 pt-4 border-t border-border">
                <label className="text-xs text-muted-foreground mb-1 block">Fatura original (obrigatório para {docType === 'NC' ? 'Nota de Crédito' : 'Nota de Débito'})</label>
                <input
                  value={relatedDocument}
                  onChange={(e) => setRelatedDocument(e.target.value)}
                  placeholder="Ex: FT 2026/0001"
                  className="w-full h-10 px-3 rounded border border-input bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <div className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  A AGT exige que toda nota de crédito/débito referencie a fatura original que está a retificar.
                </div>
              </div>
            )}
            
            {(docType === 'FR' || docType === 'RC') && (
              <div className="mt-4 pt-4 border-t border-border">
                <label className="text-xs text-muted-foreground mb-1 block">Método de Pagamento (Pronto-Pagamento)</label>
                <select 
                  value={paymentMethod} 
                  onChange={(e) => setPaymentMethod(e.target.value as any)} 
                  className="w-full h-10 px-3 rounded border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="Dinheiro">Numerário (Dinheiro)</option>
                  <option value="Multicaixa">Multicaixa / TPA</option>
                  <option value="Transferência">Transferência Bancária</option>
                  <option value="Cheque">Cheque</option>
                </select>
                <div className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  Este valor entrará diretamente no Fecho de Caixa do dia de hoje.
                </div>
              </div>
            )}
            
            {(docType === 'PP' || docType === 'OR') && (
              <div className="mt-4 pt-4 border-t border-border">
                <label className="text-xs text-muted-foreground mb-1 block">Validade do Orçamento</label>
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="w-full h-10 px-3 rounded border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <div className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  Data de validade do orçamento (livre escolha).
                </div>
              </div>
            )}

            {docType === 'GT' && (
              <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <h4 className="text-sm font-semibold mb-2">Detalhes de Transporte</h4>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Local de Carga</label>
                  <input
                    value={transportDetails.loadLocation}
                    onChange={(e) => setTransportDetails({...transportDetails, loadLocation: e.target.value})}
                    placeholder="Morada de carga"
                    className="w-full h-10 px-3 rounded border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Local de Descarga</label>
                  <input
                    value={transportDetails.unloadLocation}
                    onChange={(e) => setTransportDetails({...transportDetails, unloadLocation: e.target.value})}
                    placeholder="Morada de descarga"
                    className="w-full h-10 px-3 rounded border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Matrícula da Viatura</label>
                  <input
                    value={transportDetails.licensePlate}
                    onChange={(e) => setTransportDetails({...transportDetails, licensePlate: e.target.value})}
                    placeholder="Ex: LD-00-00-AA"
                    className="w-full h-10 px-3 rounded border border-input bg-background text-sm uppercase focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Início do Transporte</label>
                  <input
                    type="datetime-local"
                    value={transportDetails.startDate}
                    onChange={(e) => setTransportDetails({...transportDetails, startDate: e.target.value})}
                    className="w-full h-10 px-3 rounded border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Cliente */}
          <div className="ms-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2"><FileText className="w-4 h-4 text-primary" />Cliente</h3>
              <button onClick={() => setClientModal(true)} type="button" className="text-xs text-primary font-medium hover:underline flex items-center gap-1"><UserPlus className="w-3.5 h-3.5" /> Novo cliente</button>
            </div>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="">-- Selecione --</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.nif})</option>)}
            </select>
          </div>

          {/* Itens */}
          <div className="ms-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2"><Receipt className="w-4 h-4 text-primary" />Itens</h3>
              <div className="flex gap-2">
                <button onClick={() => setProductModal('new')} type="button" className="text-xs text-primary font-medium hover:underline flex items-center gap-1"><PackagePlus className="w-3.5 h-3.5" /> Novo produto</button>
                <button onClick={addEmptyItem} type="button" className="text-xs text-primary font-medium hover:underline flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Adicionar linha</button>
              </div>
            </div>

            <div className="space-y-3">
              {items.map((it, idx) => (
                <div key={it.id} className="p-3 rounded border border-border bg-secondary/30">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs font-semibold text-muted-foreground">Item {idx + 1}</span>
                    {items.length > 1 && (
                      <button onClick={() => removeItem(it.id)} type="button" className="p-1 text-destructive hover:bg-destructive/10 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                    )}
                  </div>
                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-12">
                      <label className="text-xs text-muted-foreground mb-1 block">Descrição</label>
                      <div className="flex gap-2">
                        <input value={it.description} onChange={(e) => updateItem(it.id, { description: e.target.value })} placeholder="Ex: Consultoria de TI" className="flex-1 h-11 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                        <div className="w-[250px] shrink-0">
                          <ProductSearchSelector onSelect={(p) => applyProduct(it.id, p)} placeholder="Do catálogo..." />
                        </div>
                      </div>
                    </div>
                    <div className="col-span-4">
                      <label className="text-xs text-muted-foreground mb-1 block">Quantidade</label>
                      <input type="number" min="0" step="0.001" value={it.quantity} onChange={(e) => updateItem(it.id, { quantity: Number(e.target.value) })} className="w-full h-9 px-3 rounded border border-input bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                    <div className="col-span-4">
                      <label className="text-xs text-muted-foreground mb-1 block">Preço unit. (AOA)</label>
                      <input type="number" min="0" step="0.01" value={it.price} onChange={(e) => updateItem(it.id, { price: Number(e.target.value) })} className="w-full h-9 px-3 rounded border border-input bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                    <div className="col-span-4">
                      <label className="text-xs text-muted-foreground mb-1 block">IVA %</label>
                      <input type="number" min="0" max="100" step="0.01" value={taxExempt ? 0 : it.tax_rate} disabled={taxExempt} onChange={(e) => updateItem(it.id, { tax_rate: Number(e.target.value) })} className="w-full h-9 px-3 rounded border border-input bg-background text-sm font-mono disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>
                  </div>
                  <div className="mt-2 text-right text-xs text-muted-foreground">
                    Total linha: <span className="font-mono font-semibold text-foreground">{formatAOA((Number(it.quantity)||0) * (Number(it.price)||0) * (1 + (taxExempt ? 0 : (Number(it.tax_rate)||0)) / 100))}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Isenção */}
          <div className="ms-card p-5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={taxExempt} onChange={(e) => setTaxExempt(e.target.checked)} className="w-4 h-4 accent-primary" />
              <span className="text-sm font-medium">Fatura com isenção de IVA</span>
            </label>
            {taxExempt && (
              <div className="mt-3">
                <label className="text-xs text-muted-foreground mb-1 block">Motivo legal da isenção (obrigatório)</label>
                <input value={taxExemptionReason} onChange={(e) => setTaxExemptionReason(e.target.value)} placeholder="Ex: Exportação de bens - art. X do CIVA" className="w-full h-10 px-3 rounded border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                <div className="mt-2 flex items-start gap-2 text-xs text-warning">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  O motivo será gravado na fatura conforme exigido pela AGT.
                </div>
              </div>
            )}
            
            {(docType === 'FT' || docType === 'FR' || docType === 'RC') && (
              <div className="mt-4 pt-4 border-t border-border">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={applyRetention} onChange={(e) => setApplyRetention(e.target.checked)} className="w-4 h-4 accent-primary" />
                  <span className="text-sm font-medium">Aplicar Retenção na Fonte (IRT 6.5%)</span>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Resumo */}
        <div className="lg:col-span-1">
          <div className="ms-card p-5 lg:sticky lg:top-4">
            <h3 className="font-semibold mb-4">Resumo</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">{formatAOA(totals.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">IVA{taxExempt ? ' (isento)' : ''}</span><span className="font-mono">{formatAOA(totals.tax)}</span></div>
              {applyRetention && (
                <div className="flex justify-between text-destructive"><span>Retenção (IRT 6.5%)</span><span className="font-mono">-{formatAOA(totals.retentionTax)}</span></div>
              )}
              <div className="h-px bg-border my-2" />
              <div className="flex justify-between text-base font-bold"><span>Total a Pagar</span><span className="font-mono text-primary">{formatAOA(totals.total)}</span></div>
            </div>
            <button onClick={onSubmit} disabled={submitting} className="mt-5 w-full ms-btn-primary justify-center h-11 disabled:opacity-60">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Emitir {DOC_TYPES.find(d=>d.value===docType)?.label.replace(/ \(.+\)/, '') ?? 'documento'}</>}
            </button>
            <p className="mt-3 text-xs text-muted-foreground text-center">Após emissão, o documento não poderá ser editado. Apenas anulado.</p>
          </div>
        </div>
      </div>

      {clientModal && <ClientModal onClose={() => setClientModal(false)} onSaved={(c) => { mutateClients((prev) => prev ? { clients: [c, ...prev.clients] } : { clients: [c] }); setClientId(c.id); setClientModal(false); }} />}
      {productModal && <ProductModal onClose={() => setProductModal(null)} onSaved={(p) => { mutateProducts((prev) => prev ? { products: [p, ...prev.products] } : { products: [p] }); setProductModal(null); }} />}
    </div>
  );
}
