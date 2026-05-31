/**
 * Shared ERP integration types.
 * Currently supports Odoo (JSON-RPC). Adapters should implement ErpAdapter.
 */

export type ErpProvider = 'odoo';

export interface ErpCredentials {
  baseUrl: string;        // e.g. https://mycompany.odoo.com
  dbName: string;         // Odoo database name
  username: string;       // Odoo user email
  apiKey: string;         // Odoo API key (preferred) or password
}

export interface ErpSyncResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export interface ErpConnectionCheck {
  ok: boolean;
  uid?: number;
  version?: string;
  error?: string;
}

export interface ErpClientRecord {
  id: string;
  name: string;
  nif: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}

export interface ErpProductRecord {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  tax_rate: number;
}

export interface ErpInvoiceRecord {
  id: string;
  invoice_number: string;
  document_type: string;
  issued_at: string;
  subtotal: number;
  tax: number;
  total: number;
  status: string;
  client_nif: string;
  client_name: string;
  items: Array<{ description: string; quantity: number; price: number; tax_rate: number; total: number }>;
}
