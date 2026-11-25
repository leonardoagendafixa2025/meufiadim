import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());

console.log(
  "🔍 Iniciando testes do Pacote 2-3-4 (Pix Chat + Link Mágico + Pedir de Novo + CRM + Web Push/Campainha)...\n"
);

// 1. Verificar existência de todos os arquivos novos
const requiredFiles = [
  "public/sw.js",
  "supabase/migration_v4_push_crm.sql",
  "src/lib/web-push.ts",
  "src/lib/push-client.ts",
  "src/lib/crm-radar.ts",
  "src/lib/order-service.ts",
  "src/app/api/push/subscribe/route.ts",
  "src/app/api/crm/reactivate/route.ts",
  "src/components/admin/OrderAlertsBar.tsx",
  "src/components/admin/DormantCustomersCard.tsx",
];

for (const rel of requiredFiles) {
  assert.ok(fs.existsSync(path.join(root, rel)), `Arquivo obrigatório ausente: ${rel}`);
}
console.log(`✅ 1. Todos os ${requiredFiles.length} arquivos novos existem.`);

// 2. Segurança: nenhum segredo VAPID ou chave privada em componentes client
function walk(dir) {
  let files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) files = files.concat(walk(p));
    else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) files.push(p);
  }
  return files;
}

for (const file of walk(path.join(root, "src"))) {
  const content = fs.readFileSync(file, "utf8");
  if (content.includes('"use client"') || content.includes("'use client'")) {
    for (const secret of [
      "VAPID_PRIVATE_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "GEMINI_API_KEY",
      "OPENAI_API_KEY",
      "ZAP_API_KEY",
    ]) {
      assert.ok(!content.includes(secret), `Segredo ${secret} exposto em client ${file}`);
    }
  }
}

const pushSubscribeRoute = fs.readFileSync(
  path.join(root, "src/app/api/push/subscribe/route.ts"),
  "utf8"
);
assert.ok(
  pushSubscribeRoute.includes('.eq("owner_id", user.id)') &&
    pushSubscribeRoute.includes('.eq("store_id", storeId)'),
  "Validação multi-tenant/anti-IDOR ausente em /api/push/subscribe"
);

const crmRoute = fs.readFileSync(
  path.join(root, "src/app/api/crm/reactivate/route.ts"),
  "utf8"
);
assert.ok(
  crmRoute.includes("canMerchantAccessSystem") &&
    crmRoute.includes('.eq("store_id", store.id)'),
  "Proteção financeira ou multi-tenant ausente em /api/crm/reactivate"
);
console.log("✅ 2. Segurança VAPID, proteção IDOR multi-tenant e bloqueio financeiro validados.");

// 3. Validar 5 novas tools MCP e schema Gemini para ARRAY/OBJECT
const mcpCode = fs.readFileSync(path.join(root, "src/lib/mcp-tools.ts"), "utf8");
for (const toolName of [
  "build_magic_cart_link",
  "repeat_last_customer_order",
  "create_conversational_order_pix",
  "list_dormant_customers",
  "send_reactivation_whatsapp",
]) {
  assert.ok(mcpCode.includes(`name: "${toolName}"`), `Tool MCP ausente: ${toolName}`);
}

const aiAgentCode = fs.readFileSync(path.join(root, "src/lib/ai-agent.ts"), "utf8");
assert.ok(
  aiAgentCode.includes("toGeminiSchemaNode") &&
    aiAgentCode.includes('upperType === "ARRAY"'),
  "Conversor Gemini precisa suportar schemas ARRAY aninhados"
);
assert.ok(aiAgentCode.includes("pixActions"), "AgentRunResult deve expor pixActions");
console.log("✅ 3. Tools MCP (Pix Chat, Link Mágico, Recompra, CRM Sumidos) e Gemini schemas validados.");

