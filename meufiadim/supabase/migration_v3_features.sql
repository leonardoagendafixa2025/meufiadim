-- ==============================================================================
-- MIGRATION v3 — Rastreamento de Pedidos, Régua de Fiado, Cupons, Fidelidade e Estoque
-- Executar no SQL Editor do Supabase (idempotente e seguro para reexecução)
-- ==============================================================================

-- 1. Evolução da tabela sales para rastreamento ao vivo, cupons e fidelidade
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS items JSONB,
  ADD COLUMN IF NOT EXISTS order_status TEXT DEFAULT 'RECEBIDO',
  ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS delivery_type TEXT,
  ADD COLUMN IF NOT EXISTS delivery_address TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS coupon_code TEXT,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS loyalty_points_earned INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loyalty_reward_used NUMERIC(10,2) NOT NULL DEFAULT 0.00;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sales_order_status_check'
  ) THEN
    ALTER TABLE public.sales
      ADD CONSTRAINT sales_order_status_check
      CHECK (order_status IN ('RECEBIDO', 'EM_PREPARO', 'SAIU_ENTREGA', 'ENTREGUE', 'CANCELADO'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sales_store_status ON public.sales(store_id, order_status);

-- 2. Pontos de fidelidade no cliente
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS loyalty_points INTEGER NOT NULL DEFAULT 0;

-- 3. Configurações extras da loja
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER NOT NULL DEFAULT 3;

-- 4. Tabela opcional de Cupons de Desconto por loja
CREATE TABLE IF NOT EXISTS public.store_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value NUMERIC(10,2) NOT NULL CHECK (discount_value > 0),
  min_order NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  active BOOLEAN NOT NULL DEFAULT true,
  uses_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, code)
);

CREATE INDEX IF NOT EXISTS idx_store_coupons_store ON public.store_coupons(store_id);
ALTER TABLE public.store_coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Dono gerencia cupons da loja" ON public.store_coupons;
CREATE POLICY "Dono gerencia cupons da loja" ON public.store_coupons FOR ALL USING (
  EXISTS (SELECT 1 FROM public.stores WHERE stores.id = store_coupons.store_id AND stores.owner_id = auth.uid())
);

-- 5. Log de notificações da Régua Automática de Fiado (idempotência por dia/etapa)
CREATE TABLE IF NOT EXISTS public.fiado_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  idempotency_key TEXT UNIQUE NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('BEFORE_DUE', 'DUE_TODAY', 'OVERDUE')),
  amount NUMERIC(10,2) NOT NULL,
  phone TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')) DEFAULT 'sent',
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fiado_notif_store ON public.fiado_notifications(store_id);
ALTER TABLE public.fiado_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Dono visualiza notificacoes de fiado" ON public.fiado_notifications;
CREATE POLICY "Dono visualiza notificacoes de fiado" ON public.fiado_notifications FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.stores WHERE stores.id = fiado_notifications.store_id AND stores.owner_id = auth.uid())
);
