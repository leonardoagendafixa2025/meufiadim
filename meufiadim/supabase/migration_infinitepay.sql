-- ==============================================================================
-- MIGRAÇÃO DEFINITIVA: INFINITEPAY CHECKOUT INTEGRADO (SUPER ADMIN -> LOJISTAS)
-- Executar no SQL Editor do Supabase
-- ==============================================================================

-- 1. Evolução da tabela de Lojistas (public.stores) para controle de bloqueio financeiro vs administrativo
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS admin_blocked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS financial_blocked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS regularized_at TIMESTAMPTZ;

-- Sincronizar lojas já bloqueadas manualmente para admin_blocked = true
UPDATE public.stores
SET admin_blocked = true
WHERE status = 'blocked' AND admin_blocked = false AND financial_blocked = false;

-- 2. Tabela principal: Cobranças Avulsas dos Lojistas (merchant_charges)
CREATE TABLE IF NOT EXISTS public.merchant_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  description TEXT NOT NULL,
  reason TEXT,
  admin_notes TEXT,
  amount BIGINT NOT NULL CHECK (amount >= 100), -- Valor em centavos (mínimo R$ 1,00 = 100)
  due_date TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'canceled', 'expired', 'refunded_review')) DEFAULT 'pending',
  order_nsu TEXT UNIQUE NOT NULL,
  invoice_slug TEXT,
  transaction_nsu TEXT,
  checkout_url TEXT,
  payment_method TEXT,
  installments INTEGER,
  paid_amount BIGINT,
  net_amount BIGINT,
  fee_amount BIGINT,
  receipt_url TEXT,
  expires_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabela de Tentativas de Pagamento / Histórico de Links InfinitePay
CREATE TABLE IF NOT EXISTS public.merchant_charge_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_id UUID NOT NULL REFERENCES public.merchant_charges(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_nsu TEXT UNIQUE NOT NULL,
  invoice_slug TEXT,
  transaction_nsu TEXT,
  checkout_url TEXT,
  status TEXT NOT NULL CHECK (status IN ('created', 'paid', 'expired', 'failed', 'canceled')) DEFAULT 'created',
  expires_at TIMESTAMPTZ,
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Tabela de Auditoria de Eventos & Webhooks InfinitePay
CREATE TABLE IF NOT EXISTS public.infinitepay_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_id UUID REFERENCES public.merchant_charges(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  order_nsu TEXT,
  invoice_slug TEXT,
  transaction_nsu TEXT,
  source TEXT NOT NULL DEFAULT 'webhook', -- 'webhook' | 'check_payment' | 'superadmin' | 'checkout'
  verified BOOLEAN NOT NULL DEFAULT false,
  idempotency_key TEXT UNIQUE,
  payload JSONB,
  verification_result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Índices de Alta Performance
CREATE INDEX IF NOT EXISTS idx_merchant_charges_merchant ON public.merchant_charges(merchant_id);
CREATE INDEX IF NOT EXISTS idx_merchant_charges_status ON public.merchant_charges(status);
CREATE INDEX IF NOT EXISTS idx_merchant_charges_order_nsu ON public.merchant_charges(order_nsu);
CREATE INDEX IF NOT EXISTS idx_merchant_attempts_charge ON public.merchant_charge_attempts(charge_id);
CREATE INDEX IF NOT EXISTS idx_merchant_attempts_order_nsu ON public.merchant_charge_attempts(order_nsu);
CREATE INDEX IF NOT EXISTS idx_infinitepay_events_charge ON public.infinitepay_webhook_events(charge_id);
CREATE INDEX IF NOT EXISTS idx_infinitepay_events_order_nsu ON public.infinitepay_webhook_events(order_nsu);

-- 6. Segurança: Row Level Security (RLS)
ALTER TABLE public.merchant_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_charge_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.infinitepay_webhook_events ENABLE ROW LEVEL SECURITY;

-- Lojista pode APENAS VISUALIZAR suas próprias cobranças (nunca inserir, atualizar ou excluir)
DROP POLICY IF EXISTS "Lojista visualiza suas proprias cobrancas" ON public.merchant_charges;
CREATE POLICY "Lojista visualiza suas proprias cobrancas"
  ON public.merchant_charges
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.stores
      WHERE stores.id = merchant_charges.merchant_id
        AND stores.owner_id = auth.uid()
    )
  );

-- Lojista pode APENAS VISUALIZAR suas próprias tentativas de pagamento
DROP POLICY IF EXISTS "Lojista visualiza suas proprias tentativas" ON public.merchant_charge_attempts;
CREATE POLICY "Lojista visualiza suas proprias tentativas"
  ON public.merchant_charge_attempts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.stores
      WHERE stores.id = merchant_charge_attempts.merchant_id
        AND stores.owner_id = auth.uid()
    )
  );

