/**
 * Generic file parser for CSV, Excel (XLSX/XLS) and XML.
 *
 * Returns an array of rows where each row is a plain object keyed by header name.
 * Headers are normalised (lowercased, spaces → underscores, accents stripped)
 * so that columns named "Nome", "nome", "NOME", "Name", "name"... resolve to the
 * same internal key after aliasing.
 */

import * as XLSX from 'xlsx';
import { XMLParser } from 'fast-xml-parser';

export type ParsedRow = Record<string, string | number | null>;
export type ParseResult = {
  rows: ParsedRow[];
  format: 'csv' | 'xlsx' | 'xls' | 'xml';
  headers: string[];
};

export function normalizeHeader(h: string): string {
  return h
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function detectFormat(filename: string, buffer: Buffer): ParseResult['format'] {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.xlsx')) return 'xlsx';
  if (lower.endsWith('.xls')) return 'xls';
  if (lower.endsWith('.xml')) return 'xml';
  if (lower.endsWith('.csv') || lower.endsWith('.tsv') || lower.endsWith('.txt')) return 'csv';

  // Magic-byte sniffing as fallback
  if (buffer.length >= 4) {
    // ZIP/XLSX: PK\x03\x04
    if (buffer[0] === 0x50 && buffer[1] === 0x4b) return 'xlsx';
    // Old XLS OLE compound: D0 CF 11 E0
    if (buffer[0] === 0xd0 && buffer[1] === 0xcf) return 'xls';
  }
  const head = buffer.slice(0, 128).toString('utf8').trimStart();
  if (head.startsWith('<?xml') || head.startsWith('<')) return 'xml';
  return 'csv';
}

export function parseBuffer(filename: string, buffer: Buffer): ParseResult {
  const format = detectFormat(filename, buffer);

  if (format === 'xlsx' || format === 'xls') {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '', raw: false });
    if (json.length === 0) return { rows: [], format, headers: [] };
    const originalHeaders = Object.keys(json[0]);
    const headers = originalHeaders.map(normalizeHeader);
    const rows: ParsedRow[] = json.map((r) => {
      const out: ParsedRow = {};
      originalHeaders.forEach((h, i) => {
        const v = r[h];
        out[headers[i]] = v == null || v === '' ? null : typeof v === 'number' ? v : String(v).trim();
      });
      return out;
    });
    return { rows, format, headers };
  }

  if (format === 'xml') {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      trimValues: true,
      parseTagValue: true,
      parseAttributeValue: true,
    });
    const parsed = parser.parse(buffer.toString('utf8'));
    // Find the first array node (typical: <Root><Item>..</Item><Item>..</Item></Root>)
    const rowsArray = findFirstRepeatingArray(parsed);
    if (!rowsArray) return { rows: [], format, headers: [] };
    const normRows: ParsedRow[] = rowsArray.map((r: any) => {
      const row: ParsedRow = {};
      if (typeof r === 'object' && r !== null) {
        for (const [k, v] of Object.entries(r)) {
          const nk = normalizeHeader(k.replace(/^@_/, ''));
          if (v === null || v === undefined) row[nk] = null;
          else if (typeof v === 'number') row[nk] = v;
          else if (typeof v === 'object') row[nk] = JSON.stringify(v);
          else row[nk] = String(v).trim();
        }
      }
      return row;
    });
    const headerSet = new Set<string>();
    normRows.forEach((r) => Object.keys(r).forEach((k) => headerSet.add(k)));
    return { rows: normRows, format, headers: Array.from(headerSet) };
  }

  // CSV (default). Handle common delimiters: , ; \t
  const text = buffer.toString('utf8').replace(/^﻿/, ''); // strip BOM
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return { rows: [], format, headers: [] };
  const delim = detectDelimiter(lines[0]);
  const headers = splitCsvLine(lines[0], delim).map(normalizeHeader);
  const rows: ParsedRow[] = lines.slice(1).map((line) => {
    const cells = splitCsvLine(line, delim);
    const row: ParsedRow = {};
    headers.forEach((h, i) => {
      const v = cells[i];
      row[h] = v == null || v === '' ? null : String(v).trim();
    });
    return row;
  });
  return { rows, format, headers };
}

function detectDelimiter(headerLine: string): string {
  const candidates = [',', ';', '\t', '|'];
  const counts = candidates.map((c) => [c, headerLine.split(c).length - 1] as const);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ',';
}

function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delim && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function findFirstRepeatingArray(obj: any): any[] | null {
  if (obj == null || typeof obj !== 'object') return null;
  for (const [, v] of Object.entries(obj)) {
    if (Array.isArray(v)) return v;
    if (typeof v === 'object' && v !== null) {
      // Dig into single-child nesting (e.g., <Root><Clientes><Cliente/>...) 
      const nested = findFirstRepeatingArray(v);
      if (nested) return nested;
      // Case where there's only one row inside (not an array)
      const objKeys = Object.keys(v as object);
      if (objKeys.length === 1) continue;
      return [v];
    }
  }
  return null;
}

/**
 * Resolve a normalized row key by trying multiple aliases, in order.
 * Returns null if none matches or the value is null/empty.
 */
export function pick(row: ParsedRow, aliases: string[]): string | null {
  for (const a of aliases) {
    const na = normalizeHeader(a);
    if (na in row) {
      const v = row[na];
      if (v === null || v === undefined || v === '') continue;
      return String(v).trim();
    }
  }
  return null;
}

export function pickNumber(row: ParsedRow, aliases: string[]): number | null {
  const v = pick(row, aliases);
  if (v == null) return null;
  // Handle comma-decimal (common in pt-AO): "1.234,56" → 1234.56
  const cleaned = v.replace(/\s/g, '').replace(/\.(?=\d{3}(?:[,.\D]|$))/g, '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
