import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const repoRoot = path.resolve(root, "..");

console.log("🔍 Iniciando testes do Servidor MCP e Agentes Vendedor/Copiloto IA...\n");

// 1. Verificar todos os arquivos do ecossistema MCP/IA
const requiredAppFiles = [
  "src/lib/mcp-tools.ts",
  "src/lib/ai-agent.ts",
  "src/app/api/mcp/route.ts",
  "src/app/api/ai/copilot/route.ts",
  "src/app/api/ai/seller/route.ts",
  "src/app/api/ai/whatsapp/route.ts",
  "src/components/admin/AdminCopilotWidget.tsx",
  "src/components/store/StoreSellerChatWidget.tsx",
];

for (const rel of requiredAppFiles) {
  const full = path.join(root, rel);
  assert.ok(fs.existsSync(full), `Arquivo obrigatório ausente: ${rel}`);
}
assert.ok(
  fs.existsSync(path.join(repoRoot, "meufiadim-zap/index.js")),
  "Arquivo meufiadim-zap/index.js ausente"
);
console.log("✅ 1. Todos os 9 arquivos do MCP + Agentes IA + Baileys existem.");

// 2. Segurança: Garantir que nenhuma chave de API ou credencial vaza no client
const srcDir = path.join(root, "src");
function walk(dir) {
  let files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) files = files.concat(walk(p));
    else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) files.push(p);
  }
  return files;
}

for (const file of walk(srcDir)) {
  const content = fs.readFileSync(file, "utf8");
  assert.ok(!content.includes("NEXT_PUBLIC_GEMINI"), `Chave Gemini pública em ${file}`);
  assert.ok(!content.includes("NEXT_PUBLIC_OPENAI"), `Chave OpenAI pública em ${file}`);
  assert.ok(!content.includes("NEXT_PUBLIC_ZAP_API_KEY"), `ZAP API key pública em ${file}`);
  if (content.includes('"use client"') || content.includes("'use client'")) {
    for (const secret of [
      "GEMINI_API_KEY",
      "OPENAI_API_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "INFINITEPAY_API_KEY",
      "ZAP_API_KEY",
    ]) {
      assert.ok(!content.includes(secret), `Segredo ${secret} exposto em componente client ${file}`);
    }
  }
}
console.log("✅ 2. Nenhuma chave de IA ou serviço sensível exposta em componentes client.");

// 3. Validar ferramentas MCP, isolamento de roles e schema Gemini
const mcpCode = fs.readFileSync(path.join(root, "src/lib/mcp-tools.ts"), "utf8");
const expectedTools = [
  "get_store_summary",
  "list_debtor_customers",
  "get_customer_details",
  "create_encomenda",
  "send_whatsapp_charge",
  "search_catalog",
  "get_store_delivery_info",
  "calculate_freight_by_cep",
  "get_my_customer_orders",
  "add_to_cart_suggestion",
];
for (const toolName of expectedTools) {
  assert.ok(mcpCode.includes(`name: "${toolName}"`), `Tool MCP ausente: ${toolName}`);
}
assert.ok(
  mcpCode.includes("if (!tool.roles.includes(ctx.role))"),
  "Verificação de role MCP ausente em executeMcpTool"
);
assert.ok(
  mcpCode.includes("canMerchantAccessSystem(ctx.storeId)"),
  "Bloqueio financeiro não verificado em tools de escrita do lojista"
);
console.log("✅ 3. Todas as 10 ferramentas MCP estão registradas com isolamento por perfil e loja.");

// 4. Validar proteção IDOR e JSON-RPC no servidor MCP e endpoints
const mcpRouteCode = fs.readFileSync(path.join(root, "src/app/api/mcp/route.ts"), "utf8");
assert.ok(mcpRouteCode.includes('method === "initialize"'), "initialize ausente em /api/mcp");
assert.ok(mcpRouteCode.includes('method === "tools/list"'), "tools/list ausente em /api/mcp");
assert.ok(mcpRouteCode.includes('method === "tools/call"'), "tools/call ausente em /api/mcp");
assert.ok(
  mcpRouteCode.includes('.eq("store_id", storeId)'),
  "Validação de customerId por storeId ausente em /api/mcp"
);

const sellerRouteCode = fs.readFileSync(path.join(root, "src/app/api/ai/seller/route.ts"), "utf8");
assert.ok(
  sellerRouteCode.includes('.eq("store_id", store.id)'),
  "Proteção IDOR de customerId ausente em /api/ai/seller"
);

const aiAgentCode = fs.readFileSync(path.join(root, "src/lib/ai-agent.ts"), "utf8");
assert.ok(
  aiAgentCode.includes("if (entries.length === 0)"),
  "Conversão Gemini deve omitir parameters quando a tool não possui propriedades"
);
assert.ok(
  !aiAgentCode.includes("adicione GEMINI_API_KEY"),
  "Mensagens aos usuários não devem citar GEMINI_API_KEY"
);
const zapWebhookCode = fs.readFileSync(path.join(root, "src/app/api/ai/whatsapp/route.ts"), "utf8");
assert.ok(
  !zapWebhookCode.includes("*Copiloto "),
  "Mensagens do WhatsApp não devem exibir o termo técnico Copiloto"
);
console.log("✅ 4. JSON-RPC MCP, proteção IDOR, schema Gemini e textos WhatsApp validados.");

// 5. Validar integração do Baileys WhatsApp Bot
const zapCode = fs.readFileSync(path.join(repoRoot, "meufiadim-zap/index.js"), "utf8");
assert.ok(zapCode.includes("handleIncomingAiMessage"), "Handler de mensagens IA ausente no Baileys");
assert.ok(zapCode.includes("/api/ai/whatsapp"), "Webhook /api/ai/whatsapp ausente no Baileys");
assert.ok(zapCode.includes("msg.key.fromMe"), "Filtro fromMe ausente no Baileys");
assert.ok(zapCode.includes("@g.us"), "Filtro de grupos ausente no Baileys");
assert.ok(zapCode.includes("rememberIncomingMessage"), "Deduplicação de mensagens ausente no Baileys");
console.log("✅ 5. Bot Baileys configurado com filtros anti-loop, deduplicação e webhook IA.");

// 6. Validar integração dos widgets no painel /admin e vitrine /[slug]
const adminPage = fs.readFileSync(path.join(root, "src/app/admin/page.tsx"), "utf8");
const slugPage = fs.readFileSync(path.join(root, "src/app/[slug]/page.tsx"), "utf8");
assert.ok(adminPage.includes("AdminCopilotWidget"), "AdminCopilotWidget não montado em /admin");
assert.ok(slugPage.includes("StoreSellerChatWidget"), "StoreSellerChatWidget não montado em /[slug]");
console.log("✅ 6. Widgets Copiloto IA (/admin) e Vendedor IA (/[slug]) devidamente integrados.\n");

console.log("🎉 TODOS OS TESTES DO MCP E AGENTES IA PASSARAM!");
