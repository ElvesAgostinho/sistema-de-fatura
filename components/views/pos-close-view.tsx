'use client';

import { useResource } from '@/lib/hooks/use-resource';
import { formatAOA } from '@/lib/utils';
import { Calculator, Printer, Banknote, RefreshCw } from 'lucide-react';
import { useProfile } from '@/lib/hooks/use-profile';

export default function PosCloseView() {
  const { data, loading, reload } = useResource<any>('/api/pos-close');
  const { profile } = useProfile();

  if (loading && !data) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">A carregar fecho do dia...</div>;
  }

  const printTicket = () => {
    window.print();
  };

  const today = new Date().toLocaleDateString('pt-PT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="max-w-2xl mx-auto space-y-6 print:m-0 print:max-w-full">
      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fecho de Caixa</h1>
          <p className="text-sm text-muted-foreground capitalize">{today}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => reload()} className="p-2 border border-border rounded-md hover:bg-secondary">
            <RefreshCw className="w-5 h-5" />
          </button>
          <button onClick={printTicket} className="ms-btn-primary flex items-center gap-2">
            <Printer className="w-4 h-4" /> Imprimir Talão
          </button>
        </div>
      </div>

      <div className="ms-card p-6 bg-white text-black print:border-none print:shadow-none print:p-0 font-mono">
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold uppercase">FECHO DIÁRIO</h2>
          <div className="text-sm text-gray-500">{today}</div>
          <div className="text-xs mt-2 text-gray-400">Operador: {profile?.email}</div>
        </div>

        <div className="space-y-4">
          <div className="border-t border-b border-dashed border-gray-300 py-3 space-y-2">
            <div className="flex justify-between font-bold">
              <span>Faturas Emitidas:</span>
              <span>{data?.invoices?.total_issued || 0}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Faturas Anuladas:</span>
              <span>{data?.invoices?.total_cancelled || 0}</span>
            </div>
            <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-100">
              <span>Total Faturado:</span>
              <span>{formatAOA(data?.invoices?.total_amount || 0)}</span>
            </div>
          </div>

          <div className="py-2">
            <h3 className="font-bold mb-3 flex items-center gap-2 uppercase text-sm"><Banknote className="w-4 h-4"/> Recebimentos em Caixa</h3>
            
            <div className="space-y-2 text-sm pl-2">
              <div className="flex justify-between">
                <span>Dinheiro (Numerário):</span>
                <span className="font-bold">{formatAOA(data?.payments?.breakdown?.Dinheiro || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Multicaixa (TPA):</span>
                <span className="font-bold">{formatAOA(data?.payments?.breakdown?.Multicaixa || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Transferência:</span>
                <span className="font-bold">{formatAOA(data?.payments?.breakdown?.Transferência || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Cheque / Outro:</span>
                <span className="font-bold">{formatAOA((data?.payments?.breakdown?.Cheque || 0) + (data?.payments?.breakdown?.Outro || 0))}</span>
              </div>
            </div>
          </div>

          <div className="border-t border-dashed border-gray-300 pt-4 pb-2">
            <div className="flex justify-between font-black text-xl">
              <span>TOTAL RECEBIDO:</span>
              <span>{formatAOA(data?.payments?.total_received || 0)}</span>
            </div>
            <div className="text-center text-xs text-gray-500 mt-6">
              Este documento não serve de fatura.
              <br/>
              Gerado pelo FaturaAO
            </div>
          </div>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; }
          .ms-card, .ms-card * { visibility: visible; }
          .ms-card { position: absolute; left: 0; top: 0; width: 100%; border: none !important; box-shadow: none !important; }
          .no-print { display: none !important; }
        }
      `}} />
    </div>
  );
}
