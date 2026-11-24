# Implantação — Integração Oficial InfinitePay no MEU FIADIM

## 1. Banco de Dados (Supabase SQL Editor)
Execute integralmente o script:
- `meufiadim/supabase/migration_infinitepay.sql`

Isso criará:
- Campos `admin_blocked`, `financial_blocked` e `regularized_at` em `public.stores`.
- Tabelas `public.merchant_charges`, `public.merchant_charge_attempts` e `public.infinitepay_webhook_events`.
- Políticas de RLS estritas (lojista apenas lê suas próprias cobranças; nunca altera status para `paid`).
- RPCs transacionais com lock concorrente `FOR UPDATE`: `reevaluate_merchant_access`, `can_merchant_access_system`, `confirm_merchant_charge_payment` e `cancel_merchant_charge`.

## 2. Secrets no Supabase (Edge Functions)
Configure os segredos no projeto Supabase (via Dashboard ou CLI):
```bash
supabase secrets set INFINITEPAY_API_KEY="SUA_API_KEY_INFINITEPAY"
supabase secrets set INFINITEPAY_HANDLE="SEU_HANDLE_INFINITEPAY"
supabase secrets set SITE_URL="https://meufiadimdigital.vercel.app"
supabase secrets set SUPERADMIN_EMAIL="toyesterdayagencia@gmail.com"
```

## 3. Deploy das Edge Functions
```bash
supabase functions deploy infinitepay-create-checkout
supabase functions deploy infinitepay-webhook --no-verify-jwt
supabase functions deploy infinitepay-check-payment
```
> **Importante:** `infinitepay-webhook` deve aceitar requisições externas da InfinitePay (`--no-verify-jwt`), pois a validação de autenticidade do pagamento é feita consultando oficialmente `POST https://api.checkout.infinitepay.io/payment_check`.

## 4. Variáveis na Vercel (Servidor Next.js — Opcional/Fallback)
Caso deseje que as rotas `/api/superadmin/charges` e `/api/merchant/charges` também operem em fallback direto caso alguma Edge Function não esteja alcançável, configure na Vercel (sem `NEXT_PUBLIC_`):
- `INFINITEPAY_API_KEY`
- `INFINITEPAY_HANDLE`
- `SITE_URL=https://meufiadimdigital.vercel.app`

## 5. Teste Real Controlado (Produção)
1. Acesse `/superadmin` → aba **Financeiro → Cobranças**.
2. Selecione um lojista de teste e crie uma cobrança avulsa de **R$ 1,00**.
3. Verifique que o lojista foi bloqueado imediatamente ao acessar `/admin`.
4. No `/admin` (tela de regularização), clique em **PAGAR AGORA**, pague via **Pix** (R$ 1,00) e aguarde o retorno em `/pagamento-concluido`.
5. Confirme que o status mudou para **Pago**, a auditoria foi gravada e o lojista foi desbloqueado automaticamente.
