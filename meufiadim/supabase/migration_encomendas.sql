-- ==============================================================================
-- MIGRAÇÃO: MÓDULO DE ENCOMENDAS COM PAGAMENTO PROGRAMADO (v2.1)
-- Executar no SQL Editor do Supabase
-- ==============================================================================

-- 1. Tabela: Encomendas
CREATE TABLE IF NOT EXISTS public.encomendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  
  -- Detalhes da Encomenda
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  delivery_date DATE,
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  status TEXT CHECK (status IN ('PENDENTE', 'PAGA', 'ATRASADA', 'CANCELADA')) DEFAULT 'PENDENTE',
  notes TEXT,
  
  -- Controle de Cobrança e Notificação WhatsApp
  last_notified_at TIMESTAMPTZ,
  notification_count INTEGER NOT NULL DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela: Histórico de Notificações / Disparos de Cobrança WhatsApp
CREATE TABLE IF NOT EXISTS public.encomenda_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encomenda_id UUID NOT NULL REFERENCES public.encomendas(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  
  idempotency_key TEXT UNIQUE NOT NULL,
  phone TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  message TEXT NOT NULL,
  status TEXT CHECK (status IN ('sent', 'failed', 'pending')) DEFAULT 'sent',
  error_message TEXT,
  
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Coluna opcional em sales para vincular encomenda
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS encomenda_id UUID REFERENCES public.encomendas(id) ON DELETE SET NULL;

-- 4. Índices de Alta Performance
CREATE INDEX IF NOT EXISTS idx_encomendas_store ON public.encomendas(store_id);
CREATE INDEX IF NOT EXISTS idx_encomendas_customer ON public.encomendas(customer_id);
CREATE INDEX IF NOT EXISTS idx_encomendas_status ON public.encomendas(status);
CREATE INDEX IF NOT EXISTS idx_encomendas_due_date ON public.encomendas(due_date);
CREATE INDEX IF NOT EXISTS idx_encomenda_notif_enc ON public.encomenda_notifications(encomenda_id);
CREATE INDEX IF NOT EXISTS idx_encomenda_notif_key ON public.encomenda_notifications(idempotency_key);

-- 5. Políticas de Segurança (Row Level Security - RLS)
ALTER TABLE public.encomendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encomenda_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Dono gerencia suas encomendas" ON public.encomendas;
CREATE POLICY "Dono gerencia suas encomendas" ON public.encomendas FOR ALL USING (
  EXISTS (SELECT 1 FROM public.stores WHERE stores.id = encomendas.store_id AND stores.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "Dono gerencia notificacoes de encomendas" ON public.encomenda_notifications;
CREATE POLICY "Dono gerencia notificacoes de encomendas" ON public.encomenda_notifications FOR ALL USING (
  EXISTS (SELECT 1 FROM public.stores WHERE stores.id = encomenda_notifications.store_id AND stores.owner_id = auth.uid())
);
