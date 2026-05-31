-- =============================================
-- PURCHASE MODULE - SUPABASE SCHEMA
-- =============================================

-- 1. Suppliers (Fornecedores)
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  nif TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_suppliers_company ON suppliers(company_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_suppliers_company_nif ON suppliers(company_id, nif);

-- 2. Purchases (Compras)
CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  purchase_number TEXT NOT NULL, -- Número da fatura do fornecedor
  subtotal NUMERIC(14,2) NOT NULL,
  tax NUMERIC(14,2) NOT NULL,
  total NUMERIC(14,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','cancelled')),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_purchases_company ON purchases(company_id);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id);

-- 3. Purchase Items (Itens da Compra)
CREATE TABLE IF NOT EXISTS purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  price NUMERIC(14,2) NOT NULL CHECK (price >= 0),
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 14,
  total NUMERIC(14,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);

-- =============================================
-- ROW LEVEL SECURITY (Multi-tenant)
-- =============================================

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;

-- Políticas: Suppliers
CREATE POLICY suppliers_all ON suppliers FOR ALL USING (company_id = auth_company_id()) WITH CHECK (company_id = auth_company_id());

-- Políticas: Purchases
CREATE POLICY purchases_all ON purchases FOR ALL USING (company_id = auth_company_id()) WITH CHECK (company_id = auth_company_id());

-- Políticas: Purchase Items
CREATE POLICY purchase_items_all ON purchase_items FOR ALL USING (
  EXISTS (SELECT 1 FROM purchases p WHERE p.id = purchase_items.purchase_id AND p.company_id = auth_company_id())
);
