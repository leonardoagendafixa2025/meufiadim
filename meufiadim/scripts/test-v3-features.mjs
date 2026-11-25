import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());

console.log("🔍 Iniciando testes das Fases 1-5 (Rastreamento, Fiado Cron, IA, Cupons/Fidelidade, Relatórios/Estoque)...\n");

// 1. Verificar existência de todos os arquivos das Fases 1-5
const requiredFiles = [
  "supabase/migration_v3_features.sql",
  "src/lib/store-features.ts",
  "src/app/api/orders/route.ts",
  "src/app/api/orders/[id]/status/route.ts",
  "src/app/api/fiado/billing/route.ts",
  "src/app/api/fiado/cron/route.ts",
  "src/app/api/store/promotions/route.ts",
  "src/components/admin/MerchantOrdersTab.tsx",
  "src/components/admin/FiadoBillingCard.tsx",
  "src/components/admin/PromotionsTab.tsx",
  "src/components/admin/ReportsTab.tsx",
  "vercel.json",
];

for (const rel of requiredFiles) {
  assert.ok(fs.existsSync(path.join(root, rel)), `Arquivo obrigatório ausente: ${rel}`);
}
console.log(`✅ 1. Todos os ${requiredFiles.length} arquivos novos existem.`);

// 2. Verificar SQL Migration v3 (colunas, constraints, RLS, índices)
const sql = fs.readFileSync(path.join(root, "supabase/migration_v3_features.sql"), "utf8");
for (const token of [
  "order_status",
  "loyalty_points",
  "low_stock_threshold",
  "store_coupons",
  "fiado_notifications",
  "ENABLE ROW LEVEL SECURITY",
]) {
  assert.ok(sql.includes(token), `Token SQL ausente em migration_v3_features.sql: ${token}`);
}
console.log("✅ 2. Migration v3 possui tabelas, constraints de status e RLS.");

// 3. Verificar segurança e recálculo server-side nas rotas
const orderStatusRoute = fs.readFileSync(
  path.join(root, "src/app/api/orders/[id]/status/route.ts"),
  "utf8"
);
assert.ok(orderStatusRoute.includes("canMerchantAccessSystem"), "Falta bloqueio financeiro em PATCH status");
assert.ok(orderStatusRoute.includes('.eq("store_id", store.id)'), "Falta isolamento multi-tenant em PATCH status");

const fiadoCronRoute = fs.readFileSync(path.join(root, "src/app/api/fiado/cron/route.ts"), "utf8");
assert.ok(fiadoCronRoute.includes("authorizeCronRequest"), "Cron de fiado sem autorização");
assert.ok(fiadoCronRoute.includes("last_notified_at === todayStr"), "Cron sem dedup diário");
assert.ok(fiadoCronRoute.includes("fiado_notifications"), "Cron sem tabela de idempotência");

const customerOrdersRoute = fs.readFileSync(
  path.join(root, "src/app/api/store/customer/orders/route.ts"),
  "utf8"
);
assert.ok(
  customerOrdersRoute.includes("computeOrderDiscounts"),
  "Checkout da vitrine deve recalcular descontos de cupom/fidelidade no servidor"
);
assert.ok(
  customerOrdersRoute.includes("authoritativeItemsSubtotal"),
  "Checkout da vitrine deve validar preços dos produtos no servidor"
);
console.log("✅ 3. Proteções multi-tenant, autorização de cron e recálculo server-side validados.");

// 4. Verificar ferramentas MCP da Fase 3 e Fase 5
const mcpCode = fs.readFileSync(path.join(root, "src/lib/mcp-tools.ts"), "utf8");
for (const toolName of [
  "create_fiado_sale",
  "record_fiado_payment",
  "list_store_orders",
  "update_order_status",
  "get_low_stock_products",
]) {
  assert.ok(mcpCode.includes(`name: "${toolName}"`), `Nova tool MCP ausente: ${toolName}`);
}
console.log("✅ 4. Novas ferramentas MCP (Venda Fiado, Baixa, Pedidos e Estoque Baixo) presentes.");

// 5. Verificar vercel.json com crons válidos
const vercelJson = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
assert.ok(Array.isArray(vercelJson.crons) && vercelJson.crons.length === 2, "Crons inválidos em vercel.json");
assert.ok(vercelJson.crons.some((c) => c.path === "/api/fiado/cron"), "Cron /api/fiado/cron ausente");
console.log("✅ 5. Agendamentos diários em vercel.json validados.\n");

console.log("🎉 TODOS OS TESTES DAS FASES 1 A 5 PASSARAM!");
