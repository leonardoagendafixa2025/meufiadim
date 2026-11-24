import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import {
  checkInfinitePayPayment,
  corsHeaders,
  getSupabaseAdminClient,
  isSuperAdminEmail,
  jsonResponse,
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
      return jsonResponse({ error: "Sessão inválida" }, 401);
    }

    const body = await req.json();
    const { chargeId, orderNsu, slug, transactionNsu } = body;

    if (!chargeId && !orderNsu) {
      return jsonResponse({ error: "chargeId ou orderNsu é obrigatório" }, 400);
    }

    // 1. Buscar cobrança no banco
    let query = supabase
      .from("merchant_charges")
      .select("*, stores(id, name, owner_id)");

    if (chargeId) {
      query = query.eq("id", chargeId);
    } else {
      query = query.eq("order_nsu", orderNsu);
    }

    let { data: charge } = await query.maybeSingle();

    if (!charge && orderNsu) {
      const { data: attempt } = await supabase
        .from("merchant_charge_attempts")
        .select("charge_id")
        .eq("order_nsu", orderNsu)
        .maybeSingle();

      if (attempt?.charge_id) {
        const resCharge = await supabase
          .from("merchant_charges")
          .select("*, stores(id, name, owner_id)")
          .eq("id", attempt.charge_id)
          .maybeSingle();
        charge = resCharge.data;
      }
    }

    if (!charge) {
      return jsonResponse({ error: "Cobrança não encontrada" }, 404);
    }

    // 2. Verificar permissões (SuperAdmin OU dono da loja da cobrança)
    const isSuperAdmin = isSuperAdminEmail(user.email);
    const isMerchantOwner = charge.stores?.owner_id === user.id;

    if (!isSuperAdmin && !isMerchantOwner) {
      return jsonResponse(
        { error: "Acesso negado. Você não tem permissão para consultar esta cobrança." },
        403
      );
    }

    if (charge.status === "paid") {
      return jsonResponse({
        ok: true,
        paid: true,
        status: "paid",
        charge,
      });
    }

    // 3. Buscar identificadores no banco (aceitando slug/transactionNsu auxiliares somente se vinculam ao order_nsu real do banco)
    const checkOrderNsu = charge.order_nsu;
    const checkSlug = charge.invoice_slug || (slug ? String(slug) : "");
    const checkTxNsu = charge.transaction_nsu || (transactionNsu ? String(transactionNsu) : "");

    if (!checkSlug || !checkTxNsu) {
      return jsonResponse({
        ok: true,
        paid: false,
        status: charge.status,
        pending_confirmation: true,
        message: "Aguardando retorno/identificadores da transação InfinitePay.",
        charge,
      });
    }

    // 4. Consultar API oficial InfinitePay
    const checkRes = await checkInfinitePayPayment({
      order_nsu: checkOrderNsu,
      transaction_nsu: checkTxNsu,
      slug: checkSlug,
    });

    const checkData = checkRes.data || {};
    const isOfficiallyPaid =
      checkRes.ok &&
      checkData.success === true &&
      checkData.paid === true &&
      Number(checkData.amount) === Number(charge.amount);

    if (!isOfficiallyPaid) {
      await supabase.from("infinitepay_webhook_events").insert({
        charge_id: charge.id,
        event_type: "payment_check",
        order_nsu: checkOrderNsu,
        invoice_slug: checkSlug,
        transaction_nsu: checkTxNsu,
        source: "check_payment",
        verified: false,
        verification_result: checkData,
      });

      return jsonResponse({
        ok: true,
        paid: false,
        status: charge.status,
        charge,
        infinitepay: checkData,
      });
    }

    // 5. Atualizar atomicamente via RPC
    const idempotencyKey = `check_paid_${checkOrderNsu}_${checkTxNsu}`;
    const { data: confirmRes, error: rpcErr } = await supabase.rpc(
      "confirm_merchant_charge_payment",
      {
        p_charge_id: charge.id,
        p_order_nsu: checkOrderNsu,
        p_invoice_slug: checkSlug,
        p_transaction_nsu: checkTxNsu,
        p_payment_method: checkData.capture_method || "unknown",
        p_installments: checkData.installments ? Number(checkData.installments) : 1,
        p_paid_amount: checkData.paid_amount ? Number(checkData.paid_amount) : Number(charge.amount),
        p_receipt_url: checkData.receipt_url || null,
        p_source: "check_payment",
        p_idempotency_key: idempotencyKey,
        p_verification_result: checkData,
      }
    );

    if (rpcErr) {
      return jsonResponse({ error: rpcErr.message }, 500);
    }

    const { data: updatedCharge } = await supabase
      .from("merchant_charges")
      .select("*")
      .eq("id", charge.id)
      .single();

    return jsonResponse({
      ok: true,
      paid: true,
      status: "paid",
      charge: updatedCharge,
      result: confirmRes,
    });
  } catch (err: any) {
    return jsonResponse({ error: err?.message || "Erro interno ao consultar pagamento" }, 500);
  }
});
