-- =============================================
-- Migration: Add Proforma (PP) and Guia de Transporte (GT)
-- =============================================

-- 1. Add new columns to invoices table
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS transport_details JSONB;

-- 2. Update Constraints for document_type
-- We need to drop the existing constraints and recreate them to include 'PP' and 'GT'.

-- A) For invoice_series
ALTER TABLE invoice_series DROP CONSTRAINT IF EXISTS invoice_series_document_type_check;
ALTER TABLE invoice_series ADD CONSTRAINT invoice_series_document_type_check 
CHECK (document_type IN ('FT','FR','NC','ND','RC','PP','GT'));

-- B) For invoices
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_document_type_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_document_type_check 
CHECK (document_type IN ('FT','FR','NC','ND','RC','PP','GT'));

-- 3. Update the prevent_invoice_mutation trigger
-- We need to drop and recreate the function to prevent valid_until and transport_details from being altered

CREATE OR REPLACE FUNCTION prevent_invoice_mutation() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Faturas não podem ser apagadas (compliance AGT).';
  END IF;
  -- Permitir apenas alteração dos campos de cancelamento (e payment details, se aplicável, no futuro)
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
     OR OLD.client_nif IS DISTINCT FROM NEW.client_nif
     OR OLD.valid_until IS DISTINCT FROM NEW.valid_until
     OR OLD.transport_details IS DISTINCT FROM NEW.transport_details THEN
    RAISE EXCEPTION 'Fatura emitida não pode ser alterada (compliance AGT).';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
