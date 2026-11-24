-- ==============================================================================
-- MIGRAÇÃO: AUTENTICAÇÃO DE CLIENTES NA VITRINE & HISTÓRICO DE COMPRAS (v2.2)
-- Executar no SQL Editor do Supabase
-- ==============================================================================

-- 1. Coluna de senha (hash seguro) para clientes realizarem login e cadastro na vitrine
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- 2. Colunas para armazenar itens e detalhes da compra na tabela de vendas
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS items JSONB;

-- 3. Índices para consultas de alta performance por telefone e loja
CREATE INDEX IF NOT EXISTS idx_customers_phone_store ON public.customers(store_id, phone);
CREATE INDEX IF NOT EXISTS idx_sales_customer_store ON public.sales(store_id, customer_id);

-- 4. Garantir que as políticas RLS permitam que clientes insiram suas vendas na vitrine
DROP POLICY IF EXISTS "Pedidos anonimos na vitrine" ON public.sales;
CREATE POLICY "Pedidos anonimos na vitrine" ON public.sales FOR INSERT WITH CHECK (true);
