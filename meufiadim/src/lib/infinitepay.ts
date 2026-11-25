import { createClient } from "@supabase/supabase-js";

export const INFINITEPAY_API_BASE = "https://api.checkout.infinitepay.io";

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return createClient(url, key);
}

export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.toLowerCase().trim();
  const envEmail = (process.env.NEXT_PUBLIC_SUPERADMIN_EMAIL || "").toLowerCase().trim();
  return normalized === "toyesterdayagencia@gmail.com" || (Boolean(envEmail) && normalized === envEmail);
}

export async function authenticateRequestUser(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;

  const supabase = getSupabaseAdmin();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) return null;
  return { user, token, supabase };
}

export async function authenticateSuperAdmin(req: Request) {
  const auth = await authenticateRequestUser(req);
  if (!auth) return null;
  if (!isSuperAdminEmail(auth.user.email)) return null;
  return auth;
}

export async function authenticateMerchant(req: Request) {
  const auth = await authenticateRequestUser(req);
  if (!auth) return null;

  const { data: store } = await auth.supabase
    .from("stores")
    .select("*")
    .eq("owner_id", auth.user.id)
    .maybeSingle();

  if (!store) return null;
  return { ...auth, store };
}

/**
 * Função centralizada que determina se o lojista pode acessar operacionalmente o sistema.
 * Respeita tanto bloqueio financeiro (financial_blocked) quanto bloqueio manual (admin_blocked),
 * permitindo que o Super Admin libere manualmente uma loja mesmo mantendo cobranças pendentes em aberto.
 */
export async function canMerchantAccessSystem(merchantId: string) {
  const supabase = getSupabaseAdmin();

  const [{ data: store }, { count }] = await Promise.all([
    supabase
      .from("stores")
      .select("id, status, admin_blocked, financial_blocked")
      .eq("id", merchantId)
      .maybeSingle(),
    supabase
      .from("merchant_charges")
      .select("id", { count: "exact", head: true })
      .eq("merchant_id", merchantId)
      .in("status", ["pending", "expired"]),
  ]);

  if (!store) {
    return {
      allowed: false,
      reason: "Loja não encontrada.",
      pending_charges_count: 0,
      financial_blocked: false,
      admin_blocked: false,
    };
  }

  const pendingCount = count || 0;

  if (store.financial_blocked) {
    return {
      allowed: false,
      reason:
        "Seu acesso está temporariamente bloqueado devido a uma cobrança pendente. Para voltar a utilizar o MEU FIADIM, realize o pagamento abaixo. Após a confirmação, seu acesso será liberado automaticamente.",
      pending_charges_count: pendingCount,
      financial_blocked: true,
      admin_blocked: Boolean(store.admin_blocked),
    };
  }

  if (store.admin_blocked || store.status === "blocked") {
    return {
      allowed: false,
      reason: "Seu acesso está temporariamente suspenso pela administração do MEU FIADIM.",
      pending_charges_count: pendingCount,
      financial_blocked: false,
      admin_blocked: true,
    };
  }

  return {
    allowed: true,
    reason: null,
    pending_charges_count: pendingCount,
    financial_blocked: false,
    admin_blocked: false,
  };
}

export function resolveValidUntil(dueDate?: string | null): string {
  const now = Date.now();
  const maxMs = now + 30 * 24 * 60 * 60 * 1000;
  const defaultMs = now + 7 * 24 * 60 * 60 * 1000;

  if (!dueDate) {
    return new Date(defaultMs).toISOString();
  }

  const parsed = new Date(dueDate).getTime();
  if (Number.isNaN(parsed) || parsed <= now + 15 * 60 * 1000) {
    return new Date(now + 24 * 60 * 60 * 1000).toISOString();
  }

  return new Date(Math.min(parsed, maxMs)).toISOString();
}

