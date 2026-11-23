# meufiadim (v2) — Plataforma Multi-Tenant de Vendas no Fiado

Este pacote atualizado contém os dois projetos prontos para importar no **Antigravity**:
1. `meufiadim/` — Aplicação Web/PWA (Next.js + Tailwind + Supabase + Mercado Pago + **Remotion** + **Cloudinary** + **Personalização de Logo/Cores**)
2. `meufiadim-zap/` — Servidor WhatsApp (Baileys + Pix Copia e Cola + Agendador diário)

---

## Passo 1: Banco de Dados (Supabase)
1. Acesse seu projeto no Supabase > **SQL Editor**.
2. Copie e execute todo o conteúdo do arquivo `meufiadim/supabase/schema.sql`.
3. Em **Project Settings > API**, copie sua `URL`, `anon key` e `service_role key`.

## Passo 2: Configurar Imagens (Cloudinary)
1. Crie uma conta grátis em cloudinary.com e copie seu **Cloud Name**.
2. Vá em **Settings > Upload > Upload presets > Add upload preset**.
3. Crie o preset `meufiadim_preset` com **Signing Mode = Unsigned** e salve.

## Passo 3: Rodar o App (`meufiadim/`)
1. Entre na pasta `meufiadim` e renomeie `.env.example` para `.env.local`.
2. Preencha suas chaves do Supabase, Cloudinary, SuperAdmin e Mercado Pago.
3. No terminal:
```bash
cd meufiadim
npm install
npm run dev
```
Acesse:
- `http://localhost:3000` (Landing page com animação Remotion)
- `http://localhost:3000/login` (Criar loja / Login)
- `http://localhost:3000/admin` (Painel do lojista: Fiado, Produtos com upload Cloudinary, Aparência/Logo/Cores, Chave Pix e Fatura Mercado Pago)
- `http://localhost:3000/superadmin` (Seu painel de dono)
- `http://localhost:3000/slug-da-loja` (Vitrine pública personalizada)

## Passo 4: Rodar o Robô WhatsApp (`meufiadim-zap/`)
1. Entre na pasta `meufiadim-zap` e renomeie `.env.example` para `.env`.
2. Preencha a `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `API_KEY`.
3. No terminal:
```bash
cd meufiadim-zap
npm install
node index.js
```
Escaneie o QR Code no terminal com o WhatsApp. Para deixar rodando 24h na Oracle Cloud, use `pm2 start index.js --name meufiadim-zap`.
