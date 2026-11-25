-- ==============================================================================
-- MIGRATION v4 — Web Push Notifications & Índices para CRM Preditivo
-- Executar no SQL Editor do Supabase (idempotente e seguro para reexecução)
-- ==============================================================================

-- 1. Tabela de assinaturas Web Push por loja (lojistas e clientes)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('merchant', 'customer')),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subs_store_role ON public.push_subscriptions(store_id, role);
CREATE INDEX IF NOT EXISTS idx_push_subs_customer ON public.push_subscriptions(customer_id);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Dono gerencia assinaturas push da loja" ON public.push_subscriptions;
CREATE POLICY "Dono gerencia assinaturas push da loja" ON public.push_subscriptions FOR ALL USING (
  EXISTS (SELECT 1 FROM public.stores WHERE stores.id = push_subscriptions.store_id AND stores.owner_id = auth.uid())
);

-- 2. Índice para acelerar consultas do Radar de Clientes Sumidos (CRM)
CREATE INDEX IF NOT EXISTS idx_sales_store_customer_created ON public.sales(store_id, customer_id, created_at DESC);
