-- =============================================
-- Migration 03: get_next_invoice_number
-- Função atómica para geração de numeração sequencial
-- por empresa, tipo de documento e ano (compliance AGT)
-- =============================================

CREATE OR REPLACE FUNCTION public.get_next_invoice_number(
  p_company_id UUID,
  p_doc_type   TEXT,
  p_year       INTEGER
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next_number    INTEGER;
  v_invoice_number TEXT;
BEGIN
  -- Garante que a série existe (sem erro se já existir)
  INSERT INTO public.invoice_series (company_id, document_type, year, current_number)
  VALUES (p_company_id, p_doc_type, p_year, 0)
  ON CONFLICT (company_id, document_type, year) DO NOTHING;

  -- Incrementa atomicamente e obtém o novo número (lock implícito via UPDATE)
  UPDATE public.invoice_series
  SET    current_number = current_number + 1
  WHERE  company_id    = p_company_id
    AND  document_type = p_doc_type
    AND  year          = p_year
  RETURNING current_number INTO v_next_number;

  -- Formato oficial AGT: "FT 2026/1", "NC 2026/5", etc.
  v_invoice_number := p_doc_type || ' ' || p_year || '/' || v_next_number;

  RETURN v_invoice_number;
END;
$$;