export function formatCentsBRL(cents?: number | null): string {
  return (Number(cents || 0) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/**
 * Chama a Edge Function `infinitepay-create-checkout` no Supabase ou executa no servidor Next.js como fallback
 * caso a Edge Function ainda não esteja publicada (404), mantendo todas as chaves apenas no servidor.
 */
export async function executeCreateCheckout(params: {
  userToken: string;
  chargeId: string;
  regenerate?: boolean;
}) {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  // 1. Tentar chamar Supabase Edge Function oficial
  try {
    const edgeRes = await fetch(`${supabaseUrl}/functions/v1/infinitepay-create-checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.userToken}`,
        apikey: anonKey,
      },
      body: JSON.stringify({
        chargeId: params.chargeId,
        regenerate: Boolean(params.regenerate),
      }),
    });

    if (edgeRes.status !== 404) {
      const data = await edgeRes.json().catch(() => ({}));
      return { ok: edgeRes.ok, status: edgeRes.status, data };
    }
  } catch {
    // Continua para fallback local caso Edge Function não esteja alcançável
  }

  // 2. Fallback seguro no servidor Vercel/Next.js (nunca expõe segredos no browser)
  const apiKey = process.env.INFINITEPAY_API_KEY || "";
  const handle = process.env.INFINITEPAY_HANDLE || "";
  const siteUrl = (
    process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://meufiadimdigital.vercel.app"
  ).replace(/\/$/, "");

  if (!apiKey || !handle) {
    return {
      ok: false,
      status: 500,
      data: {
        error:
          "Edge Function infinitepay-create-checkout não publicada e secrets INFINITEPAY_API_KEY / INFINITEPAY_HANDLE ausentes no servidor.",
      },
    };
  }

  const supabase = getSupabaseAdmin();
  const { data: charge } = await supabase
    .from("merchant_charges")
    .select("*")
    .eq("id", params.chargeId)
    .maybeSingle();

  if (!charge) {
    return { ok: false, status: 404, data: { error: "Cobrança não encontrada." } };
  }

  const now = Date.now();
  const existingExpires = charge.expires_at ? new Date(charge.expires_at).getTime() : 0;
  if (
    charge.checkout_url &&
    charge.status === "pending" &&
    (!charge.expires_at || existingExpires > now + 5 * 60 * 1000) &&
    !params.regenerate
  ) {
    return {
      ok: true,
      status: 200,
      data: {
        ok: true,
        reused: true,
        checkout_url: charge.checkout_url,
        order_nsu: charge.order_nsu,
        invoice_slug: charge.invoice_slug,
        expires_at: charge.expires_at,
      },
    };
  }

  const attemptOrderNsu = charge.checkout_url
    ? `FIADIM-${charge.id.slice(0, 8).toUpperCase()}-${Date.now()}`
    : charge.order_nsu;

  const validUntil = resolveValidUntil(charge.due_date);

  const ipRes = await fetch(`${INFINITEPAY_API_BASE}/links`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
    },
    body: JSON.stringify({
      handle,
      order_nsu: attemptOrderNsu,
      redirect_url: `${siteUrl}/pagamento-concluido?order_nsu=${encodeURIComponent(attemptOrderNsu)}`,
      webhook_url: `${supabaseUrl}/functions/v1/infinitepay-webhook`,
      items: [
        {
          quantity: 1,
          price: Number(charge.amount),
          description: charge.description || "Cobrança avulsa MEU FIADIM",
        },
      ],
      options: {
        single_payment: true,
        payment_methods_enabled: ["credit_card", "pix"],
        valid_until: validUntil,
      },
    }),
  });

  const ipData = await ipRes.json().catch(() => ({}));
  if (!ipRes.ok) {
    return {
      ok: false,
      status: ipRes.status,
      data: { error: ipData?.message || ipData?.error || "Erro na API da InfinitePay", details: ipData },
    };
  }

  const checkoutUrl = ipData.url || ipData.checkout_url || ipData.link;
  const urlSlug = checkoutUrl
    ? String(checkoutUrl).split("/").filter(Boolean).pop() || null
    : null;
  const invoiceSlug = ipData.slug || ipData.invoice_slug || urlSlug || null;

  if (!checkoutUrl) {
    return { ok: false, status: 502, data: { error: "InfinitePay não retornou checkout_url" } };
  }

  if (charge.checkout_url) {
    await supabase
      .from("merchant_charge_attempts")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("charge_id", charge.id)
      .eq("status", "created");
  }

  await supabase.from("merchant_charge_attempts").insert({
    charge_id: charge.id,
    merchant_id: charge.merchant_id,
    order_nsu: attemptOrderNsu,
    invoice_slug: invoiceSlug,
    checkout_url: checkoutUrl,
    status: "created",
    expires_at: validUntil,
    raw_response: ipData,
  });

  await supabase
    .from("merchant_charges")
    .update({
      status: "pending",
      order_nsu: attemptOrderNsu,
      invoice_slug: invoiceSlug,
      checkout_url: checkoutUrl,
      expires_at: validUntil,
      updated_at: new Date().toISOString(),
    })
    .eq("id", charge.id);

  return {
    ok: true,
    status: 200,
    data: {
      ok: true,
      reused: false,
      checkout_url: checkoutUrl,
      order_nsu: attemptOrderNsu,
      invoice_slug: invoiceSlug,
      expires_at: validUntil,
    },
  };
}

