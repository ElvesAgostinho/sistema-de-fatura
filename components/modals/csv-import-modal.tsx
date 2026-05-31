'use client';

import { useState, useRef } from 'react';
import { Upload, X, Loader2, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

type ImportType = 'clients' | 'products';

interface Props {
  type: ImportType;
  onClose: () => void;
  onImported: () => void;
}

export default function CsvImportModal({ type, onClose, onImported }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const title = type === 'clients' ? 'Importar Clientes (CSV)' : 'Importar Produtos (CSV)';
  const expectedHeaders = type === 'clients' 
    ? 'name, nif, email, phone, address' 
    : 'name, reference, price, tax_rate, tax_exempt, tax_exemption_reason, track_stock, quantity_in_stock, min_stock_level';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (!selected.name.endsWith('.csv')) {
      toast.error('Por favor, selecione um ficheiro .csv');
      return;
    }
    setFile(selected);
    setError(null);
    setPreview(null);
  };

  const parseCsv = () => {
    if (!file) return;
    setParsing(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) throw new Error('Ficheiro vazio');
        
        // Simple CSV parser handling quotes
        const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
        if (lines.length < 2) throw new Error('O ficheiro deve conter cabeçalho e pelo menos uma linha de dados');

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const data = [];

        for (let i = 1; i < lines.length; i++) {
          // Simplistic split (doesn't handle commas inside quotes perfectly, but enough for MVP)
          const values = lines[i].split(',').map(v => v.trim());
          const obj: any = {};
          headers.forEach((h, idx) => {
            let val = values[idx] || '';
            // remove quotes if any
            if (val.startsWith('"') && val.endsWith('"')) val = val.substring(1, val.length - 1);
            obj[h] = val;
          });
          data.push(obj);
        }

        // Validate structure
        if (type === 'clients') {
          const invalid = data.filter(d => !d.name);
          if (invalid.length > 0) throw new Error(`Encontrados ${invalid.length} registos sem 'name' (obrigatório)`);
        } else {
          const invalid = data.filter(d => !d.name || isNaN(Number(d.price)));
          if (invalid.length > 0) throw new Error(`Encontrados ${invalid.length} registos sem 'name' ou 'price' válido (obrigatórios)`);
        }

        setPreview(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setParsing(false);
      }
    };
    reader.onerror = () => {
      setError('Erro ao ler o ficheiro');
      setParsing(false);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!preview || preview.length === 0) return;
    setImporting(true);
    try {
      const endpoint = type === 'clients' ? '/api/clients/bulk' : '/api/products/bulk';
      const body = type === 'clients' ? { clients: preview } : { products: preview };

      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const j = await r.json();

      if (!r.ok) throw new Error(j.error || 'Falha na importação');

      toast.success(`Foram importados ${j.count} registos com sucesso!`);
      onImported();
    } catch (err: any) {
      toast.error(err.message);
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const csvContent = type === 'clients'
      ? "name,nif,email,phone,address\nEmpresa Exemplo Lda,500000000,geral@exemplo.com,+244900000000,Luanda Angola"
      : "name,reference,price,tax_rate,tax_exempt,tax_exemption_reason,track_stock,quantity_in_stock,min_stock_level\nProduto Exemplo,REF001,15000,14,false,,true,50,10";
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `template_${type}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-card rounded-md shadow-lg w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold text-lg flex items-center gap-2"><Upload className="w-5 h-5 text-primary" /> {title}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-secondary rounded-md"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto space-y-6">
          {error && (
            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-semibold">Erro na validação</div>
                <div>{error}</div>
              </div>
            </div>
          )}

          {!preview ? (
            <>
              <div className="text-sm text-muted-foreground">
                <p className="mb-2">O ficheiro CSV deve conter os seguintes cabeçalhos exatos (na primeira linha):</p>
                <div className="p-2 bg-secondary rounded-md font-mono text-xs break-all border border-border">
                  {expectedHeaders}
                </div>
                <button onClick={downloadTemplate} className="mt-3 text-primary hover:underline text-xs inline-flex items-center gap-1"><FileText className="w-3 h-3" /> Descarregar template de exemplo</button>
              </div>

              <div 
                className="border-2 border-dashed border-border rounded-lg p-10 flex flex-col items-center justify-center text-center hover:bg-secondary/20 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Upload className="w-6 h-6 text-primary" />
                </div>
                {file ? (
                  <div>
                    <div className="font-medium">{file.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">{(file.size / 1024).toFixed(1)} KB</div>
                  </div>
                ) : (
                  <div>
                    <div className="font-medium">Clique para selecionar o ficheiro</div>
                    <div className="text-xs text-muted-foreground mt-1">Suporta apenas .csv</div>
                  </div>
                )}
              </div>

              {file && (
                <div className="flex justify-end">
                  <button onClick={parseCsv} disabled={parsing} className="ms-btn-primary inline-flex items-center gap-2">
                    {parsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                    Validar Ficheiro
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-success p-3 bg-success/10 rounded-md border border-success/20">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <div>
                  <div className="font-medium text-sm">Ficheiro validado com sucesso!</div>
                  <div className="text-xs mt-0.5">Foram encontrados {preview.length} registos válidos prontos a importar.</div>
                </div>
              </div>

              <div className="border rounded-md overflow-hidden">
                <div className="bg-secondary/40 px-3 py-2 text-xs font-semibold text-muted-foreground">Pré-visualização (primeiros 5 registos)</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-secondary/20 text-left">
                        {Object.keys(preview[0] || {}).map(k => (
                          <th key={k} className="p-2 font-medium">{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {preview.slice(0, 5).map((row, i) => (
                        <tr key={i}>
                          {Object.values(row).map((val: any, j) => (
                            <td key={j} className="p-2 truncate max-w-[150px]">{val}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {preview.length > 5 && (
                  <div className="p-2 text-center text-xs text-muted-foreground border-t bg-secondary/10">... e mais {preview.length - 5} registos</div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t bg-secondary/20 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-md text-sm font-medium hover:bg-secondary">
            Cancelar
          </button>
          {preview && (
            <button 
              onClick={handleImport} 
              disabled={importing}
              className="ms-btn-primary inline-flex items-center gap-2"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {importing ? 'A importar...' : `Importar ${preview.length} registos`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
