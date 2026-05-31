'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, Shield, KeyRound, Loader2, AlertCircle, Lock, Save, Award } from 'lucide-react';
import { toast } from 'sonner';

type Config = {
  id: string;
  mode: 'development' | 'pre_certificacao' | 'certificado';
  agt_certificado_numero: string | null;
  agt_data_certificacao: string | null;
  chave_privada: string | null; // masked string or null
  chave_publica: string | null;
  saft_modo: 'teste' | 'oficial';
  activated_at: string | null;
  has_private_key: boolean;
  has_public_key: boolean;
};

type Readiness = { ok: boolean; errors: string[] };
type Badge = { label: string; tone: 'muted' | 'warn' | 'success' };

export default function CertificationPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);
  const [config, setConfig] = useState<Config | null>(null);
  const [readiness, setReadiness] = useState<Readiness>({ ok: false, errors: [] });
  const [badge, setBadge] = useState<Badge>({ label: '', tone: 'muted' });

  // Local form state (separate from server state so we don't resend placeholders)
  const [numero, setNumero] = useState('');
  const [dataCert, setDataCert] = useState('');
  const [privKey, setPrivKey] = useState('');
  const [pubKey, setPubKey] = useState('');
  const [saftModo, setSaftModo] = useState<'teste' | 'oficial'>('teste');

  // Activation dialog state (double confirmation)
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [confirmText, setConfirmText] = useState('');

  // Key generation state
  const [generating, setGenerating] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [keyStatus, setKeyStatus] = useState<{ consistent: boolean | null; modulusLength?: number | null; reason?: string | null }>({ consistent: null });
  const [regenConfirmOpen, setRegenConfirmOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/fiscal-config', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) { toast.error(j?.error ?? 'Erro'); return; }
      setConfig(j.config); setReadiness(j.readiness); setBadge(j.badge);
      setNumero(j.config.agt_certificado_numero ?? '');
      setDataCert(j.config.agt_data_certificacao ?? '');
      setPrivKey(''); // never prefill — separate display block shows "saved" state
      setPubKey(j.config.chave_publica ?? '');
      setSaftModo(j.config.saft_modo);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const certified = config?.mode === 'certificado';

  // Unsaved changes indicator — true when form differs from server state
  const dirty = (
    (numero.trim() || '') !== (config?.agt_certificado_numero ?? '') ||
    (dataCert?.slice(0, 10) ?? '') !== (config?.agt_data_certificacao?.slice(0, 10) ?? '') ||
    (pubKey.trim() !== (config?.chave_publica ?? '')) ||
    privKey.trim().length > 0 ||
    saftModo !== (config?.saft_modo ?? 'teste')
  );

  // Auto-save SAF-T mode immediately (even when certified, backend allows this)
  const saveSaftMode = async (mode: 'teste' | 'oficial') => {
    const prev = saftModo;
    setSaftModo(mode);
    if (mode === (config?.saft_modo ?? 'teste')) return;
    try {
      const r = await fetch('/api/fiscal-config', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saft_modo: mode }),
      });
      const j = await r.json();
      if (!r.ok) {
        setSaftModo(prev);
        toast.error(j?.error ?? 'Erro ao guardar modo SAF-T');
        return;
      }
      toast.success(`Modo SAF-T alterado para ${mode === 'teste' ? 'Teste' : 'Oficial'}`);
      await load();
    } catch (e) {
      setSaftModo(prev);
      toast.error('Erro de ligação');
    }
  };

  // Internal save; returns true when server accepted the update.
  const save = async (opts?: { silent?: boolean }): Promise<boolean> => {
    setSaving(true);
    try {
      const payload: Record<string, any> = {};
      if (!certified) {
        payload.agt_certificado_numero = numero.trim() || null;
        payload.agt_data_certificacao = dataCert || null;
        if (privKey.trim()) payload.chave_privada = privKey;
        if (pubKey.trim() !== (config?.chave_publica ?? '')) payload.chave_publica = pubKey;
      }
      payload.saft_modo = saftModo;
      const r = await fetch('/api/fiscal-config', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok) {
        // "Nenhuma alteração enviada" means the form matches the server — that's not really an error
        if (r.status === 400 && typeof j?.error === 'string' && j.error.toLowerCase().includes('nenhuma altera')) {
          return true;
        }
        toast.error(j?.error ?? 'Erro ao guardar');
        return false;
      }
      if (!opts?.silent) toast.success('Configuração guardada');
      setPrivKey('');
      await load();
      return true;
    } finally { setSaving(false); }
  };

  const generateKeys = async (regen: boolean) => {
    setGenerating(true);
    try {
      const body: any = { modulusLength: 2048 };
      if (regen) body.confirmation = 'REGENERAR';
      const r = await fetch('/api/fiscal-config/generate-keys', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) {
        if (j?.keysExist) {
          toast.error('Já existem chaves. Use "Regerar" se realmente quiser substituí-las.');
        } else {
          toast.error(j?.error ?? 'Falha');
        }
        return;
      }
      setRegenConfirmOpen(false);
      toast.success(`Chaves RSA ${j.modulusLength} bits geradas com sucesso. Chave privada guardada de forma segura no servidor.`, { duration: 6000 });
      setPubKey(j.publicKey ?? '');
      setPrivKey('');
      await load();
      await runVerify();
    } finally { setGenerating(false); }
  };

  const runVerify = async () => {
    setVerifying(true);
    try {
      const r = await fetch('/api/fiscal-config/keys/verify', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) { toast.error(j?.error ?? 'Falha verificação'); return; }
      setKeyStatus({ consistent: j.consistent, modulusLength: j.modulusLength, reason: j.reason });
      if (j.consistent) toast.success('Chaves válidas e consistentes');
      else if (j.exists === false) toast.info('Ainda não existem chaves');
      else toast.error(j.reason ?? 'Par de chaves inconsistente');
    } finally { setVerifying(false); }
  };

  // Local, client-side readiness check — used to give fast feedback BEFORE saving.
  const localReadinessErrors = (() => {
    const errs: string[] = [];
    if (!numero.trim()) errs.push('Número do certificado AGT em falta');
    if (!dataCert) errs.push('Data de certificação em falta');
    if (!config?.has_private_key && !privKey.trim()) errs.push('Chave privada em falta');
    if (!pubKey.trim()) errs.push('Chave pública em falta');
    return errs;
  })();
  const canActivateLocally = localReadinessErrors.length === 0;

  const startActivation = async () => {
    if (!canActivateLocally) {
      toast.error(`Faltam dados: ${localReadinessErrors.join(', ')}`);
      return;
    }
    // Auto-save any pending form changes first so the server has up-to-date data.
    if (dirty) {
      toast.message('A guardar alterações antes de ativar…');
      const ok = await save({ silent: true });
      if (!ok) return;
    }
    // Fetch the latest readiness from the server to be sure.
    try {
      const r = await fetch('/api/fiscal-config', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok || !j?.readiness?.ok) {
        toast.error(`Não é possível ativar: ${(j?.readiness?.errors ?? ['dados incompletos']).join(' · ')}`);
        await load();
        return;
      }
    } catch (e) {
      toast.error('Falha ao validar requisitos no servidor');
      return;
    }
    setStep(1); setConfirmText(''); setConfirmOpen(true);
  };

  const activate = async () => {
    if (confirmText !== 'CERTIFICAR') { toast.error('Escreva CERTIFICAR exatamente como indicado'); return; }
    setActivating(true);
    try {
      const r = await fetch('/api/fiscal-config/activate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: 'CERTIFICAR' }),
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j?.error ?? 'Erro'); return; }
      toast.success(j?.message ?? 'Sistema certificado');
      setConfirmOpen(false); setConfirmText(''); setStep(1);
      await load();
    } finally { setActivating(false); }
  };

  if (loading) return (
    <div className="ms-card p-6 flex items-center gap-3">
      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      <span className="text-sm text-muted-foreground">A carregar configuração fiscal…</span>
    </div>
  );

  const toneClasses: Record<Badge['tone'], string> = {
    muted: 'bg-secondary text-foreground',
    warn: 'bg-warning/10 text-warning border border-warning/30',
    success: 'bg-success/10 text-success border border-success/30',
  };
  const Icon = certified ? ShieldCheck : badge.tone === 'warn' ? ShieldAlert : Shield;

  return (
    <div className="space-y-6">
      {/* Current status banner */}
      <div className={`ms-card p-5 flex items-start gap-4 ${toneClasses[badge.tone]}`}>
        <Icon className="w-10 h-10 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-wide opacity-70">Estado atual</div>
          <div className="font-semibold text-lg">{badge.label}</div>
          {certified && config?.activated_at && (
            <div className="text-xs opacity-80 mt-1">Ativado em {new Date(config.activated_at).toLocaleString('pt-PT')}</div>
          )}
          {!certified && (
            <p className="text-xs opacity-80 mt-1">
              Preencha todos os dados de certificação fornecidos pela AGT e ative o modo certificado de forma segura.
            </p>
          )}
        </div>
      </div>

      {/* Readiness checklist */}
      <div className="ms-card p-5">
        <h3 className="font-semibold flex items-center gap-2 mb-3">
          <Award className="w-4 h-4 text-primary" /> Requisitos para ativação
        </h3>
        {certified ? (
          <div className="text-sm text-success flex items-center gap-2"><Lock className="w-4 h-4" /> Sistema já certificado — campos críticos bloqueados.</div>
        ) : canActivateLocally && readiness.ok ? (
          <div className="text-sm text-success flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Todos os requisitos preenchidos. Pronto para ativação.</div>
        ) : canActivateLocally && !readiness.ok ? (
          <div className="text-sm text-warning flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              Formulário preenchido, mas existem <strong>alterações por guardar</strong>. Clique em "Guardar alterações" abaixo — ou em "Ativar modo certificado" (que guarda e ativa de uma só vez).
            </div>
          </div>
        ) : (
          <ul className="space-y-2">
            {(localReadinessErrors.length ? localReadinessErrors : readiness.errors).map((err, i) => (
              <li key={i} className="text-sm text-destructive flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {err}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Config form */}
      <div className="ms-card p-5 space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-primary" /> Dados de certificação AGT
        </h3>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Número do certificado AGT</label>
            <input
              value={numero} disabled={certified}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="Ex: AGT/2026/001"
              className="w-full h-10 px-3 rounded border border-input bg-background text-sm font-mono disabled:opacity-60"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Data de certificação</label>
            <input
              type="date" value={dataCert?.slice(0, 10) ?? ''} disabled={certified}
              onChange={(e) => setDataCert(e.target.value)}
              className="w-full h-10 px-3 rounded border border-input bg-background text-sm disabled:opacity-60"
            />
          </div>
        </div>

        {/* --- Key pair management --- */}
        <div className="rounded border border-border bg-secondary/40 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h4 className="font-semibold flex items-center gap-2"><KeyRound className="w-4 h-4 text-primary" /> Par de chaves RSA</h4>
              <p className="text-xs text-muted-foreground mt-0.5">Geradas localmente no servidor (RSA 2048 bits, SHA-256). Usadas para assinatura digital AGT.</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {!config?.has_private_key && !certified && (
                <button onClick={() => generateKeys(false)} disabled={generating}
                  className="inline-flex items-center gap-2 px-3 h-9 rounded bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-60">
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                  Gerar chaves automaticamente
                </button>
              )}
              {config?.has_private_key && !certified && (
                <button onClick={() => setRegenConfirmOpen(true)} disabled={generating}
                  className="inline-flex items-center gap-2 px-3 h-9 rounded border border-destructive/30 text-destructive text-sm font-medium hover:bg-destructive/10 disabled:opacity-60">
                  <KeyRound className="w-4 h-4" /> Regerar chaves
                </button>
              )}
              <button type="button" onClick={runVerify} disabled={verifying}
                className="inline-flex items-center gap-2 px-3 h-9 rounded border text-sm font-medium hover:bg-secondary disabled:opacity-60">
                {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                Verificar integridade
              </button>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3 text-xs">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${config?.has_private_key ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
              <span>Privada: {config?.has_private_key ? 'gravada' : 'em falta'}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${config?.has_public_key ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
              <span>Pública: {config?.has_public_key ? 'gravada' : 'em falta'}</span>
            </div>
            <div className="flex items-center gap-2">
              {keyStatus.consistent === true ? (
                <><div className="w-2 h-2 rounded-full bg-emerald-500" /><span>Par consistente {keyStatus.modulusLength ? `(${keyStatus.modulusLength} bits)` : ''}</span></>
              ) : keyStatus.consistent === false ? (
                <><div className="w-2 h-2 rounded-full bg-destructive" /><span>Inconsistente</span></>
              ) : (
                <><div className="w-2 h-2 rounded-full bg-muted-foreground" /><span>Não verificado</span></>
              )}
            </div>
          </div>
          {keyStatus.consistent === false && keyStatus.reason && (
            <p className="text-xs text-destructive">{keyStatus.reason}</p>
          )}
          {certified && (
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Lock className="w-3 h-3" /> Chaves bloqueadas após certificação — qualquer tentativa de alteração é rejeitada pela base de dados.</p>
          )}
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            Chave pública (PEM)
            {certified && <span className="ml-2 text-success"><Lock className="w-3 h-3 inline-block" /> bloqueada</span>}
          </label>
          <textarea
            value={pubKey} disabled={certified} rows={5}
            onChange={(e) => setPubKey(e.target.value)}
            placeholder="-----BEGIN PUBLIC KEY-----&#10;...&#10;-----END PUBLIC KEY-----"
            className="w-full px-3 py-2 rounded border border-input bg-background text-xs font-mono disabled:opacity-60 resize-y"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            Chave privada (PEM)
            {certified && <span className="ml-2 text-success"><Lock className="w-3 h-3 inline-block" /> bloqueada</span>}
          </label>

          {config?.has_private_key ? (
            <div className="space-y-2">
              <div className="rounded border border-success/40 bg-success/10 p-3">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-success">Chave privada guardada</div>
                    <div className="text-xs text-success/80 mt-0.5">
                      Armazenada de forma segura no servidor{keyStatus.modulusLength ? ` (RSA ${keyStatus.modulusLength} bits)` : ''}. Por motivos de segurança, nunca é devolvida ao browser.
                    </div>
                    <div className="mt-2 font-mono text-xs text-muted-foreground break-all leading-tight">
                      •••••••• •••••••• •••••••• •••••••• •••••••• •••••••• •••••••• ••••••••
                    </div>
                  </div>
                </div>
              </div>

              {!certified && (
                <details className="rounded border border-border bg-background">
                  <summary className="cursor-pointer px-3 py-2 text-xs text-muted-foreground hover:text-foreground select-none">
                    Substituir manualmente a chave privada (avançado)
                  </summary>
                  <div className="p-3 border-t border-border space-y-2">
                    <textarea
                      value={privKey} rows={5}
                      onChange={(e) => setPrivKey(e.target.value)}
                      placeholder={'-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----'}
                      className="w-full px-3 py-2 rounded border border-input bg-background text-xs font-mono resize-y"
                    />
                    <p className="text-xs text-warning flex items-start gap-1">
                      <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                      Colar uma nova chave privada substituirá a atual. Para rotação segura, prefira o botão "Regerar chaves" acima.
                    </p>
                  </div>
                </details>
              )}
            </div>
          ) : (
            <>
              <textarea
                value={privKey} disabled={certified} rows={5}
                onChange={(e) => setPrivKey(e.target.value)}
                placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                className="w-full px-3 py-2 rounded border border-input bg-background text-xs font-mono disabled:opacity-60 resize-y"
              />
              <p className="mt-1 text-xs text-muted-foreground">Use o botão "Gerar chaves automaticamente" para criar um par RSA seguro, ou cole aqui a sua chave privada PEM.</p>
            </>
          )}
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Modo SAF-T <span className="text-muted-foreground/70">(guarda automaticamente)</span></label>
          <div className="flex gap-2">
            {(['teste', 'oficial'] as const).map((m) => (
              <button key={m} type="button"
                onClick={() => saveSaftMode(m)}
                className={`px-4 py-2 rounded border text-sm font-medium transition-colors ${saftModo === m ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:bg-secondary'}`}
              >{m === 'teste' ? 'Teste' : 'Oficial'}</button>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            <strong>Teste</strong>: <code>SourceBilling=T</code> no XML (não oficial).{' '}
            <strong>Oficial</strong>: <code>SourceBilling=P</code> (produção AGT).
          </p>
          {certified && saftModo === 'teste' && (
            <p className="mt-1 text-xs text-warning">Sistema certificado mas SAF-T em modo de teste — os ficheiros exportados não são oficiais.</p>
          )}
        </div>

        <div className="pt-3 border-t space-y-3">
          {dirty && !certified && (
            <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              Tem alterações por guardar. Clique em <strong>Guardar alterações</strong> — ou <strong>Ativar modo certificado</strong> (que guarda automaticamente antes de ativar).
            </div>
          )}
          <div className="flex flex-wrap gap-2 justify-between">
            <button onClick={() => save()} disabled={saving || !dirty}
              className={`justify-center h-10 disabled:opacity-60 ${dirty ? 'ms-btn-primary' : 'inline-flex items-center gap-2 px-4 rounded border border-border text-sm bg-secondary text-foreground'}`}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> {dirty ? 'Guardar alterações' : 'Sem alterações'}</>}
            </button>
            {!certified && (
              <button onClick={startActivation} disabled={!canActivateLocally || saving || activating}
                title={!canActivateLocally ? `Faltam: ${localReadinessErrors.join(', ')}` : 'Ativa permanentemente o modo certificado'}
                className="inline-flex items-center gap-2 px-4 h-10 rounded bg-success text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90">
                {saving || activating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                Ativar modo certificado
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Double-confirmation modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-lg shadow-xl max-w-md w-full p-6">
            {step === 1 ? (
              <>
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-warning/20 flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="w-5 h-5 text-warning" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Ação irreversível</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Ativar o modo certificado vai:
                    </p>
                  </div>
                </div>
                <ul className="text-sm space-y-2 mb-4 list-disc pl-5">
                  <li>Alterar o estado para <strong>Certificado</strong> (não reversível)</li>
                  <li>Mudar o SAF-T para modo <strong>Oficial</strong></li>
                  <li>Bloquear para sempre a edição do número de certificado, datas e chaves</li>
                  <li>Registar a ativação nos logs de auditoria (quem, quando)</li>
                </ul>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setConfirmOpen(false)} className="px-4 h-10 rounded border border-border text-sm">Cancelar</button>
                  <button onClick={() => setStep(2)} className="px-4 h-10 rounded bg-warning text-white text-sm font-semibold">Continuar</button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center flex-shrink-0">
                    <Lock className="w-5 h-5 text-destructive" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Confirmação final</h3>
                    <p className="text-sm text-muted-foreground mt-1">Escreva exatamente <strong>CERTIFICAR</strong> para confirmar:</p>
                  </div>
                </div>
                <input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="CERTIFICAR"
                  className="w-full h-11 px-3 rounded border border-input bg-background text-sm font-mono mb-4"
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => { setConfirmOpen(false); setConfirmText(''); setStep(1); }} className="px-4 h-10 rounded border border-border text-sm">Cancelar</button>
                  <button
                    onClick={activate}
                    disabled={confirmText !== 'CERTIFICAR' || activating}
                    className="px-4 h-10 rounded bg-success text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    {activating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} Ativar agora
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {regenConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setRegenConfirmOpen(false)}>
          <div className="bg-card border border-border rounded-lg shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Regerar chaves RSA?</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  As chaves atuais serão <strong>substituídas</strong> por um novo par RSA 2048 bits. Qualquer assinatura digital feita anteriormente deixará de ser validável com as novas chaves.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setRegenConfirmOpen(false)} className="px-4 h-10 rounded border border-border text-sm">Cancelar</button>
              <button onClick={() => generateKeys(true)} disabled={generating}
                className="px-4 h-10 rounded bg-destructive text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-2">
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />} Regerar agora
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
