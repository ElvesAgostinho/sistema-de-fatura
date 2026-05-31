-- ==============================================================================
-- MIGRAÇÃO DE BASE DE DADOS: ANGOLA BILLING SYSTEM (AVENÇAS)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS recurring_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  frequency TEXT NOT NULL CHECK (frequency IN ('monthly', 'quarterly', 'yearly')),
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'AOA',
  next_issue_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_company ON recurring_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_recurring_next_date ON recurring_invoices(next_issue_date);

-- Mensagem de sucesso
-- SELECT 'Tabela recurring_invoices criada com sucesso.' as status;
