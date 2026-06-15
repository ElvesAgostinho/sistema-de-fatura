'use client';

import { useState } from 'react';
import { FileDown, Loader2, Info, ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

type Severity = 'error' | 'warning' | 'info';
type Issue = { code: string; severity: Severity; message: string; context?: any };
type Report = {
  level: 'NAO_APTO' | 'APTO_COM_AJUSTES' | 'APTO_PARA_AUDITORIA';
  errors: number;
  warnings: number;
  infos: number;
  issues: Issue[];
  stats: {
    invoices: number;
    clients: number;
    products: number;
    totalCredit: number;
    totalDebit: number;
    totalTax: number;
    hashChainValid: boolean;
    hashCoverage: number;
    signatureCoverage: number;
  };
};

export default function SaftExportPanel() {
  const year = new Date().getUTCFullYear();
  const [from, setFrom] = useState(`${year}-01-01`);
  const [to, setTo] = useState(`${year}-12-31`);
  const [downloading, setDownloading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [report, setReport] = useState<Report | null>(null);

  const [downloadingInv, setDownloadingInv] = useState(false);
  const [invYear, setInvYear] = useState(year);

  const downloadInventory = async () => {
    setDownloadingInv(true);
    try {
      const r = await fetch(`/api/fiscal-config/saft-inventory?year=${invYear}`);
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        toast.error(j?.error ?? 'Falha a gerar ficheiro de Inventários');
        return;
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cd = r.headers.get('Content-Disposition') ?? '';
      const m = cd.match(/filename="?([^"]+)"?/);
      a.download = m?.[1] ?? `SAFT_AO_INVENTARIOS_${invYear}.xml`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Ficheiro de Inventários gerado com sucesso');
    } catch {
      toast.error('Erro de rede');
    } finally { setDownloadingInv(false); }
  };

  const validate = async () => {
    setValidating(true);
    setReport(null);
    try {
      const r = await fetch(`/api/fiscal-config/saft?from=${from}&to=${to}&validate=1`);
      const j = await r.json();
      if (!r.ok) {
        toast.error(j?.error ?? 'Falha na validação');
        return;
      }
      setReport(j.report as Report);
      const lvl = j.report.level;
      if (lvl === 'APTO_PARA_AUDITORIA') toast.success('✔ SAF-T apto para auditoria');
      else if (lvl === 'APTO_COM_AJUSTES') toast.warning('SAF-T exportável, com avisos');
      else toast.error('SAF-T não apto — corrija os erros');
    } catch {
      toast.error('Erro de rede');
    } finally { setValidating(false); }
  };

  const download = async () => {
    setDownloading(true);
    try {
      const r = await fetch(`/api/fiscal-config/saft?from=${from}&to=${to}`);
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        toast.error(j?.error ?? 'Falha a gerar SAF-T');
        if (j?.report) setReport(j.report as Report);
        return;
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cd = r.headers.get('Content-Disposition') ?? '';
      const m = cd.match(/filename="?([^"]+)"?/);
      a.download = m?.[1] ?? `SAFT_AO_${from}_${to}.xml`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      const level = r.headers.get('X-SAFT-Level');
      toast.success(`SAF-T gerado${level ? ` · ${level.replace(/_/g, ' ')}` : ''}`);
    } catch {
      toast.error('Erro de rede');
    } finally { setDownloading(false); }
  };

  const presets: Array<{ label: string; from: string; to: string }> = [];
  for (let y = year; y >= year - 2; y--) {
    presets.push({ label: `Ano ${y}`, from: `${y}-01-01`, to: `${y}-12-31` });
  }
  const now = new Date();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const lastDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  presets.push({ label: `Mês atual (${m}/${year})`, from: `${year}-${m}-01`, to: `${year}-${m}-${String(lastDay).padStart(2, '0')}` });

  const blocked = report?.level === 'NAO_APTO';

  const levelColor = (lvl?: string) => {
    if (lvl === 'APTO_PARA_AUDITORIA') return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (lvl === 'APTO_COM_AJUSTES') return 'text-amber-700 bg-amber-50 border-amber-200';
    if (lvl === 'NAO_APTO') return 'text-red-700 bg-red-50 border-red-200';
    return 'text-muted-foreground';
  };
  const levelLabel = (lvl?: string) => {
    if (lvl === 'APTO_PARA_AUDITORIA') return 'APTO PARA AUDITORIA';
    if (lvl === 'APTO_COM_AJUSTES') return 'APTO COM AJUSTES';
    if (lvl === 'NAO_APTO') return 'NÃO APTO';
    return lvl ?? '';
  };
  const levelIcon = (lvl?: string) => {
    if (lvl === 'APTO_PARA_AUDITORIA') return <ShieldCheck className="w-4 h-4" />;
    if (lvl === 'APTO_COM_AJUSTES') return <AlertTriangle className="w-4 h-4" />;
    if (lvl === 'NAO_APTO') return <ShieldAlert className="w-4 h-4" />;
    return <Info className="w-4 h-4" />;
  };
  const sevIcon = (s: Severity) =>
    s === 'error' ? <XCircle className="w-4 h-4 text-red-600" />
    : s === 'warning' ? <AlertTriangle className="w-4 h-4 text-amber-600" />
    : <Info className="w-4 h-4 text-sky-600" />;

  return (
    <div className="space-y-4">
      <div className="ms-card p-6 space-y-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2"><FileDown className="w-4 h-4 text-primary" />Exportação SAF-T (AO)</h3>
          <p className="text-sm text-muted-foreground mt-1">Gera o XML SAF-T oficial para entrega à AGT. Antes do download pode <strong>validar</strong> o ficheiro para confirmar conformidade fiscal.</p>
        </div>

        <div className="flex items-start gap-2 p-3 bg-primary/5 border border-primary/20 rounded text-sm">
          <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <div className="text-muted-foreground">
            O ficheiro inclui cabeçalho fiscal, clientes, produtos, tabela de impostos e todas as faturas do período (emitidas e anuladas), com hashes SHA-256 encadeados e assinaturas digitais RSA-SHA256 quando presentes.
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">De</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-full h-10 px-3 rounded border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Até</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-full h-10 px-3 rounded border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {presets.map(p => (
            <button key={p.label} onClick={() => { setFrom(p.from); setTo(p.to); setReport(null); }} className="text-xs px-3 py-1.5 rounded border border-border hover:bg-secondary">
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <button onClick={validate} disabled={validating} className="inline-flex items-center gap-2 px-4 h-10 text-sm rounded border border-primary text-primary hover:bg-primary/5 disabled:opacity-60">
            {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            {validating ? 'Validando...' : 'Validar antes de exportar'}
          </button>
          <button onClick={download} disabled={downloading || blocked} className="ms-btn-primary disabled:opacity-60" title={blocked ? 'Corrija os erros antes de exportar' : ''}>
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            {downloading ? 'Gerando...' : 'Gerar SAF-T (.xml)'}
          </button>
        </div>
      </div>

      {report && (
        <div className="ms-card p-6 space-y-4">
          <div className={`p-3 border rounded flex items-center justify-between ${levelColor(report.level)}`}>
            <div className="flex items-center gap-2 font-semibold">
              {levelIcon(report.level)} {levelLabel(report.level)}
            </div>
            <div className="text-xs">
              {report.errors} erro(s) · {report.warnings} aviso(s) · {report.infos} info
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Stat label="Faturas" value={report.stats.invoices} />
            <Stat label="Clientes" value={report.stats.clients} />
            <Stat label="Produtos" value={report.stats.products} />
            <Stat label="Cadeia hash" value={report.stats.hashChainValid ? '✔ válida' : '✘ inválida'} ok={report.stats.hashChainValid} />
            <Stat label="Cobertura hash" value={`${Math.round(report.stats.hashCoverage * 100)}%`} ok={report.stats.hashCoverage >= 0.99} />
            <Stat label="Assinatura digital" value={`${Math.round(report.stats.signatureCoverage * 100)}%`} />
            <Stat label="Total crédito (Kz)" value={report.stats.totalCredit.toFixed(2)} />
            <Stat label="Total débito (Kz)" value={report.stats.totalDebit.toFixed(2)} />
          </div>

          {report.issues.length > 0 && (
            <div>
              <div className="text-sm font-semibold mb-2">Ocorrências</div>
              <div className="border rounded divide-y max-h-80 overflow-auto">
                {report.issues.map((i, idx) => (
                  <div key={idx} className="p-3 flex gap-3 text-sm">
                    <div className="mt-0.5">{sevIcon(i.severity)}</div>
                    <div className="flex-1">
                      <div className="font-medium">{i.message}</div>
                      <div className="text-xs text-muted-foreground font-mono">{i.code}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {report.level === 'APTO_PARA_AUDITORIA' && report.issues.length === 0 && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded text-sm text-emerald-700">
              <CheckCircle2 className="w-4 h-4" /> Ficheiro totalmente conforme — pronto para auditoria AGT.
            </div>
          )}
        </div>
      )}

      <div className="ms-card p-6 space-y-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2"><FileDown className="w-4 h-4 text-primary" />Comunicação de Inventários (Stocks)</h3>
          <p className="text-sm text-muted-foreground mt-1">Gera o ficheiro XML oficial de inventários com as quantidades e valorização do stock para entrega anual à AGT.</p>
        </div>
        
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded text-sm">
          <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-amber-800">
            Apenas produtos com stock superior a zero são declarados. Se não tiver stock, o ficheiro será automaticamente gerado com a declaração "Sem Existências" (conforme obrigatoriedade legal).
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Ano Fiscal</label>
            <select value={invYear} onChange={e => setInvYear(Number(e.target.value))} className="w-40 h-10 px-3 rounded border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              {Array.from({length: 5}, (_, i) => year - i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          
          <button onClick={downloadInventory} disabled={downloadingInv} className="ms-btn-primary disabled:opacity-60 flex-1 md:flex-none">
            {downloadingInv ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            {downloadingInv ? 'Gerando...' : 'Descarregar XML Inventário'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, ok }: { label: string; value: any; ok?: boolean }) {
  return (
    <div className="p-3 border rounded bg-secondary/30">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`font-semibold text-base ${ok === false ? 'text-red-600' : ok === true ? 'text-emerald-700' : ''}`}>{value}</div>
    </div>
  );
}
