'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { formatAOA } from '@/lib/utils';
import {
  Calculator, Printer, Banknote, RefreshCw, CheckCircle2,
  Clock, User, Monitor, TrendingUp, AlertTriangle, FileCheck,
} from 'lucide-react';
import { printReceiptFallback, printToThermal, isThermalConnected, type ReceiptData } from '@/lib/pos/thermal-printer';
import { toast } from 'sonner';

interface CloseData {
  session: {
    id: string; terminal_name: string; status: string;
    opening_balance: number; closing_balance: number;
    opened_at: string; closed_at: string | null;
    opened_by_email: string; notes: string | null;
    total_cash: number; total_multicaixa: number; total_tpa: number;
    total_credit: number; total_sales: number; sales_count: number;
  } | null;
  next_z_number: number;
  period: { from: string; to: string };
  invoices: { total_issued: number; total_cancelled: number; total_amount: number; subtotal: number; tax_total: number };
  payments: { total_received: number; breakdown: Record<string, number> };
  session_totals: { total_cash: number; total_multicaixa: number; total_tpa: number; total_credit: number; total_sales: number; sales_count: number };
  cash_events: { total_in: number; total_out: number };
  reconciliation: { opening_balance: number; closing_balance: number; expected_in_cash: number; difference: number };
}

const CERT_NUMBER = process.env.NEXT_PUBLIC_AGT_CERT_NUMBER ?? '';
const COMPANY_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME ?? 'FaturaAO';
const COMPANY_NIF  = process.env.NEXT_PUBLIC_COMPANY_NIF ?? '';