-- Auditoria de eventos: bloqueada para acesso público/lojista (acessível apenas via service_role no backend)
DROP POLICY IF EXISTS "Sem acesso publico a eventos infinitepay" ON public.infinitepay_webhook_events;
CREATE POLICY "Sem acesso publico a eventos infinitepay"
  ON public.infinitepay_webhook_events
  FOR SELECT
  USING (false);

-- 7. Função Centralizada: Reavaliar Bloqueio / Acesso do Lojista
CREATE OR REPLACE FUNCTION public.reevaluate_merchant_access(p_merchant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending_count INTEGER := 0;
  v_admin_blocked BOOLEAN := false;
  v_new_financial_blocked BOOLEAN := false;
  v_new_status TEXT := 'active';
  v_regularized_at TIMESTAMPTZ;
BEGIN
  -- Trava a linha da loja para evitar condição de corrida
  SELECT admin_blocked, regularized_at
  INTO v_admin_blocked, v_regularized_at
  FROM public.stores
  WHERE id = p_merchant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Loja não encontrada');
  END IF;

  -- Conta cobranças que ainda exigem regularização (pending ou expired não cancelada/paga)
  SELECT COUNT(*)
  INTO v_pending_count
  FROM public.merchant_charges
  WHERE merchant_id = p_merchant_id
    AND status IN ('pending', 'expired');

  v_new_financial_blocked := (v_pending_count > 0);

  IF v_admin_blocked OR v_new_financial_blocked THEN
    v_new_status := 'blocked';
  ELSE
    v_new_status := 'active';
    v_regularized_at := NOW();
  END IF;

  UPDATE public.stores
  SET financial_blocked = v_new_financial_blocked,
      status = v_new_status,
      regularized_at = v_regularized_at
  WHERE id = p_merchant_id;

  RETURN jsonb_build_object(
    'ok', true,
    'merchant_id', p_merchant_id,
    'pending_count', v_pending_count,
    'financial_blocked', v_new_financial_blocked,
    'admin_blocked', v_admin_blocked,
    'status', v_new_status,
    'regularized_at', v_regularized_at
  );
END;
$$;

-- 8. Função Centralizada: Verificar se Lojista pode acessar operacionalmente o sistema
CREATE OR REPLACE FUNCTION public.can_merchant_access_system(p_merchant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store RECORD;
  v_pending_count INTEGER := 0;
BEGIN
  SELECT id, status, admin_blocked, financial_blocked, regularized_at
  INTO v_store
  FROM public.stores
  WHERE id = p_merchant_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Loja não encontrada');
  END IF;

  SELECT COUNT(*)
  INTO v_pending_count
  FROM public.merchant_charges
  WHERE merchant_id = p_merchant_id
    AND status IN ('pending', 'expired');

  IF v_store.financial_blocked THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Seu acesso está temporariamente bloqueado devido a uma cobrança pendente. Para voltar a utilizar o MEU FIADIM, realize o pagamento abaixo. Após a confirmação, seu acesso será liberado automaticamente.',
      'pending_charges_count', v_pending_count,
      'financial_blocked', true,
      'admin_blocked', v_store.admin_blocked
    );
  END IF;

  IF v_store.admin_blocked OR v_store.status = 'blocked' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Seu acesso está temporariamente suspenso pela administração do MEU FIADIM.',
      'pending_charges_count', v_pending_count,
      'financial_blocked', false,
      'admin_blocked', true
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'reason', null,
    'pending_charges_count', v_pending_count,
    'financial_blocked', false,
    'admin_blocked', false
  );
END;
$$;

