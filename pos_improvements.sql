-- Migration: Adicionar session_id para isolamento de turnos e cash events

-- 1. Tabela INVOICES
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.pos_sessions(id) ON DELETE SET NULL;

-- 2. Tabela PAYMENTS
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.pos_sessions(id) ON DELETE SET NULL;

-- 3. Configurações Fiscais (Fundo Fixo)
ALTER TABLE public.fiscal_config
ADD COLUMN IF NOT EXISTS pos_fixed_opening_balance NUMERIC(14,2) DEFAULT NULL;

-- 4. Tabela de Logs Financeiros (Eventos de Caixa)
CREATE TABLE IF NOT EXISTS public.pos_cash_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES public.pos_sessions(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('OPEN', 'CLOSE', 'IN', 'OUT')), -- IN = Reforço, OUT = Sangria
    amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS para pos_cash_events
ALTER TABLE public.pos_cash_events ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para pos_cash_events
CREATE POLICY "Users can view cash events for their company" ON public.pos_cash_events
    FOR SELECT USING (
        company_id IN (
            SELECT company_id FROM public.users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can insert cash events for their company" ON public.pos_cash_events
    FOR INSERT WITH CHECK (
        company_id IN (
            SELECT company_id FROM public.users WHERE id = auth.uid()
        )
    );

-- Nota: não há policy de UPDATE ou DELETE intencionalmente para garantir integridade.
