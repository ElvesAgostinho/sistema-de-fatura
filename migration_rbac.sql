-- ==============================================================================
-- MIGRAÇÃO DE BASE DE DADOS: ANGOLA BILLING SYSTEM (RBAC)
-- ==============================================================================
-- Execute este script no SQL Editor do Supabase para atualizar as permissões 
-- da tabela de utilizadores para suportar os novos perfis ERP.

-- 1. Remove a restrição atual
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- 2. Adiciona a nova restrição com suporte para 'caixa' e 'contabilista'
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'user', 'caixa', 'contabilista'));

-- Mensagem de sucesso (Opcional, se o console suportar)
-- SELECT 'Migração de Perfis RBAC concluída com sucesso.' as status;
