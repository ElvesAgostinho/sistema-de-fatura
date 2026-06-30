-- 08_agt_real_integration.sql
-- Prepara as tabelas para suportar autenticação Basic Auth com a AGT e o polling assíncrono

ALTER TABLE public.fiscal_config 
ADD COLUMN IF NOT EXISTS agt_username TEXT,
ADD COLUMN IF NOT EXISTS agt_password TEXT;

ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS agt_request_id TEXT;
