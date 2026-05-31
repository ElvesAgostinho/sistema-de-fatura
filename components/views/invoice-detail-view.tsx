'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Download, XCircle, CheckCircle2, ShieldCheck, ShieldAlert, Loader2, Ban, X as XIcon, FileSignature, AlertCircle, DollarSign, Mail, Trash2, Clock, Link2, Printer } from 'lucide-react';
import { formatAOA, formatDateTime } from '@/lib/utils';
import { toast } from 'sonner';
import CertBadge from '@/components/cert-badge';
import PaymentModal from '@/components/modals/payment-modal';
import ConfirmModal from '@/components/modals/confirm-modal';
import { useProfile } from '@/lib/hooks/use-profile';

type Payment = { id: string; amount: number; payment_date: string; method?: string; reference?: string; notes?: string };

const METHOD_LABELS: Record<string, string> = {
  transferencia: 'Transferência',
  numerario: 'Numerário',
  cheque: 'Cheque',
  multicaixa: 'Multicaixa',
  outro: 'Outro',
};

export default function InvoiceDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { isAdmin } = useProfile();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sigStatus, setSigStatus] = useState<{ signed: boolean; valid: boolean; reason?: string; checked: boolean }>({ signed: false, valid: false, checked: false });
  const [verifyingSig, setVerifyingSig] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<Payment | null>(null);
  const [emailSending, setEmailSending] = useState(false);
  const [showEmailConfirm, setShowEmailConfirm] = useState(false);
  const [linkGenerating, setLinkGenerating] = useState(false);

  const loadPayments = async () => {
    setLoadingPayments(true);
    try {
      const r = await fetch(`/api/payments?invoice_id=${id}`, { cache: 'no-store' });
      const j = await r.json();
      if (r.ok) setPayments(j.payments ?? []);
    } finally { setLoadingPayments(false); }
  };

  const verifySignature = async () => {
    setVerifyingSig(true);
    try {
      const r = await fetch(`/api/invoices/${id}/verify-signature`, { cache: 'no-store' });
      const j = await r.json();
      setSigStatus({ signed: !!j.signed, valid: !!j.valid, reason: j.reason, checked: true });
    } catch {
      setSigStatus({ signed: false, valid: false, reason: 'Erro na verificação', checked: true });
    } finally { setVerifyingSig(false); }
  };

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/invoices/${id}`, { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) { toast.error(j?.error ?? 'Erro'); return; }
      setData(j);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); loadPayments(); /* eslint-disable-next-line */ }, [id]);

  const onDeletePayment = async () => {
    if (!paymentToDelete) return;
    try {
      const r = await fetch(`/api/payments/${paymentToDelete.id}`, { method: 'DELETE' });
      if (!r.ok) { const j = await r.json().catch(() => ({})); toast.error(j?.error ?? 'Erro'); return; }
      toast.success('Pagamento removido');
      setPaymentToDelete(null);
      load(); loadPayments();
    } catch { toast.error('Erro ao remover pagamento'); }
  };

  const onSendEmail = async () => {
    setEmailSending(true);
    try {
      const r = await fetch(`/api/invoices/${id}/email`, { method: 'POST' });
      const j = await r.json();
      if (!r.ok) { toast.error(j?.error ?? 'Falha ao enviar email'); return; }
      toast.success('Factura enviada por email');
      setShowEmailConfirm(false);
    } catch { toast.error('Erro ao enviar email'); }
    finally { setEmailSending(false); }
  };

  const onDownloadPdf = async () => {
    toast.info('Gerando PDF...');
    try {
      const r = await fetch(`/api/invoices/${id}/pdf`);
      if (!r.ok) { toast.error('Falha PDF'); return; }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `${data?.invoice?.invoice_number?.replace(/[^a-zA-Z0-9]/g, '_') ?? 'invoice'}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch { toast.error('Erro PDF'); }
  };

  const onCopyLink = async () => {
    setLinkGenerating(true);
    try {
      const r = await fetch(`/api/invoices/${id}/public-link`, { method: 'POST' });
      const j = await r.json();
      if (!r.ok) { toast.error(j?.error ?? 'Falha ao gerar link'); return; }
      await navigator.clipboard.writeText(j.url);
      toast.success('Link copiado para a área de transferência!');
    } catch {
      toast.error('Erro ao gerar link');
    } finally {
      setLinkGenerating(false);
    }
  };

  const onCancel = async () => {
    if (reason.trim().length < 5) { toast.error('Motivo obrigatório (min 5 chars)'); return; }
    setSubmitting(true);
    try {
      const r = await fetch(`/api/invoices/${id}/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) });
      const j = await r.json();
      if (!r.ok) { toast.error(j?.error ?? 'Falha'); return; }
      toast.success('Fatura cancelada');
      setCancelOpen(false); setReason(''); load();
    } finally { setSubmitting(false); }
  };

  if (loading) return <div className="flex items-center justify-center p-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!data?.invoice) return <div className="p-10 text-center text-muted-foreground">Fatura não encontrada</div>;

  const inv = data.invoice;
  const company = data.company;
  const integrityValid = Boolean(data.integrityValid);
  const cancelled = inv.status === 'cancelled';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 rounded hover:bg-secondary"><ArrowLeft className="w-4 h-4" /></button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight font-mono">{inv.invoice_number}</h1>
              <CertBadge variant="inline" />
            </div>
            <p className="text-sm text-muted-foreground">Emitida em {formatDateTime(inv.issued_at)}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={onCopyLink} disabled={linkGenerating} className="px-4 py-2 rounded text-sm font-medium bg-secondary text-foreground hover:bg-secondary/80 inline-flex items-center gap-2">
            {linkGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />} Link público
          </button>
          <Link href={`/print/pos/${id}`} target="_blank" className="px-4 py-2 rounded text-sm font-medium bg-secondary text-foreground hover:bg-secondary/80 inline-flex items-center gap-2">
            <Printer className="w-4 h-4" /> Talão (POS)
          </Link>
          <Link href={`/print/a4/${id}`} target="_blank" className="px-4 py-2 rounded text-sm font-medium bg-secondary text-foreground hover:bg-secondary/80 inline-flex items-center gap-2">
            <Printer className="w-4 h-4" /> Imprimir A4
          </Link>
          <button onClick={onDownloadPdf} className="ms-btn-primary"><Download className="w-4 h-4" /> PDF</button>
          {!cancelled && <button onClick={() => setShowEmailConfirm(true)} className="px-4 py-2 rounded text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 inline-flex items-center gap-2"><Mail className="w-4 h-4" /> Enviar por email</button>}
          {!cancelled && inv.payment_status !== 'pago' && isAdmin && <button onClick={() => setShowPaymentModal(true)} className="px-4 py-2 rounded text-sm font-medium bg-success/10 text-success hover:bg-success/20 inline-flex items-center gap-2"><DollarSign className="w-4 h-4" /> Registar pagamento</button>}
          {!cancelled && isAdmin && <button onClick={() => setCancelOpen(true)} className="px-4 py-2 rounded text-sm font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 inline-flex items-center gap-2"><Ban className="w-4 h-4" /> Cancelar</button>}
        </div>
      </div>

      {/* Status & Integrity */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="ms-card p-4 flex items-center gap-3">
          {cancelled ? <XCircle className="w-8 h-8 text-destructive" /> : <CheckCircle2 className="w-8 h-8 text-success" />}
          <div>
            <div className="text-xs text-muted-foreground">Status</div>
            <div className="font-semibold">{cancelled ? 'Cancelada' : 'Emitida'}</div>
            {cancelled && inv.cancellation_reason && <div className="text-xs text-muted-foreground mt-1">{inv.cancellation_reason}</div>}
          </div>
        </div>
        <div className="ms-card p-4 flex items-center gap-3">
          {integrityValid ? <ShieldCheck className="w-8 h-8 text-success" /> : <ShieldAlert className="w-8 h-8 text-destructive" />}
          <div>
            <div className="text-xs text-muted-foreground">Integridade AGT</div>
            <div className="font-semibold">{integrityValid ? 'Hash válido' : 'Hash COMPROMETIDO'}</div>
            <div className="text-xs text-muted-foreground">SHA-256 encadeado</div>
          </div>
        </div>
      </div>

      {/* Partes */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="ms-card p-5">
          <h3 className="text-xs uppercase text-muted-foreground mb-2 font-semibold">Emitente</h3>
          <div className="font-semibold">{company?.name}</div>
          <div className="text-sm text-muted-foreground">NIF: <span className="font-mono">{company?.nif}</span></div>
          {company?.address && <div className="text-sm text-muted-foreground">{company.address}</div>}
        </div>
        <div className="ms-card p-5">
          <h3 className="text-xs uppercase text-muted-foreground mb-2 font-semibold">Cliente</h3>
          <div className="font-semibold">{inv.client_name}</div>
          <div className="text-sm text-muted-foreground">NIF: <span className="font-mono">{inv.client_nif}</span></div>
          {inv.client_address && <div className="text-sm text-muted-foreground">{inv.client_address}</div>}
        </div>
      </div>

      {/* Items */}
      <div className="ms-card overflow-hidden">
        <div className="px-5 py-3 border-b bg-secondary/40"><h3 className="font-semibold">Itens</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-muted-foreground border-b">
                <th className="py-2 px-4">#</th><th className="py-2 px-4">Descrição</th>
                <th className="py-2 px-4 text-right">Qtd</th><th className="py-2 px-4 text-right">Preço</th>
                <th className="py-2 px-4 text-right">IVA</th><th className="py-2 px-4 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {(inv.items ?? []).map((it: any, idx: number) => (
                <tr key={it.id} className="border-t">
                  <td className="py-2 px-4 text-muted-foreground">{idx + 1}</td>
                  <td className="py-2 px-4">{it.description}</td>
                  <td className="py-2 px-4 text-right font-mono">{Number(it.quantity).toFixed(3)}</td>
                  <td className="py-2 px-4 text-right font-mono">{formatAOA(it.price)}</td>
                  <td className="py-2 px-4 text-right font-mono text-xs">{Number(it.tax_rate).toFixed(2)}%</td>
                  <td className="py-2 px-4 text-right font-mono font-semibold">{formatAOA(it.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Totais */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-3">
          {inv.related_document && (
            <div className="ms-card p-4 bg-primary/5 border-l-4 border-primary">
              <div className="text-xs font-semibold uppercase text-primary mb-1">Documento relacionado</div>
              <div className="text-sm font-mono">{inv.related_document}</div>
            </div>
          )}
          {inv.tax_exemption_reason && (
            <div className="ms-card p-4 bg-warning/10 border-l-4 border-warning">
              <div className="text-xs font-semibold uppercase text-warning mb-1">Isenção de IVA</div>
              <div className="text-sm">{inv.tax_exemption_reason}</div>
            </div>
          )}
        </div>
        <div className="ms-card p-5">
          <div className="flex justify-between text-sm mb-1"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">{formatAOA(inv.subtotal)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">IVA</span><span className="font-mono">{formatAOA(inv.tax)}</span></div>
          <div className="h-px bg-border my-2" />
          <div className="flex justify-between text-lg font-bold"><span>Total</span><span className="font-mono text-primary">{formatAOA(inv.total)}</span></div>
          {!cancelled && (
            <>
              <div className="h-px bg-border my-2" />
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Recebido</span><span className="font-mono text-success">{formatAOA(Number(inv.amount_paid ?? 0))}</span></div>
              <div className="flex justify-between text-sm font-semibold"><span>Em dívida</span><span className="font-mono">{formatAOA(Math.max(0, Number(inv.total) - Number(inv.amount_paid ?? 0)))}</span></div>
              <div className="mt-2">
                {inv.payment_status === 'pago' && <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-success/10 text-success font-medium"><CheckCircle2 className="w-3 h-3" /> Pago</span>}
                {inv.payment_status === 'parcial' && <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-warning/10 text-warning font-medium"><Clock className="w-3 h-3" /> Pagamento parcial</span>}
                {(!inv.payment_status || inv.payment_status === 'pendente') && <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-destructive/10 text-destructive font-medium"><Clock className="w-3 h-3" /> Pendente</span>}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Payments section */}
      {!cancelled && (
        <div className="ms-card overflow-hidden">
          <div className="px-5 py-3 border-b bg-secondary/40 flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2"><DollarSign className="w-4 h-4 text-primary" /> Pagamentos recebidos</h3>
            {inv.payment_status !== 'pago' && <button onClick={() => setShowPaymentModal(true)} className="text-xs px-3 py-1 rounded bg-primary text-primary-foreground font-medium hover:bg-primary/90">+ Registar</button>}
          </div>
          {loadingPayments ? (
            <div className="p-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : payments.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Nenhum pagamento registado ainda.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-muted-foreground border-b">
                    <th className="py-2 px-4">Data</th>
                    <th className="py-2 px-4">Método</th>
                    <th className="py-2 px-4">Referência</th>
                    <th className="py-2 px-4 text-right">Valor</th>
                    <th className="py-2 px-4 text-right">Acção</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-t">
                      <td className="py-2 px-4 font-mono">{new Date(p.payment_date).toLocaleDateString('pt-PT')}</td>
                      <td className="py-2 px-4">{METHOD_LABELS[p.method ?? 'outro'] ?? p.method ?? '-'}</td>
                      <td className="py-2 px-4 text-muted-foreground text-xs">{p.reference ?? '-'}</td>
                      <td className="py-2 px-4 text-right font-mono font-semibold text-success">{formatAOA(Number(p.amount))}</td>
                      <td className="py-2 px-4 text-right">
                        <button onClick={() => setPaymentToDelete(p)} className="p-1.5 rounded hover:bg-destructive/10 text-destructive" title="Remover pagamento"><Trash2 className="w-3.5 h-3.5" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Digital signature */}
      <div className="ms-card p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="font-semibold flex items-center gap-2"><FileSignature className="w-4 h-4 text-primary" />Assinatura digital (RSA-SHA256)</h3>
          <button
            onClick={verifySignature}
            disabled={verifyingSig}
            className="text-xs px-3 py-1.5 rounded border border-border hover:bg-secondary inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            {verifyingSig ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
            Verificar agora
          </button>
        </div>
        {!inv.signature && (
          <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/30 rounded text-sm">
            <AlertCircle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium">Fatura sem assinatura digital</div>
              <div className="text-xs text-muted-foreground mt-0.5">Esta fatura foi emitida antes de as chaves RSA estarem configuradas. Documentos emitidos a partir de agora serão assinados automaticamente.</div>
            </div>
          </div>
        )}
        {inv.signature && (
          <div className="space-y-3">
            {sigStatus.checked ? (
              <div className={`flex items-start gap-2 p-3 rounded text-sm border ${sigStatus.valid ? 'bg-success/10 border-success/30' : 'bg-destructive/10 border-destructive/30'}`}>
                {sigStatus.valid ? <ShieldCheck className="w-4 h-4 text-success flex-shrink-0 mt-0.5" /> : <ShieldAlert className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />}
                <div>
                  <div className="font-medium">{sigStatus.valid ? 'Assinatura válida ✓' : 'Assinatura inválida'}</div>
                  {sigStatus.reason && <div className="text-xs text-muted-foreground mt-0.5">{sigStatus.reason}</div>}
                </div>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">Clica em <strong>Verificar agora</strong> para executar a verificação criptográfica com a chave pública atual.</div>
            )}
            <div>
              <div className="text-xs text-muted-foreground mb-1">Assinatura (base64, RSA-SHA256)</div>
              <div className="font-mono text-xs p-3 bg-secondary rounded break-all max-h-32 overflow-y-auto">{inv.signature}</div>
            </div>
          </div>
        )}
      </div>

      {/* Hashes */}
      <div className="ms-card p-5">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary" />Trilha de integridade</h3>
        <div className="space-y-3">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Hash desta fatura (SHA-256)</div>
            <div className="font-mono text-xs p-3 bg-secondary rounded break-all">{inv.hash}</div>
          </div>
          {inv.previous_hash && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">Hash anterior (encadeamento)</div>
              <div className="font-mono text-xs p-3 bg-secondary rounded break-all">{inv.previous_hash}</div>
            </div>
          )}
        </div>
      </div>

      {showPaymentModal && (
        <PaymentModal
          invoice={{ id: inv.id, invoice_number: inv.invoice_number, total: inv.total, amount_paid: inv.amount_paid }}
          onClose={() => setShowPaymentModal(false)}
          onSaved={() => { setShowPaymentModal(false); load(); loadPayments(); }}
        />
      )}

      {paymentToDelete && (
        <ConfirmModal
          title="Remover pagamento"
          message={`Tem certeza que deseja remover este pagamento de ${formatAOA(Number(paymentToDelete.amount))}?`}
          confirmLabel="Remover"
          destructive
          onClose={() => setPaymentToDelete(null)}
          onConfirm={onDeletePayment}
        />
      )}

      {showEmailConfirm && (
        <ConfirmModal
          title="Enviar factura por email"
          message={`Deseja enviar a factura ${inv.invoice_number} por email ao cliente? Será enviada para o endereço registado.`}
          confirmLabel={emailSending ? 'A enviar...' : 'Enviar email'}
          destructive={false}
          onClose={() => !emailSending && setShowEmailConfirm(false)}
          onConfirm={onSendEmail}
        />
      )}

      {cancelOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setCancelOpen(false)}>
          <div className="bg-card rounded-md shadow-lg w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h3 className="font-semibold text-destructive">Cancelar fatura</h3>
              <button onClick={() => setCancelOpen(false)} className="p-1 hover:bg-secondary rounded"><XIcon className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-muted-foreground">Esta ação não poderá ser revertida. A fatura será marcada como cancelada mas permanecerá registada (compliance AGT).</p>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Motivo (obrigatório)</label>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="w-full px-3 py-2 rounded border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Ex: Erro no valor cobrado" />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setCancelOpen(false)} className="px-4 py-2 rounded text-sm font-medium hover:bg-secondary">Voltar</button>
                <button onClick={onCancel} disabled={submitting} className="px-4 py-2 rounded text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60 inline-flex items-center gap-2">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Ban className="w-4 h-4" /> Cancelar fatura</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
