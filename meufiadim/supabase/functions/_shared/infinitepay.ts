// Helper compartilhado para Supabase Edge Functions (Deno) - InfinitePay Checkout Integrado
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

export const INFINITEPAY_API_BASE = "https://api.checkout.infinitepay.io";

export function getEnvSecrets() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const infinitePayApiKey = Deno.env.get("INFINITEPAY_API_KEY") || "";
  const infinitePayHandle = Deno.env.get("INFINITEPAY_HANDLE") || "";
  const siteUrl = (Deno.env.get("SITE_URL") || "https://meufiadimdigital.vercel.app").replace(/\/$/, "");
  const superAdminEmail = (Deno.env.get("SUPERADMIN_EMAIL") || "toyesterdayagencia@gmail.com")
    .toLowerCase()
    .trim();

  return {
    supabaseUrl,
    serviceRoleKey,
    infinitePayApiKey,
    infinitePayHandle,
    siteUrl,
    superAdminEmail,
  };
}

export function getSupabaseAdminClient() {
  const { supabaseUrl, serviceRoleKey } = getEnvSecrets();
  return createClient(supabaseUrl, serviceRoleKey);
}

export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const { superAdminEmail } = getEnvSecrets();
  const normalized = email.toLowerCase().trim();
  return normalized === "toyesterdayagencia@gmail.com" || normalized === superAdminEmail;
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Calcula validade ISO-8601 respeitando vencimento ou padrão de 7 dias.
 */
export function resolveValidUntil(dueDate?: string | null): string {
  const now = Date.now();
  const maxMs = now + 30 * 24 * 60 * 60 * 1000; // Máximo 30 dias
  const defaultMs = now + 7 * 24 * 60 * 60 * 1000; // Padrão 7 dias

  if (!dueDate) {
    return new Date(defaultMs).toISOString();
  }

  const parsed = new Date(dueDate).getTime();
  if (Number.isNaN(parsed) || parsed <= now + 15 * 60 * 1000) {
    // Se vencimento já passou ou é menor que 15 min, garante janela mínima de 24h para regularização
    return new Date(now + 24 * 60 * 60 * 1000).toISOString();
  }

  return new Date(Math.min(parsed, maxMs)).toISOString();
}

/**
 * Consulta oficial de pagamento na API da InfinitePay.
 */
export async function checkInfinitePayPayment(params: {
  order_nsu: string;
  transaction_nsu: string;
  slug: string;
}) {
  const { infinitePayApiKey, infinitePayHandle } = getEnvSecrets();

  if (!infinitePayApiKey || !infinitePayHandle) {
    throw new Error("Secrets INFINITEPAY_API_KEY ou INFINITEPAY_HANDLE não configurados.");
  }

  const response = await fetch(`${INFINITEPAY_API_BASE}/payment_check`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": infinitePayApiKey,
    },
    body: JSON.stringify({
      handle: infinitePayHandle,
      order_nsu: params.order_nsu,
      transaction_nsu: params.transaction_nsu,
      slug: params.slug,
    }),
  });

  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}
