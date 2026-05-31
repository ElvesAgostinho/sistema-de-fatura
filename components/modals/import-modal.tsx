'use client';

import { useRef, useState } from 'react';
import { Upload, X, Loader2, CheckCircle2, AlertCircle, FileSpreadsheet, Download } from 'lucide-react';
import { toast } from 'sonner';

type ImportResult = {
  format: string;
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; nif?: string | null; name?: string | null; reason: string }[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  /** e.g. '/api/clients/import' */
  endpoint: string;
  /** 'clientes' | 'produtos' */
  entityLabel: string;
  /** CSV column headers for the example file */
  templateHeaders: string[];
  /** Example data row (same order as headers) */
  templateExample: string[];
  /** Friendly description */
  description: string;
};

export default function ImportModal({ open, onClose, onDone, endpoint, entityLabel, templateHeaders, templateExample, description }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [upsert, setUpsert] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  if (!open) return null;

  const onFile = (f: File | null) => {
    setFile(f);
    setResult(null);
  };

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch(`${endpoint}?upsert=${upsert}`, { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) {
        toast.error(j?.error ?? `Falha na importação de ${entityLabel}`);
        return;
      }
      setResult(j);
      const { created = 0, updated = 0, skipped = 0 } = j as ImportResult;
      if (created + updated === 0 && skipped > 0) {
        toast.warning(`Nenhum registo importado. ${skipped} ignorado${skipped > 1 ? 's' : ''}.`);
      } else {
        toast.success(`${created} criado${created !== 1 ? 's' : ''}, ${updated} atualizado${updated !== 1 ? 's' : ''}, ${skipped} ignorado${skipped !== 1 ? 's' : ''}`);
      }
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro desconhecido');
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    const csv = [templateHeaders.join(','), templateExample.join(',')].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template_${entityLabel}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const close = () => {
    setFile(null);
    setResult(null);
    setUpsert(true);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={close}>
      <div className="bg-card border border-border rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Upload className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Importar {entityLabel}</h3>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          </div>
          <button onClick={close} className="text-muted-foreground hover:text-foreground" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-md border border-border bg-secondary/40 p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h4 className="text-sm font-semibold flex items-center gap-2"><FileSpreadsheet className="w-4 h-4 text-primary" /> Formato aceite</h4>
                <p className="text-xs text-muted-foreground mt-1">CSV, Excel (.xlsx / .xls) ou XML. Máximo 10 MB, 5000 linhas. Acentos, vírgulas decimais e delimitadores ; ou tab são suportados automaticamente.</p>
              </div>
              <button onClick={downloadTemplate} type="button" className="inline-flex items-center gap-2 text-xs font-medium text-primary hover:underline">
                <Download className="w-3.5 h-3.5" /> Descarregar modelo CSV
              </button>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              <span className="font-semibold">Colunas esperadas:</span> {templateHeaders.join(', ')}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Ficheiro</label>
            <div
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) onFile(f);
              }}
              onClick={() => inputRef.current?.click()}
              className="border-2 border-dashed border-input rounded-md p-6 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
            >
              {file ? (
                <div className="space-y-1">
                  <FileSpreadsheet className="w-8 h-8 mx-auto text-primary" />
                  <div className="text-sm font-medium">{file.name}</div>
                  <div className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</div>
                  <button type="button" onClick={(e) => { e.stopPropagation(); onFile(null); }} className="text-xs text-destructive hover:underline">Remover</button>
                </div>
              ) : (
                <div className="space-y-1">
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                  <div className="text-sm">Clique ou arraste o ficheiro aqui</div>
                  <div className="text-xs text-muted-foreground">.csv, .xlsx, .xls, .xml</div>
                </div>
              )}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls,.xml,.tsv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/xml,text/xml"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              id="upsert"
              checked={upsert}
              onChange={(e) => setUpsert(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-input"
            />
            <label htmlFor="upsert" className="text-sm">
              Atualizar registos existentes
              <span className="block text-xs text-muted-foreground">Quando um registo já existe (NIF para clientes, nome para produtos), sobrepõe os dados em vez de ignorar.</span>
            </label>
          </div>

          {result && (
            <div className="rounded-md border border-border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-success" />
                <div className="font-semibold text-sm">Importação concluída</div>
                <span className="ml-auto text-xs text-muted-foreground">Formato: {result.format.toUpperCase()}</span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="rounded bg-secondary p-2">
                  <div className="text-xl font-bold">{result.totalRows}</div>
                  <div className="text-[11px] text-muted-foreground">Linhas</div>
                </div>
                <div className="rounded bg-success/10 p-2">
                  <div className="text-xl font-bold text-success">{result.created}</div>
                  <div className="text-[11px] text-muted-foreground">Criados</div>
                </div>
                <div className="rounded bg-primary/10 p-2">
                  <div className="text-xl font-bold text-primary">{result.updated}</div>
                  <div className="text-[11px] text-muted-foreground">Atualizados</div>
                </div>
                <div className="rounded bg-muted p-2">
                  <div className="text-xl font-bold">{result.skipped}</div>
                  <div className="text-[11px] text-muted-foreground">Ignorados</div>
                </div>
              </div>
              {result.errors && result.errors.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-destructive font-medium flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {result.errors.length} linha{result.errors.length > 1 ? 's' : ''} com problemas
                  </summary>
                  <div className="mt-2 max-h-48 overflow-y-auto rounded border border-border">
                    <table className="w-full text-xs">
                      <thead className="bg-secondary sticky top-0">
                        <tr>
                          <th className="px-2 py-1 text-left">Linha</th>
                          <th className="px-2 py-1 text-left">Identificador</th>
                          <th className="px-2 py-1 text-left">Motivo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.errors.map((e, i) => (
                          <tr key={i} className="border-t border-border">
                            <td className="px-2 py-1 font-mono">{e.row}</td>
                            <td className="px-2 py-1 font-mono">{e.nif ?? e.name ?? '—'}</td>
                            <td className="px-2 py-1 text-destructive">{e.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 p-5 border-t border-border">
          <button onClick={close} className="px-4 h-10 rounded border border-border text-sm">{result ? 'Fechar' : 'Cancelar'}</button>
          {!result && (
            <button
              onClick={upload}
              disabled={!file || uploading}
              className="ms-btn-primary justify-center h-10 disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Importar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
