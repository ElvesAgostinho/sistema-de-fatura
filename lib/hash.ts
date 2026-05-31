import crypto from 'crypto';

/**
 * Canonicalize a timestamp so that the hash is stable across JS and Postgres.
 *
 * The bug this fixes: we INSERT the invoice with `new Date().toISOString()`
 * which yields "2026-04-23T18:51:20.123Z". Postgres stores it as TIMESTAMPTZ
 * and Supabase returns it as "2026-04-23T18:51:20.123+00:00" (or with extra
 * microsecond precision). The two strings represent the exact same instant but
 * their SHA-256 hashes differ, so validation wrongly reports "Hash
 * COMPROMETIDO".
 *
 * We normalize BOTH sides by parsing to a Date and serializing back to a
 * canonical UTC ISO string (millisecond precision, trailing "Z"). This keeps
 * the hash chain backward-compatible: old invoices that were signed with
 * `new Date().toISOString()` still validate because the canonical form of
 * their stored timestamp rounds back to the exact same string.
 */
function canonicalTs(ts: string | Date | null | undefined): string {
  if (!ts) return '';
  const d = ts instanceof Date ? ts : new Date(ts);
  if (isNaN(d.getTime())) return String(ts);
  return d.toISOString();
}

function canonicalMoney(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === '') return '0.00';
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return '0.00';
  return n.toFixed(2);
}

/**
 * Generate SHA256 hash for an invoice.
 * Chain: hash = SHA256(invoice_number|client_nif|total|issued_at|previous_hash)
 */
export function generateInvoiceHash(params: {
  invoice_number: string;
  client_nif: string;
  total: number | string;
  issued_at: string | Date;
  previous_hash: string | null | undefined;
}): string {
  const payload = [
    (params.invoice_number ?? '').trim(),
    (params.client_nif ?? '').trim(),
    canonicalMoney(params.total),
    canonicalTs(params.issued_at),
    params.previous_hash ?? '',
  ].join('|');
  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

export function validateInvoiceHash(invoice: {
  invoice_number: string;
  client_nif: string;
  total: number | string;
  issued_at: string | Date;
  previous_hash: string | null;
  hash: string;
}): boolean {
  const recalculated = generateInvoiceHash({
    invoice_number: invoice.invoice_number,
    client_nif: invoice.client_nif,
    total: invoice.total,
    issued_at: invoice.issued_at,
    previous_hash: invoice.previous_hash,
  });
  return recalculated === invoice.hash;
}
