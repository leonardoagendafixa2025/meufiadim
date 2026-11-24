-- ==============================================================================
-- SCHEMA DO MEUFIADIM (v2) — Executar no SQL Editor do Supabase
-- ==============================================================================

-- 1. Tabela: Lojas (Tenants)
CREATE TABLE IF NOT EXISTS public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  whatsapp TEXT NOT NULL,
  pix_key TEXT,
  pix_city TEXT DEFAULT 'BRASILIA',
  logo_url TEXT,
  primary_color TEXT DEFAULT '#059669',
  commission_rate NUMERIC(5,2) DEFAULT 5.00,
  billing_cycle TEXT CHECK (billing_cycle IN ('weekly', 'monthly')) DEFAULT 'weekly',
  status TEXT CHECK (status IN ('active', 'blocked')) DEFAULT 'active',
  is_open BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS is_open BOOLEAN DEFAULT true;

-- 2. Tabela: Produtos
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  category TEXT DEFAULT 'Geral',
  stock INTEGER DEFAULT 0,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela: Clientes do Fiado
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  credit_limit NUMERIC(10,2) DEFAULT 0.00,
  balance NUMERIC(10,2) DEFAULT 0.00,
  due_date DATE,
  notify_date DATE,
  last_notified_at DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabela: Faturas da Plataforma (Cobrança de comissão)
CREATE TABLE IF NOT EXISTS public.platform_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_sales NUMERIC(10,2) DEFAULT 0.00,
  commission_due NUMERIC(10,2) DEFAULT 0.00,
  status TEXT CHECK (status IN ('open', 'pending_review', 'paid', 'overdue')) DEFAULT 'open',
  pix_txid TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tabela: Vendas registradas
CREATE TABLE IF NOT EXISTS public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES public.platform_invoices(id) ON DELETE SET NULL,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  commission_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  payment_method TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices de Alta Performance
CREATE INDEX IF NOT EXISTS idx_stores_slug ON public.stores(slug);
CREATE INDEX IF NOT EXISTS idx_stores_owner ON public.stores(owner_id);
CREATE INDEX IF NOT EXISTS idx_products_store ON public.products(store_id);
CREATE INDEX IF NOT EXISTS idx_customers_store ON public.customers(store_id);
CREATE INDEX IF NOT EXISTS idx_sales_store ON public.sales(store_id);
CREATE INDEX IF NOT EXISTS idx_invoices_store ON public.platform_invoices(store_id);

-- ==============================================================================
-- POLÍTICAS DE ACESSO (RLS)
-- ==============================================================================
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- Stores: leitura pública das lojas ativas para vitrine; donos gerenciam sua loja
DROP POLICY IF EXISTS "Lojas publicas visiveis para todos" ON public.stores;
CREATE POLICY "Lojas publicas visiveis para todos" ON public.stores FOR SELECT USING (true);

DROP POLICY IF EXISTS "Dono gerencia sua loja" ON public.stores;
CREATE POLICY "Dono gerencia sua loja" ON public.stores FOR ALL USING (auth.uid() = owner_id);

-- Products: leitura pública para vitrine; donos gerenciam produtos de sua loja
DROP POLICY IF EXISTS "Produtos visiveis para todos" ON public.products;
CREATE POLICY "Produtos visiveis para todos" ON public.products FOR SELECT USING (true);

DROP POLICY IF EXISTS "Dono gerencia seus produtos" ON public.products;
CREATE POLICY "Dono gerencia seus produtos" ON public.products FOR ALL USING (
  EXISTS (SELECT 1 FROM public.stores WHERE stores.id = products.store_id AND stores.owner_id = auth.uid())
);

-- Customers: apenas o dono da loja acessa e gerencia seus clientes
DROP POLICY IF EXISTS "Dono gerencia clientes de fiado" ON public.customers;
CREATE POLICY "Dono gerencia clientes de fiado" ON public.customers FOR ALL USING (
  EXISTS (SELECT 1 FROM public.stores WHERE stores.id = customers.store_id AND stores.owner_id = auth.uid())
);

-- Sales: donos gerenciam vendas da loja; clientes anonimos podem registrar pedido na vitrine
DROP POLICY IF EXISTS "Dono gerencia vendas" ON public.sales;
CREATE POLICY "Dono gerencia vendas" ON public.sales FOR ALL USING (
  EXISTS (SELECT 1 FROM public.stores WHERE stores.id = sales.store_id AND stores.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "Pedidos anonimos na vitrine" ON public.sales;
CREATE POLICY "Pedidos anonimos na vitrine" ON public.sales FOR INSERT WITH CHECK (true);

-- Platform Invoices: dono visualiza suas faturas
DROP POLICY IF EXISTS "Dono visualiza suas faturas" ON public.platform_invoices;
CREATE POLICY "Dono visualiza suas faturas" ON public.platform_invoices FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.stores WHERE stores.id = platform_invoices.store_id AND stores.owner_id = auth.uid())
);
