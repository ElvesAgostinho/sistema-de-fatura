'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  Save, Upload, Loader2, Building2, ShieldCheck, FileDown,
  Activity, Plug, Users, Palette, Eye, ImageIcon, AlignLeft,
  AlignCenter, AlignRight, Layers, Receipt,
} from 'lucide-react';
import { toast } from 'sonner';
import CertificationPanel    from './certification-panel';
import SaftExportPanel        from './saft-export-panel';
import SystemAuditPanel       from './system-audit-panel';
import BillingRulesPanel      from './billing-rules-panel';
import ErpIntegrationPanel    from './erp-integration-panel';
import UserManagementPanel    from './user-management-panel';
import PanelErrorBoundary     from './panel-error-boundary';
import { useProfile }         from '@/lib/hooks/use-profile';
import { ShieldAlert }        from 'lucide-react';

/* ─── tipos ─────────────────────────────────────────────────────────────── */
type LogoPosition = 'top-left' | 'top-center' | 'top-right' | 'watermark';
type LogoSize     = 'small' | 'medium' | 'large';

/* ─── mini-preview de fatura ─────────────────────────────────────────────
   Mostra como ficará o cabeçalho da fatura com as opções escolhidas       */
function InvoicePreview({ company }: { company: any }) {
  const primary = company.invoice_primary_color || '#0b4a6f';
  const bg      = company.invoice_header_bg     || '#ffffff';
  const pos     = company.logo_position         || 'top-left';
  const size    = company.logo_size             || 'medium';
  const h: Record<LogoSize, number> = { small: 28, medium: 44, large: 60 };
  const lh = h[size as LogoSize] ?? 44;

  const logoImg = company.logo_url
    ? <img src={company.logo_url} alt="logo" style={{ maxHeight: lh, maxWidth: 100, objectFit: 'contain' }} />
    : <div style={{ width: 60, height: lh, background: primary + '22', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ImageIcon size={16} color={primary} /></div>;

  return (
    <div style={{ border: `1px solid ${primary}30`, borderRadius: 8, overflow: 'hidden', fontSize: 10, userSelect: 'none' }}>
      {/* Cabeçalho da fatura (mini) */}
      <div style={{ background: bg, borderBottom: `2px solid ${primary}`, padding: '10px 12px' }}>
        {/* Logo top-center ocupa linha inteira */}
        {pos === 'top-center' && <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>{logoImg}</div>}
        {pos === 'top-right'  && <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>{logoImg}</div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            {pos === 'top-left' && <div style={{ marginBottom: 4 }}>{logoImg}</div>}
            {pos === 'watermark' && (
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', opacity: 0.08, transform: 'rotate(-15deg)', top: 0, left: 0 }}>{logoImg}</div>
                <span style={{ color: primary, fontWeight: 800, fontSize: 11 }}>Nome da Empresa</span>
              </div>
            )}
            {pos !== 'watermark' && <span style={{ color: primary, fontWeight: 800, fontSize: 11 }}>Nome da Empresa</span>}
            <div style={{ color: '#888', fontSize: 9, marginTop: 1 }}>NIF: 000000000</div>
            <div style={{ color: '#888', fontSize: 9 }}>Luanda, Angola</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: primary, fontWeight: 900, fontSize: 16, lineHeight: 1 }}>FT</div>
            <div style={{ fontSize: 9, color: '#555', fontFamily: 'monospace' }}>FT 2025/0001</div>
            <div style={{ background: primary + '18', color: primary, borderRadius: 20, padding: '2px 8px', fontSize: 9, fontWeight: 700, marginTop: 3 }}>EMITIDA</div>
          </div>
        </div>
      </div>
      {/* Corpo mini */}
      <div style={{ padding: '8px 12px', background: '#fafafa' }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          {['Emitente', 'Cliente'].map(l => (
            <div key={l} style={{ flex: 1, background: primary + '10', borderLeft: `2px solid ${primary}`, padding: '4px 6px', borderRadius: '0 4px 4px 0' }}>
              <div style={{ fontSize: 7, fontWeight: 800, color: primary, textTransform: 'uppercase', letterSpacing: .5 }}>{l}</div>
              <div style={{ background: '#ddd', height: 5, borderRadius: 2, marginTop: 3, width: '80%' }} />
              <div style={{ background: '#ddd', height: 5, borderRadius: 2, marginTop: 2, width: '60%' }} />
            </div>
          ))}
        </div>
        {/* Mini tabela */}
        <div style={{ background: primary, borderRadius: '4px 4px 0 0', padding: '3px 6px', display: 'flex', justifyContent: 'space-between' }}>
          {['#', 'Descrição', 'Qtd', 'Preço', 'IVA', 'Total'].map(h => (
            <span key={h} style={{ color: '#fff', fontSize: 7, fontWeight: 700 }}>{h}</span>
          ))}
        </div>
        {[1,2].map(i => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 6px', background: i % 2 === 0 ? primary + '08' : '#fff', borderBottom: '1px solid #eee' }}>
            {['·','Produto', '1.000', '5.000', '14%', '5.700'].map((v, j) => (
              <span key={j} style={{ fontSize: 7, color: '#555' }}>{v}</span>
            ))}
          </div>
        ))}
        {/* Total */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
          <div style={{ width: 100, border: '1px solid #eee', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 6px', fontSize: 7 }}><span>Subtotal</span><span>10.000</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 6px', fontSize: 7 }}><span>IVA</span><span>1.400</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', background: primary, color: '#fff', padding: '4px 6px', fontSize: 8, fontWeight: 700 }}><span>TOTAL</span><span>11.400</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── componente principal ───────────────────────────────────────────────── */
export default function SettingsView() {
  const { isAdmin, isPlatformAdmin, loading: profileLoading } = useProfile();
  const [tab, setTab] = useState<'empresa' | 'faturacao' | 'utilizadores' | 'certificacao' | 'exportacoes' | 'auditoria' | 'erp'>('empresa');
  const fileRef   = useRef<HTMLInputElement>(null);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [uploading, setUploading] = useState(false);
  const [company,   setCompany]   = useState<any>({
    name: '', nif: '', address: '', phone: '', email: '',
    logo_url: '', business_name: '', city: 'Luanda', postal_code: '',
    // Branding da fatura
    logo_position:         'top-left',
    logo_size:             'medium',
    invoice_primary_color: '#0b4a6f',
    invoice_header_bg:     '#ffffff',
    invoice_show_watermark: false,
    invoice_footer_text:   '',
  });

  useEffect(() => { (async () => {
    try {
      const r = await fetch('/api/company', { cache: 'no-store' });
      const j = await r.json();
      if (r.ok && j.company) setCompany({
        ...j.company,
        address:               j.company.address               ?? '',
        phone:                 j.company.phone                 ?? '',
        email:                 j.company.email                 ?? '',
        logo_url:              j.company.logo_url              ?? '',
        business_name:         j.company.business_name         ?? '',
        city:                  j.company.city                  ?? 'Luanda',
        postal_code:           j.company.postal_code           ?? '',
        logo_position:         j.company.logo_position         ?? 'top-left',
        logo_size:             j.company.logo_size             ?? 'medium',
        invoice_primary_color: j.company.invoice_primary_color ?? '#0b4a6f',
        invoice_header_bg:     j.company.invoice_header_bg     ?? '#ffffff',
        invoice_show_watermark: j.company.invoice_show_watermark ?? false,
        invoice_footer_text:   j.company.invoice_footer_text   ?? '',
        bank_name:             j.company.bank_name             ?? '',
        bank_account:          j.company.bank_account          ?? '',
        bank_iban:             j.company.bank_iban             ?? '',
      });
    } finally { setLoading(false); }
  })(); }, []);

  const set = (k: string, v: any) => setCompany((p: any) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch('/api/company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(company),
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j?.error ?? 'Erro ao guardar'); return; }
      setCompany((p: any) => ({ ...p, ...j.company }));
      toast.success('Configurações guardadas ✓');
    } finally { setSaving(false); }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { toast.error('Máximo 5 MB'); return; }
    setUploading(true);
    try {
      const r = await fetch('/api/upload/logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: f.name, contentType: f.type }),
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j?.error ?? 'Falha no upload'); return; }
      const headers: Record<string, string> = { 'Content-Type': f.type };
      if (String(j.uploadUrl).includes('content-disposition')) headers['Content-Disposition'] = 'attachment';
      const up = await fetch(j.uploadUrl, { method: 'PUT', headers, body: f });
      if (!up.ok) { toast.error('Erro ao enviar ficheiro'); return; }
      set('logo_url', j.publicUrl);
      toast.success('Logo carregado. Clique em Guardar para aplicar.');
    } finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  if (loading || profileLoading) return (
    <div className="flex items-center justify-center p-20">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  /* ── TAB selector ── */
  const tabBtn = (id: typeof tab, icon: React.ReactNode, label: string) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`shrink-0 px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${tab === id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
    >{icon} {label}</button>
  );

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">Dados da empresa, branding das faturas e configurações fiscais</p>
      </div>

      {/* ── TABS ── */}
      <div className="flex gap-1 border-b border-border overflow-x-auto -mx-1 px-1 whitespace-nowrap scrollbar-thin">
        {tabBtn('empresa',      <Building2 className="w-4 h-4" />, 'Empresa')}
        {tabBtn('faturacao',    <Receipt className="w-4 h-4" />, 'Faturação')}
        {isAdmin && tabBtn('utilizadores', <Users className="w-4 h-4" />, 'Utilizadores')}
        {isPlatformAdmin && tabBtn('certificacao', <ShieldCheck className="w-4 h-4" />, 'Certificação AGT')}
        {tabBtn('exportacoes',  <FileDown className="w-4 h-4" />, 'Exportações AGT')}
        {tabBtn('auditoria',    <Activity className="w-4 h-4" />, 'Auditoria')}
        {tabBtn('erp',          <Plug className="w-4 h-4" />, 'Integração ERP')}
      </div>

      {/* ── PAINÉIS SECUNDÁRIOS ── */}
      {tab === 'faturacao'    && <PanelErrorBoundary name="faturacao"><BillingRulesPanel /></PanelErrorBoundary>}
      {tab === 'utilizadores' && <PanelErrorBoundary name="utilizadores"><UserManagementPanel /></PanelErrorBoundary>}
      {tab === 'certificacao' && isPlatformAdmin && <PanelErrorBoundary name="certificacao"><CertificationPanel /></PanelErrorBoundary>}
      {tab === 'exportacoes'  && <PanelErrorBoundary name="exportacoes"><SaftExportPanel /></PanelErrorBoundary>}
      {tab === 'auditoria'    && <PanelErrorBoundary name="auditoria"><SystemAuditPanel /></PanelErrorBoundary>}
      {tab === 'erp'          && <PanelErrorBoundary name="erp"><ErpIntegrationPanel /></PanelErrorBoundary>}

      {tab === 'empresa' && (<>
        {/* ── DADOS DA EMPRESA ── */}
        <div className="ms-card p-6 space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" /> Dados da empresa
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Nome comercial (para faturas) *</label>
              <input value={company.name ?? ''} onChange={e => set('name', e.target.value)} className="w-full h-10 px-3 rounded border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Razão social <span className="text-[10px] text-primary">(SAF-T: BusinessName)</span></label>
              <input value={company.business_name ?? ''} onChange={e => set('business_name', e.target.value)} placeholder="Ex: EMPRESA XYZ, LDA" className="w-full h-10 px-3 rounded border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">NIF *</label>
              <input value={company.nif ?? ''} disabled className="w-full h-10 px-3 rounded border border-input bg-secondary text-sm font-mono opacity-70" />
              <p className="text-xs text-muted-foreground mt-1">NIF não pode ser alterado após criar a empresa.</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Telefone</label>
              <input value={company.phone ?? ''} onChange={e => set('phone', e.target.value)} className="w-full h-10 px-3 rounded border border-input bg-background text-sm" />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Endereço / Rua</label>
              <input value={company.address ?? ''} onChange={e => set('address', e.target.value)} className="w-full h-10 px-3 rounded border border-input bg-background text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Cidade <span className="text-[10px] text-primary">(SAF-T)</span></label>
              <input value={company.city ?? ''} onChange={e => set('city', e.target.value)} placeholder="Luanda" className="w-full h-10 px-3 rounded border border-input bg-background text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Código postal <span className="text-[10px] text-primary">(SAF-T)</span></label>
              <input value={company.postal_code ?? ''} onChange={e => set('postal_code', e.target.value)} placeholder="Ex: 1000-001" className="w-full h-10 px-3 rounded border border-input bg-background text-sm" />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Email</label>
              <input type="email" value={company.email ?? ''} onChange={e => set('email', e.target.value)} className="w-full h-10 px-3 rounded border border-input bg-background text-sm" />
            </div>
          </div>
        </div>

        {/* ── DADOS BANCÁRIOS ── */}
        <div className="ms-card p-6 space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" /> Dados Bancários (para transferências)
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Banco</label>
              <input value={company.bank_name ?? ''} onChange={e => set('bank_name', e.target.value)} placeholder="Ex: BAI, BFA, BIC" className="w-full h-10 px-3 rounded border border-input bg-background text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Número de Conta</label>
              <input value={company.bank_account ?? ''} onChange={e => set('bank_account', e.target.value)} placeholder="Ex: 123456789.10.001" className="w-full h-10 px-3 rounded border border-input bg-background text-sm" />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">IBAN</label>
              <input value={company.bank_iban ?? ''} onChange={e => set('bank_iban', e.target.value)} placeholder="Ex: AO06 0040 0000 0000 0000 0000 0" className="w-full h-10 px-3 rounded border border-input bg-background text-sm font-mono" />
              <p className="text-xs text-muted-foreground mt-1">Esta informação será apresentada no rodapé das faturas para facilitar o pagamento por transferência.</p>
            </div>
          </div>
        </div>

        {/* ── LOGO + BRANDING DA FATURA ── */}
        <div className="ms-card p-6 space-y-6">
          <h3 className="font-semibold flex items-center gap-2">
            <Palette className="w-4 h-4 text-primary" /> Aparência das Faturas PDF
          </h3>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* COLUNA ESQUERDA — controlos */}
            <div className="space-y-5">

              {/* Upload do logo */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">Logo da empresa</label>
                <div className="flex items-center gap-4">
                  <div className="relative w-20 h-20 rounded-lg border border-border bg-secondary flex items-center justify-center overflow-hidden">
                    {company.logo_url
                      ? <Image src={company.logo_url} alt="Logo" fill className="object-contain p-2" />
                      : <Building2 className="w-7 h-7 text-muted-foreground" />}
                  </div>
                  <div>
                    <button onClick={() => fileRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-2 px-3 py-1.5 rounded border text-sm font-medium hover:bg-secondary disabled:opacity-60">
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {uploading ? 'A carregar...' : 'Carregar logo'}
                    </button>
                    <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
                    <p className="text-xs text-muted-foreground mt-1.5">PNG, JPG, SVG. Máx 5 MB.</p>
                    {company.logo_url && (
                      <button onClick={() => set('logo_url', '')} className="text-xs text-destructive hover:underline mt-1 block">Remover logo</button>
                    )}
                  </div>
                </div>
              </div>

              {/* Posição do logo */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">Posição do logo na fatura</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { v: 'top-left',   icon: <AlignLeft size={14} />,   label: 'Topo Esquerda' },
                    { v: 'top-center', icon: <AlignCenter size={14} />, label: 'Topo Centro' },
                    { v: 'top-right',  icon: <AlignRight size={14} />,  label: 'Topo Direita' },
                    { v: 'watermark',  icon: <Layers size={14} />,      label: 'Marca de Água' },
                  ] as { v: LogoPosition; icon: React.ReactNode; label: string }[]).map(({ v, icon, label }) => (
                    <button
                      key={v}
                      onClick={() => set('logo_position', v)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${company.logo_position === v ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border text-muted-foreground hover:border-primary/40'}`}
                    >
                      {icon} {label}
                    </button>
                  ))}
                </div>
                {company.logo_position === 'watermark' && (
                  <p className="text-xs text-muted-foreground mt-1.5">O logo aparecerá em fundo, com baixa opacidade — estilo empresas de topo.</p>
                )}
              </div>

              {/* Tamanho do logo */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">Tamanho do logo</label>
                <div className="flex gap-2">
                  {([
                    { v: 'small',  label: 'Pequeno' },
                    { v: 'medium', label: 'Médio' },
                    { v: 'large',  label: 'Grande' },
                  ] as { v: LogoSize; label: string }[]).map(({ v, label }) => (
                    <button
                      key={v}
                      onClick={() => set('logo_size', v)}
                      className={`flex-1 py-2 rounded-lg border text-sm transition-all ${company.logo_size === v ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border text-muted-foreground hover:border-primary/40'}`}
                    >{label}</button>
                  ))}
                </div>
              </div>

              {/* Cores */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Cor principal <span className="text-[10px]">(cabeçalho, tabela)</span></label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={company.invoice_primary_color || '#0b4a6f'}
                      onChange={e => set('invoice_primary_color', e.target.value)}
                      className="w-10 h-9 rounded border border-border cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={company.invoice_primary_color || '#0b4a6f'}
                      onChange={e => { if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) set('invoice_primary_color', e.target.value); }}
                      className="flex-1 h-9 px-2 rounded border border-border bg-background text-sm font-mono"
                      maxLength={7}
                    />
                  </div>
                  {/* Palettes de cores profissionais */}
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {['#0b4a6f','#1a56db','#0d9488','#7c3aed','#b45309','#dc2626','#059669','#0f172a'].map(c => (
                      <button key={c} onClick={() => set('invoice_primary_color', c)} title={c}
                        className={`w-5 h-5 rounded border-2 transition-transform hover:scale-110 ${company.invoice_primary_color === c ? 'border-foreground' : 'border-transparent'}`}
                        style={{ background: c }} />
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Fundo do cabeçalho</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={company.invoice_header_bg || '#ffffff'}
                      onChange={e => set('invoice_header_bg', e.target.value)}
                      className="w-10 h-9 rounded border border-border cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={company.invoice_header_bg || '#ffffff'}
                      onChange={e => { if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) set('invoice_header_bg', e.target.value); }}
                      className="flex-1 h-9 px-2 rounded border border-border bg-background text-sm font-mono"
                      maxLength={7}
                    />
                  </div>
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {['#ffffff','#f0f9ff','#f0fdf4','#faf5ff','#fffbeb','#f8fafc','#0b4a6f','#1e293b'].map(c => (
                      <button key={c} onClick={() => set('invoice_header_bg', c)} title={c}
                        className={`w-5 h-5 rounded border-2 transition-transform hover:scale-110 ${company.invoice_header_bg === c ? 'border-foreground' : 'border-border'}`}
                        style={{ background: c }} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Marca de água adicional */}
              <div className="flex items-center gap-3 p-3 rounded-lg border border-border">
                <input
                  type="checkbox"
                  id="watermark-chk"
                  checked={!!company.invoice_show_watermark}
                  onChange={e => set('invoice_show_watermark', e.target.checked)}
                  className="w-4 h-4 accent-primary"
                />
                <div>
                  <label htmlFor="watermark-chk" className="text-sm font-medium cursor-pointer">Adicionar logo como marca de água no fundo</label>
                  <p className="text-xs text-muted-foreground">O logo aparece em background com baixa opacidade em todas as faturas</p>
                </div>
              </div>

              {/* Texto de rodapé personalizado */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Texto de rodapé personalizado <span className="text-[10px]">(opcional)</span>
                </label>
                <textarea
                  value={company.invoice_footer_text ?? ''}
                  onChange={e => set('invoice_footer_text', e.target.value)}
                  placeholder={`Ex: Obrigado pela preferência!\nCondições de pagamento: 30 dias.\nBanco BFA · IBAN: AO06 0000 0000 0000 0000 0000 0`}
                  rows={3}
                  className="w-full px-3 py-2 rounded border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                  maxLength={300}
                />
                <p className="text-xs text-muted-foreground mt-1">{(company.invoice_footer_text ?? '').length}/300 caracteres</p>
              </div>
            </div>

            {/* COLUNA DIREITA — preview em tempo real */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Eye size={14} /> Pré-visualização em tempo real
              </div>
              <InvoicePreview company={company} />
              <p className="text-xs text-muted-foreground text-center">
                Esta é uma aproximação. O PDF final será gerado com a formatação completa.
              </p>
            </div>
          </div>
        </div>

        {/* ── BOTÃO GUARDAR ── */}
        <div className="flex justify-end">
          <button onClick={save} disabled={saving} className="ms-btn-primary disabled:opacity-60 min-w-[120px]">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Guardar</>}
          </button>
        </div>
      </>)}
    </div>
  );
}
