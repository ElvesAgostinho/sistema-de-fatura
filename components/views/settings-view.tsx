'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Save, Upload, Loader2, Building2, ShieldCheck, FileDown, Activity, Plug, Users } from 'lucide-react';
import { toast } from 'sonner';
import CertificationPanel from './certification-panel';
import SaftExportPanel from './saft-export-panel';
import SystemAuditPanel from './system-audit-panel';
import ErpIntegrationPanel from './erp-integration-panel';
import UserManagementPanel from './user-management-panel';
import PanelErrorBoundary from './panel-error-boundary';
import { useProfile } from '@/lib/hooks/use-profile';
import { ShieldAlert } from 'lucide-react';

export default function SettingsView() {
  const { isAdmin, isPlatformAdmin, loading: profileLoading } = useProfile();
  const [tab, setTab] = useState<'empresa' | 'utilizadores' | 'certificacao' | 'exportacoes' | 'auditoria' | 'erp'>('empresa');
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [company, setCompany] = useState<any>({ name: '', nif: '', address: '', phone: '', email: '', logo_url: '' });

  useEffect(() => { (async () => {
    try {
      const r = await fetch('/api/company', { cache: 'no-store' });
      const j = await r.json();
      if (r.ok && j.company) setCompany({ ...j.company, address: j.company.address ?? '', phone: j.company.phone ?? '', email: j.company.email ?? '', logo_url: j.company.logo_url ?? '' });
    } finally { setLoading(false); }
  })(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch('/api/company', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(company) });
      const j = await r.json();
      if (!r.ok) { toast.error(j?.error ?? 'Erro'); return; }
      toast.success('Configurações guardadas');
    } finally { setSaving(false); }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { toast.error('Máx 5MB'); return; }
    setUploading(true);
    try {
      const r = await fetch('/api/upload/logo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: f.name, contentType: f.type }) });
      const j = await r.json();
      if (!r.ok) { toast.error(j?.error ?? 'Falha'); return; }
      const headers: Record<string, string> = { 'Content-Type': f.type };
      if (String(j.uploadUrl).includes('content-disposition')) headers['Content-Disposition'] = 'attachment';
      const up = await fetch(j.uploadUrl, { method: 'PUT', headers, body: f });
      if (!up.ok) { toast.error('Erro a fazer upload'); return; }
      setCompany((p: any) => ({ ...p, logo_url: j.publicUrl }));
      toast.success('Logo carregado. Guarde para aplicar.');
    } finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  if (loading || profileLoading) return <div className="flex items-center justify-center p-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">Dados da empresa e configurações fiscais</p>
      </div>

      <div className="flex gap-1 border-b border-border overflow-x-auto -mx-1 px-1 whitespace-nowrap scrollbar-thin">
        <button
          type="button"
          onClick={() => setTab('empresa')}
          className={`shrink-0 px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${tab === 'empresa' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <Building2 className="w-4 h-4" /> Empresa
        </button>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setTab('utilizadores')}
            className={`shrink-0 px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${tab === 'utilizadores' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            <Users className="w-4 h-4" /> Utilizadores
          </button>
        )}
        {isPlatformAdmin && (
          <button
            type="button"
            onClick={() => setTab('certificacao')}
            className={`shrink-0 px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${tab === 'certificacao' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            <ShieldCheck className="w-4 h-4" /> Certificação AGT
          </button>
        )}
        <button
          type="button"
          onClick={() => setTab('exportacoes')}
          className={`shrink-0 px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${tab === 'exportacoes' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <FileDown className="w-4 h-4" /> Exportações AGT
        </button>
        <button
          type="button"
          onClick={() => setTab('auditoria')}
          className={`shrink-0 px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${tab === 'auditoria' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <Activity className="w-4 h-4" /> Auditoria do sistema
        </button>
        <button
          type="button"
          onClick={() => setTab('erp')}
          className={`shrink-0 px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${tab === 'erp' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <Plug className="w-4 h-4" /> Integração ERP
        </button>
      </div>

      {tab === 'utilizadores' && <PanelErrorBoundary name="utilizadores"><UserManagementPanel /></PanelErrorBoundary>}
      {tab === 'certificacao' && isPlatformAdmin && <PanelErrorBoundary name="certificacao"><CertificationPanel /></PanelErrorBoundary>}
      {tab === 'exportacoes' && <PanelErrorBoundary name="exportacoes"><SaftExportPanel /></PanelErrorBoundary>}
      {tab === 'auditoria' && <PanelErrorBoundary name="auditoria"><SystemAuditPanel /></PanelErrorBoundary>}
      {tab === 'erp' && <PanelErrorBoundary name="erp"><ErpIntegrationPanel /></PanelErrorBoundary>}

      {tab === 'empresa' && (<>
      <div className="ms-card p-6 space-y-4">
        <h3 className="font-semibold flex items-center gap-2"><Building2 className="w-4 h-4 text-primary" />Dados da empresa</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="md:col-span-2"><label className="text-xs text-muted-foreground mb-1 block">Nome da empresa *</label>
            <input value={company.name ?? ''} onChange={(e) => setCompany((p: any) => ({ ...p, name: e.target.value }))} className="w-full h-10 px-3 rounded border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" /></div>
          <div><label className="text-xs text-muted-foreground mb-1 block">NIF *</label>
            <input value={company.nif ?? ''} disabled className="w-full h-10 px-3 rounded border border-input bg-secondary text-sm font-mono opacity-70" />
            <p className="text-xs text-muted-foreground mt-1">NIF não pode ser alterado após criar a empresa.</p>
          </div>
          <div><label className="text-xs text-muted-foreground mb-1 block">Telefone</label>
            <input value={company.phone ?? ''} onChange={(e) => setCompany((p: any) => ({ ...p, phone: e.target.value }))} className="w-full h-10 px-3 rounded border border-input bg-background text-sm" /></div>
          <div className="md:col-span-2"><label className="text-xs text-muted-foreground mb-1 block">Endereço</label>
            <input value={company.address ?? ''} onChange={(e) => setCompany((p: any) => ({ ...p, address: e.target.value }))} className="w-full h-10 px-3 rounded border border-input bg-background text-sm" /></div>
          <div className="md:col-span-2"><label className="text-xs text-muted-foreground mb-1 block">Email</label>
            <input type="email" value={company.email ?? ''} onChange={(e) => setCompany((p: any) => ({ ...p, email: e.target.value }))} className="w-full h-10 px-3 rounded border border-input bg-background text-sm" /></div>
        </div>
      </div>

      <div className="ms-card p-6 space-y-4">
        <h3 className="font-semibold">Logo da empresa</h3>
        <div className="flex items-center gap-4">
          <div className="relative w-24 h-24 rounded bg-secondary flex items-center justify-center overflow-hidden">
            {company.logo_url ? (
              <Image src={company.logo_url} alt="Logo da empresa" fill className="object-contain p-2" />
            ) : <Building2 className="w-8 h-8 text-muted-foreground" />}
          </div>
          <div>
            <button onClick={() => fileRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-2 px-4 py-2 rounded border text-sm font-medium hover:bg-secondary disabled:opacity-60">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? 'A carregar...' : 'Carregar logo'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
            <p className="text-xs text-muted-foreground mt-2">PNG, JPG, SVG. Máx 5 MB.</p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={save} disabled={saving} className="ms-btn-primary disabled:opacity-60">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Guardar</>}
        </button>
      </div>
      </>)}
    </div>
  );
}
