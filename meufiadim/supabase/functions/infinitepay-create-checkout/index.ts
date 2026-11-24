import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import {
  corsHeaders,
  getEnvSecrets,
  getSupabaseAdminClient,
  INFINITEPAY_API_BASE,
  isSuperAdminEmail,
  jsonResponse,
  resolveValidUntil,
} from "../_shared/infinitepay.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Não autenticado" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const supabase = getSupabaseAdminClient();

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser(token);

    if (authErr || !user) {
      return jsonResponse({ error: "Sessão inválida ou expirada" }, 401);
    }

    const body = await req.json();
    const { chargeId, regenerate } = body;

    if (!chargeId) {
      return jsonResponse({ error: "chargeId é obrigatório" }, 400);
    }

    // 1. Buscar a cobrança diretamente no banco (nunca confiar em valores do frontend)
    const { data: charge, error: chargeErr } = await supabase
      .from("merchant_charges")
      .select("*, stores(id, name, owner_id)")
      .eq("id", chargeId)
      .maybeSingle();

    if (chargeErr || !charge) {
      return jsonResponse({ error: "Cobrança não encontrada" }, 404);
    }

    const isSuperAdmin = isSuperAdminEmail(user.email);
    const isMerchantOwner = charge.stores?.owner_id === user.id;

    // Apenas Super Admin pode criar/regenerar checkout livremente;
    // O lojista dono da loja só pode solicitar/recuperar link de sua própria cobrança pendente se não existir link válido.
    if (!isSuperAdmin && !isMerchantOwner) {
      return jsonResponse({ error: "Acesso negado" }, 403);
    }

    if (regenerate && !isSuperAdmin) {
      return jsonResponse(
        { error: "Apenas o Super Admin pode regenerar links manualmente" },
        403
      );
    }

    if (charge.status === "paid") {
      return jsonResponse({ error: "Esta cobrança já está paga" }, 400);
    }

    if (charge.status === "canceled") {
      return jsonResponse({ error: "Esta cobrança foi cancelada" }, 400);
    }

    if (!charge.amount || Number(charge.amount) < 100) {
      return jsonResponse(
        { error: "Valor inválido. Mínimo permitido é R$ 1,00 (100 centavos)." },
        400
      );
    }

    // 2. Verificar se já existe checkout_url válido e não expirado para evitar duplicidade
    const now = Date.now();
    const existingExpiresAt = charge.expires_at ? new Date(charge.expires_at).getTime() : 0;
    const hasValidExistingLink =
      Boolean(charge.checkout_url) &&
      charge.status === "pending" &&
      (!charge.expires_at || existingExpiresAt > now + 5 * 60 * 1000);

    if (hasValidExistingLink && !regenerate) {
      return jsonResponse({
        ok: true,
        reused: true,
        checkout_url: charge.checkout_url,
        order_nsu: charge.order_nsu,
        invoice_slug: charge.invoice_slug,
        expires_at: charge.expires_at,
      });
    }

    // 3. Validar secrets InfinitePay no servidor
    const { infinitePayApiKey, infinitePayHandle, siteUrl, supabaseUrl } = getEnvSecrets();
    if (!infinitePayApiKey || !infinitePayHandle) {
      return jsonResponse(
        { error: "Credenciais INFINITEPAY_API_KEY ou INFINITEPAY_HANDLE não configuradas." },
        500
      );
    }

    // 4. Gerar order_nsu único para esta tentativa (ou reutilizar se ainda não houve tentativa enviada)
    const attemptOrderNsu = charge.checkout_url
      ? `FIADIM-${charge.id.slice(0, 8).toUpperCase()}-${Date.now()}`
      : charge.order_nsu;

    const validUntil = resolveValidUntil(charge.due_date);

    const infinitePayload = {
      handle: infinitePayHandle,
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
    };

    const ipRes = await fetch(`${INFINITEPAY_API_BASE}/links`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": infinitePayApiKey,
      },
      body: JSON.stringify(infinitePayload),
    });

    const ipData = await ipRes.json().catch(() => ({}));

    if (!ipRes.ok) {
      return jsonResponse(
        {
          error: ipData?.message || ipData?.error || "Erro ao criar checkout na InfinitePay",
          details: ipData,
        },
        ipRes.status >= 400 ? ipRes.status : 502
      );
    }

    const checkoutUrl = ipData.url || ipData.checkout_url || ipData.link;
    const urlSlug = checkoutUrl
      ? String(checkoutUrl).split("/").filter(Boolean).pop() || null
      : null;
    const invoiceSlug = ipData.slug || ipData.invoice_slug || urlSlug || null;

    if (!checkoutUrl) {
      return jsonResponse(
        { error: "InfinitePay não retornou checkout_url válido", details: ipData },
        502
      );
    }

    // 5. Marcar tentativas antigas expiradas se estiver regenerando
    if (charge.checkout_url) {
      await supabase
        .from("merchant_charge_attempts")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("charge_id", charge.id)
        .eq("status", "created");
    }

    // 6. Registrar nova tentativa preservando histórico
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

    // 7. Atualizar cobrança com link ativo atual
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

    // 8. Registrar auditoria
    await supabase.from("infinitepay_webhook_events").insert({
      charge_id: charge.id,
      event_type: "checkout_created",
      order_nsu: attemptOrderNsu,
      invoice_slug: invoiceSlug,
      source: "checkout",
      verified: true,
      payload: {
        merchant_id: charge.merchant_id,
        amount: charge.amount,
        valid_until: validUntil,
      },
      verification_result: { checkout_url: checkoutUrl },
    });

    return jsonResponse({
      ok: true,
      reused: false,
      checkout_url: checkoutUrl,
      order_nsu: attemptOrderNsu,
      invoice_slug: invoiceSlug,
      expires_at: validUntil,
    });
  } catch (err: any) {
    return jsonResponse({ error: err?.message || "Erro interno ao criar checkout" }, 500);
  }
});
