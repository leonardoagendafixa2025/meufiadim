---
name: meufiadim-regras-negocio
description: Regras oficiais de arquitetura, segurança multi-tenant, cobrança, domínio e integrações do MEU FIADIM. Ative antes de criar ou modificar rotas de API, migrations SQL, cobranças, pedidos, IA ou bot WhatsApp do projeto.
---

# Regras de Negócio e Arquitetura — MEU FIADIM

## 1. Domínios, Hospedagem e Suporte
- **Frontend & APIs (Next.js 15 App Router):** rodando 100% online na **Vercel** (projeto principal `meufiadim-vlqw` → `https://meufiadimdigital.vercel.app`).
- **Bot WhatsApp (`meufiadim-zap`, Express + Baileys):** rodando 100% online no **Railway** (`https://meufiadim-production.up.railway.app`).
- **Nunca usar `meufiadim.com` hardcoded:** utilize resolução dinâmica por request/origem e fallback oficial `https://meufiadimdigital.vercel.app` enquanto o `.com.br` não estiver ativo.
- **WhatsApp Oficial de Suporte:** `31993305095` (`https://wa.me/5531993305095`).

## 2. Segurança Multi-Tenant & Anti-IDOR
- Toda leitura e escrita de dados da loja (`products`, `customers`, `sales`, `encomendas`, `store_coupons`, `fiado_notifications`) **DEVE filtrar explicitamente por `store_id`**.
- Rotas de cliente público (`/[slug]`, `/api/store/customer/orders`, `/api/ai/seller`, `/api/mcp`) **devem validar que `customerId` pertence ao `store_id` informado**.
- Nunca confiar em valores de total, desconto ou taxa enviados pelo client no checkout: recalcular preços pelo catálogo, fretes, cupons e pontos de fidelidade **no servidor**.
- Nunca expor credenciais privadas (`SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, `INFINITEPAY_API_KEY`, `ZAP_API_KEY`) em componentes `"use client"` ou variáveis `NEXT_PUBLIC_*`.

## 3. Regras Financeiras, InfinitePay e Bloqueio
- **Plano comercial na Home pública (`src/app/page.tsx`):** `R$ 0` de mensalidade fixa e **`10%`** sobre vendas registradas (no banco cada loja também possui `stores.commission_rate` configurável pelo SuperAdmin).
- Operações de escrita do lojista (criar encomenda, alterar status de pedido, lançar fiado, disparar cobrança, salvar promoções/skills) **devem verificar `canMerchantAccessSystem(store.id)`**.
- Cobranças administrativas oficiais da plataforma são via **InfinitePay** com confirmação pelo webhook (`payment_check`) e liberação automática apenas após verificação oficial ou pagamento confirmado.

## 4. Padrão Zero-Downtime (Metadata + SQL)
- Configurações de loja e recursos incrementais (`is_open`, `delivery_neighborhoods`, `delivery_cep_ranges`, `fiado_billing_config`, `store_coupons`, `loyalty_config`, `ai_skill_id`, `order_statuses` fallback) devem suportar leitura/gravação resiliente para não quebrar a produção caso uma migration SQL ainda esteja pendente no Supabase.
- Toda nova tabela/coluna SQL deve ser adicionada de forma idempotente (`IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`) com RLS habilitado.

## 5. WhatsApp Bot (Baileys) & IA (MCP)
- Preservar `makeCacheableSignalKeyStore` + `getMessage` no Baileys para evitar falhas de criptografia (*"Aguardando esta mensagem"*).
- Mensagens recebidas em `messages.upsert` devem filtrar `type === "notify"`, `!msg.key.fromMe`, ignorar grupos (`@g.us`), status (`status@broadcast`) e replays antigos, com deduplicação por ID.
- Textos enviados automaticamente a lojistas/clientes no WhatsApp nunca devem exibir termos internos de debug (como nomes de variáveis de ambiente).
