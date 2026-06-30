-- 06_service_periods.sql
-- Adiciona campos de período de prestação de serviço (Hotéis/Transfers) às faturas

ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS service_start_date DATE,
ADD COLUMN IF NOT EXISTS service_end_date DATE;
