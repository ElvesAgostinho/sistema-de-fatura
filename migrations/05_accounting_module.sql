-- 05_accounting_module.sql
-- Tabela para os fechos globais macro (Diário, Mensal, Anual)

CREATE TABLE IF NOT EXISTS public.macro_closings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('DAILY', 'MONTHLY', 'YEARLY')),
    reference_date DATE NOT NULL,
    
    total_revenue NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_tax NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_cash NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_multicaixa NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_tpa NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_credit NUMERIC(14,2) NOT NULL DEFAULT 0,
    
    sales_count INTEGER NOT NULL DEFAULT 0,
    sessions_count INTEGER NOT NULL DEFAULT 0,
    
    status TEXT NOT NULL DEFAULT 'CLOSED' CHECK (status IN ('CLOSED', 'REOPENED')),
    closed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT
);

-- Garantir que só há um fecho por tipo e data para a mesma empresa
CREATE UNIQUE INDEX IF NOT EXISTS uq_macro_closings_date ON public.macro_closings(company_id, type, reference_date) WHERE status = 'CLOSED';

-- Habilitar RLS
ALTER TABLE public.macro_closings ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'macro_closings_select' AND tablename = 'macro_closings') THEN
        CREATE POLICY "macro_closings_select" ON public.macro_closings
            FOR SELECT USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'macro_closings_insert' AND tablename = 'macro_closings') THEN
        CREATE POLICY "macro_closings_insert" ON public.macro_closings
            FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));
    END IF;
END $$;

-- Atualizar o trigger das faturas para proibir inserção de faturas num dia/mês já fechado (Fecho Definitivo)
CREATE OR REPLACE FUNCTION prevent_invoice_mutation_macro_close() RETURNS TRIGGER AS $$
DECLARE
    is_closed BOOLEAN;
BEGIN
    -- Verificar se existe um fecho macro (DIÁRIO ou MENSAL) que cubra a data da fatura
    SELECT EXISTS (
        SELECT 1 FROM public.macro_closings
        WHERE company_id = NEW.company_id
          AND status = 'CLOSED'
          AND (
              (type = 'DAILY' AND reference_date = NEW.issued_at::date) OR
              (type = 'MONTHLY' AND date_trunc('month', reference_date) = date_trunc('month', NEW.issued_at::date))
          )
    ) INTO is_closed;

    IF is_closed THEN
        RAISE EXCEPTION 'Não é possível emitir ou modificar faturas num período (dia/mês) que já foi fechado definitivamente pela contabilidade.';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- O trigger BEFORE INSERT OR UPDATE ON invoices
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_prevent_invoice_mutation_macro_close' AND tgrelid = 'invoices'::regclass) THEN
        CREATE TRIGGER trg_prevent_invoice_mutation_macro_close
          BEFORE INSERT OR UPDATE OF issued_at, total ON public.invoices
          FOR EACH ROW EXECUTE FUNCTION prevent_invoice_mutation_macro_close();
    END IF;
END $$;