export default function PosCloseView() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');

  const [data, setData] = useState<CloseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [zNumber, setZNumber] = useState<number | null>(null);
  const [declaredCash, setDeclaredCash] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = sessionId ? `/api/pos-close?session_id=${sessionId}` : '/api/pos-close';
      const r = await fetch(url);
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setData(j);
    } catch (e: any) {
      toast.error(e.message ?? 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => { load(); }, [load]);

  const saveZReport = async () => {
    if (!data || saving || saved) return;
    setSaving(true);
    try {
      const sess = data.session;
      const st   = data.session_totals;
      const rec  = data.reconciliation;
      const body = {
        session_id:       sess?.id ?? null,
        terminal_name:    sess?.terminal_name ?? 'Caixa',
        opened_at:        sess?.opened_at ?? data.period.from,
        closed_at:        sess?.closed_at ?? new Date().toISOString(),
        opened_by_email:  sess?.opened_by_email ?? '',
        opening_balance:  rec.opening_balance,
        closing_balance:  Number(declaredCash) || 0,
        total_cash:       st.total_cash,
        total_multicaixa: st.total_multicaixa,
        total_tpa:        st.total_tpa,
        total_credit:     st.total_credit,
        total_sales:      st.total_sales,
        sales_count:      st.sales_count,
        tax_total:        data.invoices.tax_total,
        difference:       Number(declaredCash) - rec.expected_in_cash, // Server will recalculate securely
        notes:            sess?.notes,
      };
      const r = await fetch('/api/pos/z-report', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setSaved(true);
      setZNumber(j.data?.z_number ?? data.next_z_number);
      toast.success(`Z-Report Nº ${j.data?.z_number} guardado com sucesso!`);
    } catch (e: any) {
      toast.error(e.message ?? 'Erro ao guardar Z-Report');
    } finally {
      setSaving(false);
    }
  };

  const buildZReceiptData = (): ReceiptData | null => {
    if (!data) return null;
    const sess = data.session;
    const st   = data.session_totals;
    const rec  = data.reconciliation;
    const zNum = zNumber ?? data.next_z_number;
    return {
      companyName: COMPANY_NAME,
      companyNif:  COMPANY_NIF,
      invoiceNumber: `Z${String(zNum).padStart(4,'0')}`,
      issuedAt:      new Date().toISOString(),
      certificateNumber: CERT_NUMBER,
      items: [],
      subtotal: 0, tax: 0, total: 0,
      paymentMethod: '',
      zReport: {
        zNumber:       zNum,
        terminalName:  sess?.terminal_name ?? 'Caixa',
        openedAt:      sess?.opened_at ?? data.period.from,
        closedAt:      sess?.closed_at ?? new Date().toISOString(),
        openedByEmail: sess?.opened_by_email ?? '',
        openingBalance:  rec.opening_balance,
        closingBalance:  rec.closing_balance,
        totalCash:       st.total_cash,
        totalMulticaixa: st.total_multicaixa,
        totalTpa:        st.total_tpa,
        totalCredit:     st.total_credit,
        totalSales:      st.total_sales,
        salesCount:      st.sales_count,
        taxTotal:        data.invoices.tax_total,
        difference:      rec.difference,
      },
    };
  };

  const handlePrint = async () => {
    const receipt = buildZReceiptData();
    if (!receipt) return;
    if (isThermalConnected()) {
      const r = await printToThermal(receipt);
      if (!r.ok) { toast.error(r.error ?? 'Erro na impressora'); printReceiptFallback(receipt); }
      else toast.success('Impresso na impressora térmica!');
    } else {
      printReceiptFallback(receipt);
    }
  };

  const today = new Date().toLocaleDateString('pt-PT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const diff = data?.reconciliation?.difference ?? 0;
  const diffColor = diff === 0 ? 'text-emerald-600' : diff > 0 ? 'text-sky-600' : 'text-red-600';
  const diffIcon  = diff === 0 ? '✓' : diff > 0 ? '▲' : '▼';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">A carregar fecho de caixa…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 p-4 print:p-0 print:m-0 print:max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between no-print flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Calculator className="w-6 h-6 text-primary" /> Fecho de Caixa
          </h1>
          <p className="text-sm text-muted-foreground capitalize">{today}</p>
          {sessionId && data?.session && (
            <p className="text-xs text-primary font-mono mt-0.5">
              Sessão: {data.session.terminal_name} · {data.session.opened_by_email}
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={load} className="p-2 border border-border rounded-md hover:bg-secondary min-h-[44px] min-w-[44px] flex items-center justify-center" title="Atualizar">
            <RefreshCw className="w-5 h-5" />
          </button>
          {!saved && (
            <button 
              onClick={saveZReport} 
              disabled={saving || declaredCash === ''} 
              className="ms-btn-secondary flex items-center gap-2 min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileCheck className="w-4 h-4" />
              {saving ? 'A guardar…' : 'Confirmar Fecho Cego'}
            </button>
          )}
          {saved && (
            <span className="inline-flex items-center gap-1.5 text-emerald-600 font-medium text-sm px-3 py-2 bg-emerald-50 rounded-md border border-emerald-200">
              <CheckCircle2 className="w-4 h-4" /> Z-Report Nº {zNumber} guardado
            </span>
          )}
          <button onClick={handlePrint} className="ms-btn-primary flex items-center gap-2 min-h-[44px]">
            <Printer className="w-4 h-4" /> Imprimir Talão
          </button>
        </div>
      </div>

      {/* Session Info */}
      {data?.session && (
        <div className="ms-card p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 no-print">
          {[
            { icon: <Monitor className="w-4 h-4 text-sky-500" />, label: 'Terminal', value: data.session.terminal_name },
            { icon: <User className="w-4 h-4 text-purple-500" />, label: 'Operador', value: data.session.opened_by_email.split('@')[0] },
            { icon: <Clock className="w-4 h-4 text-amber-500" />, label: 'Abertura', value: new Date(data.session.opened_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) },
            { icon: <Clock className="w-4 h-4 text-red-400" />, label: 'Fecho', value: data.session.closed_at ? new Date(data.session.closed_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : '—' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              {item.icon}
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{item.label}</p>
                <p className="text-sm font-semibold truncate">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Printable Z-Report */}
      <div className="ms-card p-6 bg-white text-black print:border-none print:shadow-none print:p-2 font-mono text-sm">
        {/* Print Header */}
        <div className="text-center mb-4 print:mb-2">
          <div className="text-lg font-black uppercase">{COMPANY_NAME}</div>
          {COMPANY_NIF && <div className="text-xs text-gray-500">NIF: {COMPANY_NIF}</div>}
          <div className="border-t-2 border-black my-2" />
          <div className="text-base font-black uppercase">
            Z-REPORT Nº {String(zNumber ?? data?.next_z_number ?? 1).padStart(4, '0')}
          </div>
          <div className="text-xs text-gray-500">{today}</div>
          <div className="border-t-2 border-black my-2" />
        </div>

        <div className="space-y-3">
          {/* Sales Summary */}
          <div>
            <div className="font-bold text-xs uppercase tracking-wider mb-2 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> Resumo de Vendas
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Nº Transacções:</span>
                <span className="font-bold">{data?.session_totals?.sales_count ?? data?.invoices?.total_issued ?? 0}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Faturas Anuladas:</span>
                <span>{data?.invoices?.total_cancelled ?? 0}</span>
              </div>
            </div>
          </div>

          <div className="border-t border-dashed border-gray-300 pt-3">
            <div className="font-bold text-xs uppercase tracking-wider mb-2 flex items-center gap-1">
              <Banknote className="w-3.5 h-3.5" /> Movimentos de Gaveta
            </div>
            <div className="space-y-1 text-xs">
              {[
                { label: 'Dinheiro (Vendas)', value: data?.session_totals?.total_cash ?? 0 },
                { label: 'Multicaixa', value: data?.session_totals?.total_multicaixa ?? 0 },
                { label: 'TPA', value: data?.session_totals?.total_tpa ?? 0 },
                { label: 'Crédito / Outro', value: data?.session_totals?.total_credit ?? 0 },
              ].map((row, i) => (
                <div key={i} className="flex justify-between">
                  <span>{row.label}:</span>
                  <span className="font-bold">{formatAOA(row.value)}</span>
                </div>
              ))}
              <div className="border-t border-dashed border-gray-200 my-1 pt-1" />
              <div className="flex justify-between text-sky-600">
                <span>(+) Reforços de Caixa:</span>
                <span className="font-bold">{formatAOA(data?.cash_events?.total_in ?? 0)}</span>
              </div>
              <div className="flex justify-between text-red-600">
                <span>(-) Sangrias de Caixa:</span>
                <span className="font-bold">{formatAOA(data?.cash_events?.total_out ?? 0)}</span>
              </div>
            </div>
          </div>

          <div className="border-t-2 border-black pt-3">
            <div className="flex justify-between font-black text-base">
              <span>TOTAL VENDAS:</span>
              <span>{formatAOA(data?.session_totals?.total_sales ?? data?.invoices?.total_amount ?? 0)}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Base Tributável:</span>
              <span>{formatAOA(data?.invoices?.subtotal ?? 0)}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>IVA Total:</span>
              <span>{formatAOA(data?.invoices?.tax_total ?? 0)}</span>
            </div>
          </div>

          {/* Reconciliation - BLIND CLOSE */}
          <div className="border-t-2 border-black pt-3">
            <div className="font-bold text-xs uppercase tracking-wider mb-2">Reconciliação de Caixa</div>
            
            {!saved ? (
              <div className="space-y-4 text-xs no-print mb-4 p-4 border-2 border-dashed border-gray-300 rounded bg-gray-50">
                <div className="flex items-start gap-2 text-primary font-bold mb-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5" />
                  <div>
                    FECHO CEGO (BLIND CLOSE)
                    <div className="font-normal text-gray-500 mt-1">
                      Conte fisicamente o dinheiro na gaveta e digite o valor abaixo antes de fechar a sessão.
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-gray-700 font-bold mb-1">Total em Numerário na Gaveta (Kz)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-lg font-mono focus:ring-2 focus:ring-primary outline-none transition-shadow"
                    value={declaredCash}
                    onChange={(e) => setDeclaredCash(e.target.value)}
                  />
                </div>
                <div className="text-[10px] text-gray-400 mt-2 text-center">Os totais esperados serão revelados após confirmação do fecho.</div>
              </div>
            ) : (
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>Fundo de Abertura:</span>
                  <span>{formatAOA(data?.reconciliation?.opening_balance ?? 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>+ Dinheiro Recebido:</span>
                  <span>{formatAOA(data?.session_totals?.total_cash ?? 0)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>= Esperado em Caixa:</span>
                  <span>{formatAOA(data?.reconciliation?.expected_in_cash ?? 0)}</span>
                </div>
                <div className="flex justify-between text-primary font-bold">
                  <span>Dinheiro Declarado:</span>
                  <span>{formatAOA(Number(declaredCash))}</span>
                </div>
                <div className={`flex justify-between font-black text-sm pt-1 border-t border-gray-200 ${Number(declaredCash) - (data?.reconciliation?.expected_in_cash ?? 0) === 0 ? 'text-emerald-600' : Number(declaredCash) - (data?.reconciliation?.expected_in_cash ?? 0) > 0 ? 'text-sky-600' : 'text-red-600'}`}>
                  <span>Diferença:</span>
                  <span>{formatAOA(Number(declaredCash) - (data?.reconciliation?.expected_in_cash ?? 0))}</span>
                </div>
              </div>
            )}
          </div>

          {/* AGT Footer */}
          <div className="border-t-2 border-black pt-3 text-center text-[10px] text-gray-500 space-y-0.5">
            <div className="font-bold text-black text-xs">DOCUMENTO PROCESSADO POR PROGRAMA CERTIFICADO</div>
            {CERT_NUMBER && <div>Certificado AGT Nr {CERT_NUMBER}</div>}
            <div>FaturaAO · rapido.topconsultores.pt</div>
            <div className="text-[9px] mt-1">Este documento não substitui fatura fiscal</div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; }
          .ms-card, .ms-card * { visibility: visible; }
          .ms-card { position: absolute; left: 0; top: 0; width: 80mm; border: none !important; box-shadow: none !important; font-size: 11px; }
          .no-print { display: none !important; }
          @page { size: 80mm auto; margin: 0; }
        }
      `}} />
    </div>
  );
}