-- 9. Operação SQL Transacional Atômica: Confirmar Pagamento Oficial InfinitePay
CREATE OR REPLACE FUNCTION public.confirm_merchant_charge_payment(
  p_charge_id UUID,
  p_order_nsu TEXT,
  p_invoice_slug TEXT,
  p_transaction_nsu TEXT,
  p_payment_method TEXT,
  p_installments INTEGER,
  p_paid_amount BIGINT,
  p_receipt_url TEXT,
  p_source TEXT,
  p_idempotency_key TEXT,
  p_verification_result JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_charge RECORD;
  v_access JSONB;
  v_fee BIGINT := 0;
BEGIN
  -- Lock da linha para controle de concorrência (evita duas confirmações simultâneas)
  SELECT *
  INTO v_charge
  FROM public.merchant_charges
  WHERE id = p_charge_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cobrança não encontrada');
  END IF;

  -- Idempotência: se já está paga, não reprocessar nem duplicar
  IF v_charge.status = 'paid' THEN
    INSERT INTO public.infinitepay_webhook_events (
      charge_id, event_type, order_nsu, invoice_slug, transaction_nsu,
      source, verified, idempotency_key, verification_result
    ) VALUES (
      v_charge.id, 'paid_duplicate', p_order_nsu, p_invoice_slug, p_transaction_nsu,
      COALESCE(p_source, 'webhook'), true, p_idempotency_key, p_verification_result
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    v_access := public.reevaluate_merchant_access(v_charge.merchant_id);
    RETURN jsonb_build_object(
      'ok', true,
      'already_paid', true,
      'charge_id', v_charge.id,
      'access', v_access
    );
  END IF;

  IF p_paid_amount IS NOT NULL AND p_paid_amount > v_charge.amount THEN
    v_fee := p_paid_amount - v_charge.amount;
  END IF;

  -- Atualizar cobrança para PAID atomicamente
  UPDATE public.merchant_charges
  SET status = 'paid',
      order_nsu = COALESCE(NULLIF(p_order_nsu, ''), order_nsu),
      invoice_slug = COALESCE(NULLIF(p_invoice_slug, ''), invoice_slug),
      transaction_nsu = COALESCE(NULLIF(p_transaction_nsu, ''), transaction_nsu),
      payment_method = COALESCE(NULLIF(p_payment_method, ''), payment_method),
      installments = COALESCE(p_installments, installments),
      paid_amount = COALESCE(p_paid_amount, amount),
      fee_amount = v_fee,
      net_amount = amount,
      receipt_url = COALESCE(NULLIF(p_receipt_url, ''), receipt_url),
      paid_at = COALESCE(paid_at, NOW()),
      updated_at = NOW()
  WHERE id = v_charge.id;

  -- Atualizar tentativa correspondente
  UPDATE public.merchant_charge_attempts
  SET status = 'paid',
      invoice_slug = COALESCE(NULLIF(p_invoice_slug, ''), invoice_slug),
      transaction_nsu = COALESCE(NULLIF(p_transaction_nsu, ''), transaction_nsu),
      updated_at = NOW()
  WHERE charge_id = v_charge.id
    AND (order_nsu = p_order_nsu OR status = 'created');

  -- Registrar auditoria verificada
  INSERT INTO public.infinitepay_webhook_events (
    charge_id, event_type, order_nsu, invoice_slug, transaction_nsu,
    source, verified, idempotency_key, verification_result
  ) VALUES (
    v_charge.id, 'paid', p_order_nsu, p_invoice_slug, p_transaction_nsu,
    COALESCE(p_source, 'webhook'), true, p_idempotency_key, p_verification_result
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  -- Reavaliar acesso do lojista dentro da mesma transação
  v_access := public.reevaluate_merchant_access(v_charge.merchant_id);

  RETURN jsonb_build_object(
    'ok', true,
    'already_paid', false,
    'charge_id', v_charge.id,
    'access', v_access
  );
END;
$$;

-- 10. Operação Transacional: Cancelar Cobrança Internamente (SuperAdmin)
CREATE OR REPLACE FUNCTION public.cancel_merchant_charge(
  p_charge_id UUID,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_charge RECORD;
  v_access JSONB;
BEGIN
  SELECT *
  INTO v_charge
  FROM public.merchant_charges
  WHERE id = p_charge_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cobrança não encontrada');
  END IF;

  IF v_charge.status = 'paid' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cobrança já paga não pode ser cancelada internamente');
  END IF;

  UPDATE public.merchant_charges
  SET status = 'canceled',
      canceled_at = NOW(),
      admin_notes = COALESCE(p_admin_notes, admin_notes),
      updated_at = NOW()
  WHERE id = v_charge.id;

  UPDATE public.merchant_charge_attempts
  SET status = 'canceled',
      updated_at = NOW()
  WHERE charge_id = v_charge.id AND status = 'created';

  INSERT INTO public.infinitepay_webhook_events (
    charge_id, event_type, order_nsu, source, verified, payload
  ) VALUES (
    v_charge.id, 'manual_cancel', v_charge.order_nsu, 'superadmin', true,
    jsonb_build_object('admin_notes', p_admin_notes)
  );

  v_access := public.reevaluate_merchant_access(v_charge.merchant_id);

  RETURN jsonb_build_object(
    'ok', true,
    'charge_id', v_charge.id,
    'access', v_access
  );
END;
$$;
