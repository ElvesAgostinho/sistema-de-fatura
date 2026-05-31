/**
 * Odoo JSON-RPC client for ERP integration.
 *
 * Odoo exposes /jsonrpc (recommended, simpler than XML-RPC) with two services:
 *   - common/authenticate    -> returns uid
 *   - object/execute_kw      -> call any model method
 *
 * Docs: https://www.odoo.com/documentation/17.0/developer/reference/external_api.html
 */

import type {
  ErpCredentials,
  ErpConnectionCheck,
  ErpSyncResult,
  ErpClientRecord,
  ErpProductRecord,
  ErpInvoiceRecord,
} from './types';

async function jsonRpc(baseUrl: string, service: string, method: string, args: any[]): Promise<any> {
  const url = `${baseUrl.replace(/\/$/, '')}/jsonrpc`;
  const body = {
    jsonrpc: '2.0',
    method: 'call',
    id: Date.now(),
    params: { service, method, args },
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
    // Sensible timeout
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Odoo HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) {
    const msg = data.error?.data?.message || data.error?.message || 'Erro desconhecido do Odoo';
    throw new Error(msg);
  }
  return data.result;
}

async function authenticate(creds: ErpCredentials): Promise<number> {
  const uid = await jsonRpc(creds.baseUrl, 'common', 'authenticate', [
    creds.dbName,
    creds.username,
    creds.apiKey,
    {},
  ]);
  if (!uid || typeof uid !== 'number') {
    throw new Error('Autenticação falhou: verifique base URL, DB, username e API key.');
  }
  return uid;
}

async function executeKw(
  creds: ErpCredentials,
  uid: number,
  model: string,
  method: string,
  args: any[] = [],
  kwargs: Record<string, any> = {},
): Promise<any> {
  return jsonRpc(creds.baseUrl, 'object', 'execute_kw', [
    creds.dbName,
    uid,
    creds.apiKey,
    model,
    method,
    args,
    kwargs,
  ]);
}

/** Quick test: authenticate + read server version. */
export async function testOdooConnection(creds: ErpCredentials): Promise<ErpConnectionCheck> {
  try {
    const version = await jsonRpc(creds.baseUrl, 'common', 'version', []);
    const uid = await authenticate(creds);
    return { ok: true, uid, version: version?.server_version ?? 'desconhecida' };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Push clients to Odoo as res.partner.
 * Match by vat (NIF). Creates if not found, otherwise updates.
 */
export async function pushClientsToOdoo(
  creds: ErpCredentials,
  clients: ErpClientRecord[],
): Promise<ErpSyncResult> {
  const result: ErpSyncResult = { created: 0, updated: 0, skipped: 0, errors: [] };
  const uid = await authenticate(creds);

  for (const c of clients) {
    try {
      if (!c.nif || !c.name) { result.skipped++; continue; }
      // Find existing partner by NIF (vat)
      const existing: number[] = await executeKw(creds, uid, 'res.partner', 'search',
        [[['vat', '=', c.nif]]], { limit: 1 });
      const payload: Record<string, any> = {
        name: c.name,
        vat: c.nif,
        email: c.email || false,
        phone: c.phone || false,
        street: c.address || false,
        is_company: true,
        customer_rank: 1,
      };
      if (existing.length > 0) {
        await executeKw(creds, uid, 'res.partner', 'write', [[existing[0]], payload]);
        result.updated++;
      } else {
        await executeKw(creds, uid, 'res.partner', 'create', [payload]);
        result.created++;
      }
    } catch (err: any) {
      result.errors.push(`${c.name || c.nif}: ${err?.message || err}`);
    }
  }
  return result;
}

/**
 * Push products to Odoo as product.product.
 * Match by name (Odoo has no unique SKU in product.product by default).
 */
export async function pushProductsToOdoo(
  creds: ErpCredentials,
  products: ErpProductRecord[],
): Promise<ErpSyncResult> {
  const result: ErpSyncResult = { created: 0, updated: 0, skipped: 0, errors: [] };
  const uid = await authenticate(creds);

  for (const p of products) {
    try {
      if (!p.name) { result.skipped++; continue; }
      const existing: number[] = await executeKw(creds, uid, 'product.product', 'search',
        [[['name', '=', p.name]]], { limit: 1 });
      const payload: Record<string, any> = {
        name: p.name,
        description_sale: p.description || false,
        list_price: Number(p.price) || 0,
        type: 'service',
      };
      if (existing.length > 0) {
        await executeKw(creds, uid, 'product.product', 'write', [[existing[0]], payload]);
        result.updated++;
      } else {
        await executeKw(creds, uid, 'product.product', 'create', [payload]);
        result.created++;
      }
    } catch (err: any) {
      result.errors.push(`${p.name}: ${err?.message || err}`);
    }
  }
  return result;
}

/**
 * Push invoices to Odoo as account.move (type=out_invoice).
 * Requires client and product to exist in Odoo (push them first).
 * For MVP, we create draft invoices only - user can validate in Odoo.
 */
export async function pushInvoicesToOdoo(
  creds: ErpCredentials,
  invoices: ErpInvoiceRecord[],
): Promise<ErpSyncResult> {
  const result: ErpSyncResult = { created: 0, updated: 0, skipped: 0, errors: [] };
  const uid = await authenticate(creds);

  for (const inv of invoices) {
    try {
      // Check if already exists (by ref)
      const existing: number[] = await executeKw(creds, uid, 'account.move', 'search',
        [[['ref', '=', inv.invoice_number]]], { limit: 1 });
      if (existing.length > 0) { result.skipped++; continue; }

      // Find or create partner
      let partnerId: number;
      const partners: number[] = await executeKw(creds, uid, 'res.partner', 'search',
        [[['vat', '=', inv.client_nif]]], { limit: 1 });
      if (partners.length > 0) {
        partnerId = partners[0];
      } else {
        partnerId = await executeKw(creds, uid, 'res.partner', 'create', [{
          name: inv.client_name,
          vat: inv.client_nif,
          is_company: true,
          customer_rank: 1,
        }]);
      }

      // Build invoice lines
      const lines = inv.items.map(it => [0, 0, {
        name: it.description,
        quantity: Number(it.quantity) || 1,
        price_unit: Number(it.price) || 0,
      }]);

      const moveType = inv.document_type === 'NC' ? 'out_refund' : 'out_invoice';
      await executeKw(creds, uid, 'account.move', 'create', [{
        move_type: moveType,
        partner_id: partnerId,
        invoice_date: inv.issued_at.slice(0, 10),
        ref: inv.invoice_number,
        invoice_line_ids: lines,
      }]);
      result.created++;
    } catch (err: any) {
      result.errors.push(`${inv.invoice_number}: ${err?.message || err}`);
    }
  }
  return result;
}
