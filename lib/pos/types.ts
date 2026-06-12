// ── POS Type Definitions ────────────────────────────────────────────────────

export interface POSProduct {
  id: string;
  name: string;
  price: number;
  tax_rate: number;
  sku: string | null;
  barcode: string | null;
  category: string | null;
  image_url: string | null;
  track_stock: boolean;
  quantity_in_stock: number | null;
  is_active: boolean;
}

export interface POSCartItem {
  product_id: string;
  name: string;
  price: number;           // unit price (ex-tax)
  tax_rate: number;
  quantity: number;
  discount_pct: number;    // 0-100
  line_subtotal: number;   // qty * price * (1 - discount/100)
  line_tax: number;
  line_total: number;
}

export type PaymentMethod = 'Dinheiro' | 'Multicaixa' | 'TPA' | 'Crédito' | 'Misto';

export interface POSSession {
  id: string;
  terminal_name: string;
  opened_at: string;
  opening_balance: number;
  total_sales: number;
  total_cash: number;
  total_multicaixa: number;
  total_tpa: number;
  total_credit: number;
  sales_count: number;
  status: 'open' | 'closed';
}

export interface POSSalePayload {
  session_id: string | null;
  client_id: string | null;
  items: POSCartItem[];
  payment_method: PaymentMethod;
  amount_tendered: number;   // cash given by customer
  notes: string | null;
  tax_exempt: boolean;
}

export interface POSSaleResult {
  invoice_id: string;
  invoice_number: string;
  total: number;
  change: number;
  items: POSCartItem[];
  client_name: string | null;
  issued_at: string;
}
