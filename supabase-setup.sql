-- =============================================
-- ANGOLA BILLING SYSTEM - SUPABASE SCHEMA
-- Compliance AGT Angola
-- =============================================

-- Drop existing tables (clean slate)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS invoice_items CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS invoice_series CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS companies CASCADE;

-- =============================================
-- TABELAS
-- =============================================

-- 1. Companies (Empresas)
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  nif TEXT NOT NULL UNIQUE,
  address TEXT,
  phone TEXT,
  email TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Users (liga auth.users ao company)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin','user','caixa','contabilista')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_users_company ON users(company_id);

-- 3. Clients (Clientes)
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  nif TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_clients_company ON clients(company_id);
CREATE UNIQUE INDEX uq_clients_company_nif ON clients(company_id, nif);

-- 4. Products (Produtos/Serviços)
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(14,2) NOT NULL CHECK (price >= 0),
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 14 CHECK (tax_rate >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_products_company ON products(company_id);

-- 5. Invoice Series (Numeração sequencial por série/ano)
CREATE TABLE invoice_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('FT','FR','NC','ND','RC')),
  current_number INTEGER NOT NULL DEFAULT 0,
  year INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX uq_invoice_series ON invoice_series(company_id, document_type, year);

-- 6. Invoices (Faturas)
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id),
  invoice_number TEXT NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('FT','FR','NC','ND','RC')),
  subtotal NUMERIC(14,2) NOT NULL,
  tax NUMERIC(14,2) NOT NULL,
  total NUMERIC(14,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','cancelled')),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hash TEXT NOT NULL,
  previous_hash TEXT,
  cancellation_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  tax_exemption_reason TEXT,
  -- Snapshot dados cliente (compliance: imutabilidade)
  client_name TEXT NOT NULL,
  client_nif TEXT NOT NULL,
  client_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX uq_invoices_number ON invoices(company_id, invoice_number);
CREATE INDEX idx_invoices_company ON invoices(company_id);
CREATE INDEX idx_invoices_client ON invoices(client_id);
CREATE INDEX idx_invoices_issued ON invoices(issued_at DESC);

-- 7. Invoice Items (Itens da Fatura)
CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  price NUMERIC(14,2) NOT NULL CHECK (price >= 0),
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 14,
  total NUMERIC(14,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);

-- 8. Audit Logs (Auditoria)
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_company ON audit_logs(company_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);

-- =============================================
-- PROTEÇÃO DE IMUTABILIDADE (FATURAS)
-- Faturas emitidas não podem ser editadas nem apagadas
-- =============================================

CREATE OR REPLACE FUNCTION prevent_invoice_mutation() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Faturas não podem ser apagadas (compliance AGT).';
  END IF;
  -- Permitir apenas alteração dos campos de cancelamento
  IF OLD.invoice_number IS DISTINCT FROM NEW.invoice_number
     OR OLD.document_type IS DISTINCT FROM NEW.document_type
     OR OLD.subtotal IS DISTINCT FROM NEW.subtotal
     OR OLD.tax IS DISTINCT FROM NEW.tax
     OR OLD.total IS DISTINCT FROM NEW.total
     OR OLD.issued_at IS DISTINCT FROM NEW.issued_at
     OR OLD.hash IS DISTINCT FROM NEW.hash
     OR OLD.previous_hash IS DISTINCT FROM NEW.previous_hash
     OR OLD.client_id IS DISTINCT FROM NEW.client_id
     OR OLD.client_name IS DISTINCT FROM NEW.client_name
     OR OLD.client_nif IS DISTINCT FROM NEW.client_nif THEN
    RAISE EXCEPTION 'Fatura emitida não pode ser alterada (compliance AGT).';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_invoice_mutation
  BEFORE UPDATE OR DELETE ON invoices
  FOR EACH ROW EXECUTE FUNCTION prevent_invoice_mutation();

CREATE OR REPLACE FUNCTION prevent_invoice_items_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Itens de fatura não podem ser modificados (compliance AGT).';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_invoice_items_update
  BEFORE UPDATE ON invoice_items
  FOR EACH ROW EXECUTE FUNCTION prevent_invoice_items_mutation();

-- =============================================
-- ROW LEVEL SECURITY (Multi-tenant)
-- =============================================

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper: obter company_id do utilizador autenticado
CREATE OR REPLACE FUNCTION auth_company_id() RETURNS UUID AS $$
  SELECT company_id FROM users WHERE id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Políticas: Companies
CREATE POLICY companies_select ON companies FOR SELECT USING (id = auth_company_id());
CREATE POLICY companies_update ON companies FOR UPDATE USING (id = auth_company_id());

-- Políticas: Users (ver utilizadores da mesma empresa)
CREATE POLICY users_select ON users FOR SELECT USING (company_id = auth_company_id());

-- Políticas genéricas (clients/products/invoice_series/invoices/invoice_items/audit_logs)
CREATE POLICY clients_all ON clients FOR ALL USING (company_id = auth_company_id()) WITH CHECK (company_id = auth_company_id());
CREATE POLICY products_all ON products FOR ALL USING (company_id = auth_company_id()) WITH CHECK (company_id = auth_company_id());
CREATE POLICY invoice_series_all ON invoice_series FOR ALL USING (company_id = auth_company_id()) WITH CHECK (company_id = auth_company_id());
CREATE POLICY invoices_all ON invoices FOR ALL USING (company_id = auth_company_id()) WITH CHECK (company_id = auth_company_id());
CREATE POLICY invoice_items_all ON invoice_items FOR ALL USING (
  EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_items.invoice_id AND i.company_id = auth_company_id())
);
CREATE POLICY audit_logs_select ON audit_logs FOR SELECT USING (company_id = auth_company_id());