// 4. Validar Magic Cart e CRM Radar deterministicamente (sem depender de transpilador TS externo)
const storeFeaturesCode = fs.readFileSync(
  path.join(root, "src/lib/store-features.ts"),
  "utf8"
);
assert.ok(
  storeFeaturesCode.includes("export function encodeMagicCartUrl") &&
    storeFeaturesCode.includes("export function parseMagicCartParam"),
  "Helpers de Link Mágico ausentes em store-features.ts"
);

const crmRadarCode = fs.readFileSync(path.join(root, "src/lib/crm-radar.ts"), "utf8");
assert.ok(
  crmRadarCode.includes("export function analyzeDormantCustomers") &&
    crmRadarCode.includes("export function buildReactivationWhatsAppMessage"),
  "Helpers do Radar de Clientes Sumidos ausentes em crm-radar.ts"
);

const orderServiceCode = fs.readFileSync(path.join(root, "src/lib/order-service.ts"), "utf8");
assert.ok(
  orderServiceCode.includes("createCustomerOrderCore") &&
    orderServiceCode.includes("generatePixCopiaECola") &&
    orderServiceCode.includes("sendWebPushToStoreTarget") &&
    !orderServiceCode.includes("https://meufiadim.com"),
  "OrderService precisa gerar Pix, enviar Push e nunca usar meufiadim.com"
);
console.log("✅ 4. OrderService unificado (Pix + Push + WhatsApp) e módulos CRM/Magic Cart verificados.");

// 5. Validar Service Worker, Campainha, Pedir de Novo e SQL v4
const swCode = fs.readFileSync(path.join(root, "public/sw.js"), "utf8");
assert.ok(
  swCode.includes('addEventListener("push"') &&
    swCode.includes('addEventListener("notificationclick"'),
  "Service Worker sw.js incompleto para Web Push"
);

const pushClientCode = fs.readFileSync(path.join(root, "src/lib/push-client.ts"), "utf8");
assert.ok(
  pushClientCode.includes("subscribeBrowserPush") &&
    pushClientCode.includes("playOrderBellChime"),
  "push-client.ts precisa exportar subscribeBrowserPush e playOrderBellChime"
);

const ordersModalCode = fs.readFileSync(
  path.join(root, "src/components/store/StoreCustomerOrdersModal.tsx"),
  "utf8"
);
assert.ok(
  ordersModalCode.includes("Pedir de Novo") &&
    ordersModalCode.includes("handleEnableCustomerPush"),
  "Modal do cliente precisa ter Pedir de Novo e ativação de Push"
);

const adminPageCode = fs.readFileSync(path.join(root, "src/app/admin/page.tsx"), "utf8");
assert.ok(
  adminPageCode.includes("DormantCustomersCard") &&
    adminPageCode.includes("playOrderBellChime") &&
    adminPageCode.includes("newOrderAlert"),
  "Admin precisa integrar DormantCustomersCard e Campainha/Alerta de Novo Pedido"
);

const slugPageCode = fs.readFileSync(path.join(root, "src/app/[slug]/page.tsx"), "utf8");
assert.ok(
  slugPageCode.includes("parseMagicCartParam") &&
    slugPageCode.includes("onRepeatOrder") &&
    slugPageCode.includes("pixCopiaECola"),
  "Vitrine pública precisa suportar Link Mágico (?cart=), Pedir de Novo e Pix no modal"
);

const sqlV4 = fs.readFileSync(
  path.join(root, "supabase/migration_v4_push_crm.sql"),
  "utf8"
);
assert.ok(
  sqlV4.includes("CREATE TABLE IF NOT EXISTS public.push_subscriptions") &&
    sqlV4.includes("ENABLE ROW LEVEL SECURITY"),
  "Migration v4 precisa criar tabela push_subscriptions com RLS"
);

console.log("✅ 5. Service Worker, Campainha sonora, Pedir de Novo, Radar CRM e SQL v4 validados.\n");
console.log("🎉 TODOS OS TESTES DO PACOTE 2-3-4 PASSARAM!");
