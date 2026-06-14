'use client';

import { useEffect, useState } from 'react';
import { Loader2, Save, Receipt } from 'lucide-react';
import { toast } from 'sonner';

export default function BillingRulesPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    default_retention_rate: 6.5,
    default_tax_exemption_reason: '',
  });

  useEffect(() => {
    fetch('/api/fiscal-config')
      .then(r => r.json())
      .then(j => {
        if (j.config) {
          setConfig({
            default_retention_rate: j.config.default_retention_rate ?? 6.5,
            default_tax_exemption_reason: j.config.default_tax_exemption_reason ?? '',
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch('/api/fiscal-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!r.ok) {
        const j = await r.json();
        if (r.status === 400 && j.error?.includes('Nenhuma altera')) {
          toast.success('Regras de faturação guardadas');
          return;
        }
        toast.error(j.error || 'Erro ao guardar');
        return;
      }
      toast.success('Regras de faturação guardadas ✓');
    } catch (e) {
      toast.error('Erro de ligação');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-10">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Receipt className="w-5 h-5 text-primary" />
          Regras de Faturação
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Defina as taxas predefinidas e os motivos de isenção que aparecem automaticamente ao emitir novos documentos.
        </p>
      </div>

      <div className="ms-card p-5 space-y-5">
        <div>
          <label className="text-sm font-medium mb-1.5 block">Taxa de Retenção na Fonte (IRT %)</label>
          <input
            type="number"
            step="0.01"
            value={config.default_retention_rate}
            onChange={e => setConfig(p => ({ ...p, default_retention_rate: parseFloat(e.target.value) || 0 }))}
            className="w-full max-w-xs h-10 px-3 rounded border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <p className="text-xs text-muted-foreground mt-1">A taxa padrão aplicada quando opta por reter o imposto (ex: 6.5%).</p>
        </div>

        <div>
          <label className="text-sm font-medium mb-1.5 block">Motivo de Isenção de IVA (Padrão)</label>
          <input
            type="text"
            value={config.default_tax_exemption_reason}
            onChange={e => setConfig(p => ({ ...p, default_tax_exemption_reason: e.target.value }))}
            placeholder="Ex: Regime de Exclusão - Art. X"
            className="w-full max-w-md h-10 px-3 rounded border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <p className="text-xs text-muted-foreground mt-1">Preenchido automaticamente quando seleciona "Fatura com isenção de IVA".</p>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={save} disabled={saving} className="ms-btn-primary min-w-[120px]">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Guardar Regras</>}
        </button>
      </div>
    </div>
  );
}
