-- Criação da tabela receipt_allocations para suportar Liquidação Múltipla
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS receipt_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.receipt_allocations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    receipt_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure we don't duplicate the same invoice in the same receipt
    UNIQUE(receipt_id, invoice_id)
);

-- Enable RLS
ALTER TABLE public.receipt_allocations ENABLE ROW LEVEL SECURITY;

-- Policies for receipt_allocations
CREATE POLICY "Enable read access for all authenticated users" ON public.receipt_allocations
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public.receipt_allocations
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON public.receipt_allocations
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Enable delete for authenticated users" ON public.receipt_allocations
    FOR DELETE TO authenticated USING (true);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_receipt_allocations_receipt_id ON public.receipt_allocations(receipt_id);
CREATE INDEX IF NOT EXISTS idx_receipt_allocations_invoice_id ON public.receipt_allocations(invoice_id);
