'use client';

import { AlertTriangle, Loader2, X } from 'lucide-react';
import { useState } from 'react';

export default function ConfirmModal({ title, message, confirmLabel = 'Confirmar', onConfirm, onClose, destructive = true }: {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
  destructive?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const run = async () => {
    setLoading(true);
    try { await onConfirm(); } finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-md shadow-lg w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h3 className="font-semibold flex items-center gap-2">
            <AlertTriangle className={`w-4 h-4 ${destructive ? 'text-destructive' : 'text-primary'}`} /> {title}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-secondary rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-muted-foreground">{message}</p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 h-10 rounded border border-input bg-background text-sm font-medium hover:bg-secondary">Cancelar</button>
            <button type="button" onClick={run} disabled={loading} className={`px-4 h-10 rounded text-sm font-medium text-white disabled:opacity-60 ${destructive ? 'bg-destructive hover:bg-destructive/90' : 'bg-primary hover:bg-primary/90'}`}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
