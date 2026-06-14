-- Migração para melhorias de Retenção, Desconto e Serviços

-- 1. Invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS retention_tax NUMERIC(14,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS retention_rate NUMERIC(5,2) DEFAULT 0;

-- 2. Invoice Items
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS discount NUMERIC(14,2) DEFAULT 0;

-- 3. Products
ALTER TABLE products ADD COLUMN IF NOT EXISTS code TEXT;

-- 4. Fiscal Config
ALTER TABLE fiscal_config ADD COLUMN IF NOT EXISTS default_tax_exemption_reason TEXT;
ALTER TABLE fiscal_config ADD COLUMN IF NOT EXISTS default_retention_rate NUMERIC(5,2) DEFAULT 0;

-- 5. Invoice Series (Adicionar OR - Orçamento)
ALTER TABLE invoice_series DROP CONSTRAINT IF EXISTS invoice_series_document_type_check;
ALTER TABLE invoice_series ADD CONSTRAINT invoice_series_document_type_check CHECK (document_type IN ('FT','FR','NC','ND','RC','PP','OR','GT'));

-- 6. Invoices document_type
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_document_type_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_document_type_check CHECK (document_type IN ('FT','FR','NC','ND','RC','PP','OR','GT'));
