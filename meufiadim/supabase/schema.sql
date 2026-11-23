-- Execute este script no SQL Editor do Supabase

-- 1. Lojas (Tenants)
CREATE TABLE IF NOT EXISTS stores (
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Caso já tenha criado a tabela stores antes, rode os ALTERs abaixo com segurança:
ALTER TABLE stores ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#059669';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS pix_key TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS pix_city TEXT DEFAULT 'BRASILIA';

-- 2. Produtos
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  category TEXT DEFAULT 'Geral',
  stock INTEGER DEFAULT 0,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Clientes do Fiado
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  credit_limit NUMERIC(10,2) DEFAULT 0,
  balance NUMERIC(10,2) DEFAULT 0,
  due_date DATE,
  notify_date DATE,
  last_notified_at DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Faturas da Plataforma (comissão paga via Mercado Pago)
CREATE TABLE IF NOT EXISTS platform_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_sales NUMERIC(10,2) DEFAULT 0,
  commission_due NUMERIC(10,2) DEFAULT 0,
  status TEXT CHECK (status IN ('open', 'pending_review', 'paid', 'overdue')) DEFAULT 'open',
  pix_txid TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Vendas registradas
CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES platform_invoices(id) ON DELETE SET NULL,
  total_amount NUMERIC(10,2) NOT NULL,
  commission_amount NUMERIC(10,2) NOT NULL,
  payment_method TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
