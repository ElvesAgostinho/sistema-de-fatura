-- 07_agt_integration.sql
-- Adiciona infraestrutura para comunicação via WebService em Tempo Real com a AGT

-- 1. Estado da sincronização na fatura
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS agt_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (agt_status IN ('PENDING', 'SYNCING', 'SYNCED', 'FAILED'));

-- 2. Tabela de logs de envios (WebServices)
CREATE TABLE IF NOT EXISTS public.agt_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    request_payload JSONB NOT NULL,
    response_payload JSONB,
    status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'ERROR')),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.agt_submissions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'agt_submissions_select' AND tablename = 'agt_submissions') THEN
        CREATE POLICY "agt_submissions_select" ON public.agt_submissions
            FOR SELECT USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));
    END IF;
END $$;
