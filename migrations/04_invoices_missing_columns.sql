-- =============================================
-- Migration 04: Add missing columns to invoices
-- created_by, tax_exempt, payment_method
-- =============================================

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS created_by     UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS tax_exempt     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS payment_method TEXT;

-- Index for audit/filtering by creator
CREATE INDEX IF NOT EXISTS idx_invoices_created_by ON public.invoices(created_by);
