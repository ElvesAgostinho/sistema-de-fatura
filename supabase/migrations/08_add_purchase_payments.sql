-- 1. Add amount_paid and payment_status to purchases
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pendente';

-- 2. Create purchase_payments table to track AP payments
CREATE TABLE IF NOT EXISTS public.purchase_payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    method TEXT,
    reference TEXT,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for purchase_payments
ALTER TABLE public.purchase_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchase_payments_all" ON public.purchase_payments
    FOR ALL TO public USING (company_id = auth_company_id()) WITH CHECK (company_id = auth_company_id());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_purchase_payments_company_id ON public.purchase_payments(company_id);
CREATE INDEX IF NOT EXISTS idx_purchase_payments_purchase_id ON public.purchase_payments(purchase_id);
