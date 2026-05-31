'use client';

import { useState } from 'react';
import { Activity, Loader2, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface CheckResult {
  id: string;
  title: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  details?: any;
}

interface AuditResponse {
  classification: 'apt' | 'apt-with-risks' | 'not-apt';
  summary: { total: number; passes: number; warns: number; fails: number; invoicesAudited: number; totalInvoices: number };
  checks: CheckResult[];
  generatedAt: string;
}

const CLASSIF_BADGES: Record<AuditResponse['classification'], { label: string; className: string; icon: any }> = {
  'apt': { label: 'APTO PARA PRODUÇÃO', className: 'bg-success/10 text-success border-success/30', icon: CheckCircle2 },
  'apt-with-risks': { label: 'APTO COM RISCOS', className: 'bg-warning/10 text-warning-foreground border-warning/30', icon: AlertTriangle },
  'not-apt': { label: 'NÃO APTO', className: 'bg-destructive/10 text-destructive border-destructive/30', icon: XCircle },
};

export default function SystemAuditPanel() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AuditResponse | null>(null);

  const run = async () => {
    setRunning(true);
    setResult(null);
    try {
      const r = await fetch('/api/system-audit', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) {
        toast.error(j?.error ?? 'Falha na auditoria');
        return;
      }
      setResult(j as AuditResponse);
    } catch {
      toast.error('Erro de rede');
    } finally { setRunning(false); }
  };

  const classifBadge = result ? CLASSIF_BADGES[result.classification] : null;

  return (
    <div className="space-y-4">
      <div className="ms-card p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold flex items-center gap-2"><Activity className="w-4 h-4 text-primary" />Auditoria do sistema</h3>
            <p className="text-sm text-muted-foreground mt-1">Verificação automática de integridade fiscal, hashes encadeados, assinaturas digitais e conformidade com regras da AGT.</p>
          </div>
          <button onClick={run} disabled={running} className="ms-btn-primary disabled:opacity-60 flex-shrink-0">
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
            {running ? 'A auditar...' : 'Correr auditoria'}
          </button>
        </div>

        {result && classifBadge && (
          <>
            <div className={`border rounded p-4 flex items-center gap-3 ${classifBadge.className}`}>
              <classifBadge.icon className="w-6 h-6" />
              <div>
                <div className="font-bold text-lg">{classifBadge.label}</div>
                <div className="text-xs opacity-80">
                  {result.summary.passes} OK · {result.summary.warns} avisos · {result.summary.fails} falhas · {result.summary.invoicesAudited} de {result.summary.totalInvoices} faturas auditadas
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {result.checks.map(c => {
                const Icon = c.status === 'pass' ? CheckCircle2 : c.status === 'warn' ? AlertTriangle : XCircle;
                const color = c.status === 'pass' ? 'text-success' : c.status === 'warn' ? 'text-warning-foreground' : 'text-destructive';
                const bg = c.status === 'pass' ? 'bg-success/5 border-success/20' : c.status === 'warn' ? 'bg-warning/5 border-warning/20' : 'bg-destructive/5 border-destructive/20';
                return (
                  <div key={c.id} className={`border rounded p-3 flex items-start gap-3 ${bg}`}>
                    <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{c.title}</div>
                      <div className="text-sm text-muted-foreground mt-0.5">{c.message}</div>
                      {c.details && Object.keys(c.details).length > 0 && (
                        <details className="mt-1">
                          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">Detalhes</summary>
                          <pre className="text-xs font-mono mt-1 p-2 bg-background rounded overflow-x-auto">{JSON.stringify(c.details, null, 2)}</pre>
                        </details>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="text-xs text-muted-foreground text-right">Gerado em: {new Date(result.generatedAt).toLocaleString('pt-PT')}</div>
          </>
        )}
      </div>
    </div>
  );
}
