'use client';

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type Supplier = { id?: string; name: string; nif: string; address?: string | null; phone?: string | null; email?: string | null };

export default function SupplierModal({ onClose, onSaved, initial }: {
  onClose: () => void;
  onSaved: (s: any, mode: 'create' | 'update') => void;
  initial?: Supplier | null;
}) {
  const isEdit = !!initial?.id;
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    nif: initial?.nif ?? '',
    address: initial?.address ?? '',
    phone: initial?.phone ?? '',
    email: initial?.email ?? '',
  });
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.nif) { toast.error('Nome e NIF obrigatórios'); return; }
    setLoading(true);
    try {
      const url = isEdit ? `/api/suppliers/${initial!.id}` : '/api/suppliers';
      const method = isEdit ? 'PUT' : 'POST';
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const j = await r.json();
      if (!r.ok) { toast.error(j?.error ?? 'Erro'); return; }
      toast.success(isEdit ? 'Fornecedor actualizado' : 'Fornecedor criado');
      onSaved(j.supplier, isEdit ? 'update' : 'create');
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao guardar');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-md shadow-lg w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h3 className="font-semibold">{isEdit ? 'Editar fornecedor' : 'Novo fornecedor'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-secondary rounded"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div><label className="text-xs text-muted-foreground mb-1 block">Nome *</label>
            <input required value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="w-full h-10 px-3 rounded border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" /></div>
          <div><label className="text-xs text-muted-foreground mb-1 block">NIF *</label>
            <input required value={form.nif} onChange={(e) => setForm((p) => ({ ...p, nif: e.target.value }))} disabled={isEdit} className={`w-full h-10 px-3 rounded border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary ${isEdit ? 'bg-secondary opacity-70' : 'bg-background'}`} />
            {isEdit && <p className="text-xs text-muted-foreground mt-1">NIF não pode ser alterado.</p>}
          </div>
          <div><label className="text-xs text-muted-foreground mb-1 block">Endereço</label>
            <input value={form.address ?? ''} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} className="w-full h-10 px-3 rounded border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-muted-foreground mb-1 block">Telefone</label>
              <input value={form.phone ?? ''} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} className="w-full h-10 px-3 rounded border border-input bg-background text-sm" /></div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Email</label>
              <input type="email" value={form.email ?? ''} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} className="w-full h-10 px-3 rounded border border-input bg-background text-sm" /></div>
          </div>
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