/**
 * Chama a Edge Function `infinitepay-check-payment` ou fallback oficial no servidor.
 */
export async function executeCheckPayment(params: {
  userToken: string;
  chargeId?: string;
  orderNsu?: string;
  slug?: string;
  transactionNsu?: string;
}) {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  try {
    const edgeRes = await fetch(`${supabaseUrl}/functions/v1/infinitepay-check-payment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.userToken}`,
        apikey: anonKey,
      },
      body: JSON.stringify({
        chargeId: params.chargeId,
        orderNsu: params.orderNsu,
        slug: params.slug,
        transactionNsu: params.transactionNsu,
      }),
    });

    if (edgeRes.status !== 404) {
      const data = await edgeRes.json().catch(() => ({}));
      return { ok: edgeRes.ok, status: edgeRes.status, data };
    }
  } catch {
    // Fallback
  }

  const apiKey = process.env.INFINITEPAY_API_KEY || "";
  const handle = process.env.INFINITEPAY_HANDLE || "";

  const supabase = getSupabaseAdmin();
  let query = supabase.from("merchant_charges").select("*");
  if (params.chargeId) {
    query = query.eq("id", params.chargeId);
  } else if (params.orderNsu) {
    query = query.eq("order_nsu", params.orderNsu);
  }

  const { data: charge } = await query.maybeSingle();
  if (!charge) {
    return { ok: false, status: 404, data: { error: "Cobrança não encontrada" } };
  }

  if (charge.status === "paid") {
    return { ok: true, status: 200, data: { ok: true, paid: true, status: "paid", charge } };
  }

  const checkSlug = charge.invoice_slug || params.slug || "";
  const checkTxNsu = charge.transaction_nsu || params.transactionNsu || "";

  if (!checkSlug || !checkTxNsu) {
    return {
      ok: true,
      status: 200,
      data: {
        ok: true,
        paid: false,
        status: charge.status,
        pending_confirmation: true,
        charge,
      },
    };
  }

  if (!apiKey || !handle) {
    return {
      ok: false,
      status: 500,
      data: { error: "Secrets InfinitePay não configurados no servidor." },
    };
  }

  const checkRes = await fetch(`${INFINITEPAY_API_BASE}/payment_check`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
    },
    body: JSON.stringify({
      handle,
      order_nsu: charge.order_nsu,
      transaction_nsu: checkTxNsu,
      slug: checkSlug,
    }),
  });

  const checkData = await checkRes.json().catch(() => ({}));
  const isOfficiallyPaid =
    checkRes.ok &&
    checkData.success === true &&
    checkData.paid === true &&
    Number(checkData.amount) === Number(charge.amount);

  if (!isOfficiallyPaid) {
    return {
      ok: true,
      status: 200,
      data: { ok: true, paid: false, status: charge.status, charge, infinitepay: checkData },
    };
  }

  const { data: confirmRes, error: rpcErr } = await supabase.rpc(
    "confirm_merchant_charge_payment",
    {
      p_charge_id: charge.id,
      p_order_nsu: charge.order_nsu,
      p_invoice_slug: checkSlug,
      p_transaction_nsu: checkTxNsu,
      p_payment_method: checkData.capture_method || "unknown",
      p_installments: checkData.installments ? Number(checkData.installments) : 1,
      p_paid_amount: checkData.paid_amount ? Number(checkData.paid_amount) : Number(charge.amount),
      p_receipt_url: checkData.receipt_url || null,
      p_source: "check_payment",
      p_idempotency_key: `check_paid_${charge.order_nsu}_${checkTxNsu}`,
      p_verification_result: checkData,
    }
  );

  if (rpcErr) {
    return { ok: false, status: 500, data: { error: rpcErr.message } };
  }

  const { data: updatedCharge } = await supabase
    .from("merchant_charges")
    .select("*")
    .eq("id", charge.id)
    .single();

  return {
    ok: true,
    status: 200,
    data: { ok: true, paid: true, status: "paid", charge: updatedCharge, result: confirmRes },
  };
}
