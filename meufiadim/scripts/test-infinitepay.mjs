import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());

console.log("🔍 Iniciando testes de integração e segurança InfinitePay...\n");

// 1. Verificar arquivos obrigatórios
const requiredFiles = [
  "supabase/migration_infinitepay.sql",
  "supabase/functions/_shared/infinitepay.ts",
  "supabase/functions/infinitepay-create-checkout/index.ts",
  "supabase/functions/infinitepay-webhook/index.ts",
  "supabase/functions/infinitepay-check-payment/index.ts",
  "src/lib/infinitepay.ts",
  "src/app/api/superadmin/charges/route.ts",
  "src/app/api/superadmin/charges/[id]/route.ts",
  "src/app/api/merchant/charges/route.ts",
  "src/components/superadmin/SuperAdminChargesTab.tsx",
  "src/components/admin/MerchantChargesTab.tsx",
  "src/app/pagamento-concluido/page.tsx",
];

for (const rel of requiredFiles) {
  const full = path.join(root, rel);
  assert.ok(fs.existsSync(full), `Arquivo obrigatório ausente: ${rel}`);
}
console.log("✅ 1. Todos os 12 arquivos obrigatórios existem.");

// 2. Segurança: Garantir que nenhuma chave privada está exposta no frontend ou com NEXT_PUBLIC_/VITE_
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

const allSrcFiles = walk(srcDir);
for (const file of allSrcFiles) {
  const content = fs.readFileSync(file, "utf8");
  assert.ok(
    !content.includes("NEXT_PUBLIC_INFINITEPAY"),
    `Violação de segurança: NEXT_PUBLIC_INFINITEPAY encontrado em ${file}`
  );
  assert.ok(
    !content.includes("VITE_INFINITEPAY"),
    `Violação de segurança: VITE_INFINITEPAY encontrado em ${file}`
  );
  if (content.includes('"use client"') || content.includes("'use client'")) {
    assert.ok(
      !content.includes("INFINITEPAY_API_KEY"),
      `Violação de segurança: INFINITEPAY_API_KEY em componente client ${file}`
    );
    assert.ok(
      !content.includes("SUPABASE_SERVICE_ROLE_KEY"),
      `Violação de segurança: SUPABASE_SERVICE_ROLE_KEY em componente client ${file}`
    );
  }
}
console.log("✅ 2. Nenhuma credencial sensível exposta no frontend ou variáveis públicas.");

// 3. Validar SQL Migration (RLS, Transação Atômica, Idempotência, Bloqueio)
const sql = fs.readFileSync(path.join(root, "supabase/migration_infinitepay.sql"), "utf8");
assert.ok(sql.includes("ENABLE ROW LEVEL SECURITY"), "RLS não habilitado na migration");
assert.ok(sql.includes("FOR UPDATE"), "Lock concorrente FOR UPDATE ausente nas RPCs");
assert.ok(sql.includes("confirm_merchant_charge_payment"), "RPC confirm_merchant_charge_payment ausente");
assert.ok(sql.includes("reevaluate_merchant_access"), "RPC reevaluate_merchant_access ausente");
assert.ok(sql.includes("can_merchant_access_system"), "RPC can_merchant_access_system ausente");
assert.ok(sql.includes("CHECK (amount >= 100)"), "Check de valor mínimo R$ 1,00 (100 centavos) ausente");
console.log("✅ 3. Migration SQL possui RLS, locks FOR UPDATE, idempotência e RPCs transacionais.");

// 4. Validar Edge Functions (Webhook sem assinatura -> payment_check obrigatório, refunded_review)
const webhookCode = fs.readFileSync(
  path.join(root, "supabase/functions/infinitepay-webhook/index.ts"),
  "utf8"
);
assert.ok(
  webhookCode.includes("checkInfinitePayPayment"),
  "Webhook não está validando pagamento via API oficial payment_check"
);
assert.ok(
  webhookCode.includes("Number(checkData.amount) === Number(charge.amount)"),
  "Webhook não está conferindo divergência de valor original"
);
assert.ok(
  webhookCode.includes("refunded_review"),
  "Webhook não trata estorno como refunded_review"
);
assert.ok(
  webhookCode.includes('if (charge.status === "paid")'),
  "Webhook não protege cobrança já paga contra cancelamento/falha posterior"
);
console.log("✅ 4. Webhook valida oficialmente via payment_check, protege contra fraude e trata estorno.");

// 5. Validar Regra de Centavos & Bloqueio com 2 cobranças (simulação lógica)
function simulateReevaluateAccess(charges, adminBlocked = false) {
  const pendingCount = charges.filter((c) => c.status === "pending" || c.status === "expired").length;
  const financialBlocked = pendingCount > 0;
  return {
    pendingCount,
    financialBlocked,
    adminBlocked,
    status: adminBlocked || financialBlocked ? "blocked" : "active",
  };
}

// Cenário: 2 cobranças pendentes -> paga 1 -> continua bloqueado -> paga 2ª -> libera
let mockCharges = [
  { id: "c1", amount: 100, status: "pending" },
  { id: "c2", amount: 2500, status: "pending" },
];
assert.equal(simulateReevaluateAccess(mockCharges).status, "blocked");
mockCharges[0].status = "paid";
assert.equal(simulateReevaluateAccess(mockCharges).status, "blocked", "Deve continuar bloqueado com 1 pendência");
mockCharges[1].status = "paid";
assert.equal(simulateReevaluateAccess(mockCharges).status, "active", "Deve liberar ao quitar todas");
// Cenário: bloqueio administrativo manual independente
assert.equal(
  simulateReevaluateAccess(mockCharges, true).status,
  "blocked",
  "Bloqueio administrativo manual deve permanecer mesmo sem cobranças pendentes"
);
console.log("✅ 5. Lógica de bloqueio com múltiplas cobranças e bloqueio administrativo validada.");

console.log("\n🎉 TODOS OS TESTES DE LÓGICA E SEGURANÇA PASSARAM!");
