'use client';

/**
 * Client-side data export helpers.
 * Produces CSV and Excel XLSX files with a safe, Excel-compatible format.
 */

function csvEscape(v: any): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'string' ? v : String(v);
  if (/[",;\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export type ExportColumn<T> = {
  header: string;
  key?: keyof T;
  accessor?: (row: T) => any;
};

export function toCsv<T>(rows: T[], columns: ExportColumn<T>[]): string {
  const head = columns.map((c) => csvEscape(c.header)).join(';');
  const body = rows.map((row) =>
    columns.map((c) => csvEscape(c.accessor ? c.accessor(row) : (row as any)[c.key as any])).join(';'),
  ).join('\r\n');
  // UTF-8 BOM so Excel opens accented characters correctly.
  return '﻿' + head + '\r\n' + body;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportCsv<T>(rows: T[], columns: ExportColumn<T>[], filename: string) {
  const csv = toCsv(rows, columns);
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), filename.endsWith('.csv') ? filename : `${filename}.csv`);
}

export async function exportXlsx<T>(rows: T[], columns: ExportColumn<T>[], filename: string, sheet = 'Dados') {
  const XLSX = await import('xlsx');
  const header = columns.map((c) => c.header);
  const data = rows.map((row) => columns.map((c) => (c.accessor ? c.accessor(row) : (row as any)[c.key as any])));
  const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
  // Simple column width auto-sizing based on content.
  ws['!cols'] = columns.map((_, i) => {
    const max = Math.max(header[i]?.length ?? 10, ...data.map((r) => String(r[i] ?? '').length));
    return { wch: Math.min(Math.max(max + 2, 10), 48) };
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheet);
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  downloadBlob(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

export function stampedFilename(base: string, ext: 'csv' | 'xlsx') {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  return `${base}_${stamp}.${ext}`;
}
