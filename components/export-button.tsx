'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, ChevronDown, Loader2, FileSpreadsheet, FileType } from 'lucide-react';
import { exportCsv, exportXlsx, stampedFilename, type ExportColumn } from '@/lib/export';
import { toast } from 'sonner';

type Props<T> = {
  rows: T[] | undefined | null;
  columns: ExportColumn<T>[];
  filenameBase: string;
  sheetName?: string;
  disabled?: boolean;
  compact?: boolean;
};

export default function ExportButton<T>({ rows, columns, filenameBase, sheetName = 'Dados', disabled, compact }: Props<T>) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<'csv' | 'xlsx' | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const count = Array.isArray(rows) ? rows.length : 0;
  const isEmpty = disabled || count === 0;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleCsv = async () => {
    if (!rows) return;
    setBusy('csv');
    try {
      exportCsv(rows, columns, stampedFilename(filenameBase, 'csv'));
      toast.success(`${count} registos exportados (CSV)`);
      setOpen(false);
    } catch (e: any) { toast.error(e?.message ?? 'Falha ao exportar CSV'); }
    finally { setBusy(null); }
  };

  const handleXlsx = async () => {
    if (!rows) return;
    setBusy('xlsx');
    try {
      await exportXlsx(rows, columns, stampedFilename(filenameBase, 'xlsx'), sheetName);
      toast.success(`${count} registos exportados (Excel)`);
      setOpen(false);
    } catch (e: any) { toast.error(e?.message ?? 'Falha ao exportar Excel'); }
    finally { setBusy(null); }
  };

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={isEmpty}
        title={isEmpty ? 'Sem dados para exportar' : 'Exportar dados'}
        className={`inline-flex items-center gap-2 px-4 h-10 rounded border border-border bg-background text-sm font-medium hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed ${compact ? 'h-9 px-3' : ''}`}
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        Exportar
        <ChevronDown className="w-3.5 h-3.5 opacity-60" />
      </button>
      {open && !isEmpty && (
        <div className="absolute right-0 mt-1 w-48 rounded border border-border bg-popover shadow-lg z-30 py-1 text-sm">
          <button onClick={handleCsv} disabled={!!busy} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-secondary disabled:opacity-60">
            <FileType className="w-4 h-4 text-muted-foreground" /> CSV (.csv)
          </button>
          <button onClick={handleXlsx} disabled={!!busy} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-secondary disabled:opacity-60">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Excel (.xlsx)
          </button>
          <div className="border-t my-1" />
          <div className="px-3 py-1.5 text-[11px] text-muted-foreground">{count} registo{count === 1 ? '' : 's'} exportáveis</div>
        </div>
      )}
    </div>
  );
}
