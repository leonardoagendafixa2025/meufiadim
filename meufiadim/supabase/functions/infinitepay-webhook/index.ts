import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import {
  checkInfinitePayPayment,
  corsHeaders,
  getSupabaseAdminClient,
  jsonResponse,
} from "../_shared/infinitepay.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido" }, 405);
  }

  const supabase = getSupabaseAdminClient();

  try {
    const payload = await req.json().catch(() => null);
    if (!payload) {
      return jsonResponse({ error: "Payload JSON inválido" }, 400);
    }

    // Identificadores enviados pela InfinitePay
    const rawEvent = String(
      payload.event || payload.status || payload.type || "paid"
    ).toLowerCase();
    const orderNsu = payload.order_nsu ? String(payload.order_nsu) : "";
    const invoiceSlug = payload.invoice_slug || payload.slug ? String(payload.invoice_slug || payload.slug) : "";
    const transactionNsu = payload.transaction_nsu ? String(payload.transaction_nsu) : "";

    if (!orderNsu) {
      await supabase.from("infinitepay_webhook_events").insert({
        event_type: `invalid_no_nsu_${rawEvent}`,
        source: "webhook",
        verified: false,
        payload,
      });
      return jsonResponse({ error: "order_nsu ausente" }, 400);
    }

    // 1. Localizar cobrança por order_nsu (direto ou via tabela de tentativas)
    let { data: charge } = await supabase
      .from("merchant_charges")
      .select("*")
      .eq("order_nsu", orderNsu)
      .maybeSingle();

    if (!charge) {
      const { data: attempt } = await supabase
        .from("merchant_charge_attempts")
        .select("charge_id")
        .eq("order_nsu", orderNsu)
        .maybeSingle();

      if (attempt?.charge_id) {
        const resCharge = await supabase
          .from("merchant_charges")
          .select("*")
          .eq("id", attempt.charge_id)
          .maybeSingle();
        charge = resCharge.data;
      }
    }

    if (!charge) {
      await supabase.from("infinitepay_webhook_events").insert({
        event_type: `unmatched_${rawEvent}`,
        order_nsu: orderNsu,
        invoice_slug: invoiceSlug || null,
        transaction_nsu: transactionNsu || null,
        source: "webhook",
        verified: false,
        payload,
      });
      return jsonResponse({ error: "Cobrança não localizada para este order_nsu" }, 404);
    }

    // 2. Tratar evento de ESTORNO (refunded) — sem confiar cegamente: vai para refunded_review
    if (rawEvent.includes("refund")) {
      await supabase
        .from("merchant_charges")
        .update({
          status: "refunded_review",
          updated_at: new Date().toISOString(),
        })
        .eq("id", charge.id);

      await supabase.from("infinitepay_webhook_events").insert({
        charge_id: charge.id,
        event_type: "refunded",
        order_nsu: orderNsu,
        invoice_slug: invoiceSlug || charge.invoice_slug,
        transaction_nsu: transactionNsu || charge.transaction_nsu,
        source: "webhook",
        verified: false, // Exige conferência administrativa manual
        payload,
      });

      return jsonResponse({
        ok: true,
        status: "refunded_review",
        message: "Evento de estorno registrado para análise administrativa.",
      });
    }

    // 3. Tratar eventos CANCELED / PAYMENT_FAILED — nunca cancelar cobrança já paga!
    if (rawEvent.includes("cancel") || rawEvent.includes("fail")) {
      await supabase.from("infinitepay_webhook_events").insert({
        charge_id: charge.id,
        event_type: rawEvent.includes("cancel") ? "canceled" : "payment_failed",
        order_nsu: orderNsu,
        invoice_slug: invoiceSlug || charge.invoice_slug,
        transaction_nsu: transactionNsu || charge.transaction_nsu,
        source: "webhook",
        verified: false,
        payload,
      });

      if (charge.status === "paid") {
        return jsonResponse({
          ok: true,
          ignored: true,
          message: "Cobrança já paga preservada.",
        });
      }

      if (rawEvent.includes("fail")) {
        await supabase
          .from("merchant_charge_attempts")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("order_nsu", orderNsu);
      }

      return jsonResponse({ ok: true, recorded: true });
    }

    // 4. Evento PAID: NUNCA aprovar sem consultar a API oficial payment_check
    const checkSlug = invoiceSlug || charge.invoice_slug || "";
    const checkTxNsu = transactionNsu || charge.transaction_nsu || "";

    if (!checkSlug || !checkTxNsu) {
      await supabase.from("infinitepay_webhook_events").insert({
        charge_id: charge.id,
        event_type: "paid_missing_identifiers",
        order_nsu: orderNsu,
        invoice_slug: checkSlug || null,
        transaction_nsu: checkTxNsu || null,
        source: "webhook",
        verified: false,
        payload,
      });
      return jsonResponse(
        { error: "Identificadores transaction_nsu/slug ausentes para verificação oficial" },
        400
      );
    }

    const checkRes = await checkInfinitePayPayment({
      order_nsu: orderNsu,
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
        event_type: "paid_verification_rejected",
        order_nsu: orderNsu,
        invoice_slug: checkSlug,
        transaction_nsu: checkTxNsu,
        source: "webhook",
        verified: false,
        payload,
        verification_result: checkData,
      });

      return jsonResponse(
        {
          ok: false,
          verified: false,
          error: "Pagamento não confirmado ou valor divergente na verificação oficial InfinitePay.",
        },
        400
      );
    }

    // 5. Confirmação Atômica e Idempotente via RPC Transacional
    const idempotencyKey = `webhook_paid_${orderNsu}_${checkTxNsu}`;
    const { data: confirmRes, error: rpcErr } = await supabase.rpc(
      "confirm_merchant_charge_payment",
      {
        p_charge_id: charge.id,
        p_order_nsu: orderNsu,
        p_invoice_slug: checkSlug,
        p_transaction_nsu: checkTxNsu,
        p_payment_method: checkData.capture_method || payload.capture_method || "unknown",
        p_installments: checkData.installments ? Number(checkData.installments) : 1,
        p_paid_amount: checkData.paid_amount ? Number(checkData.paid_amount) : Number(charge.amount),
        p_receipt_url: checkData.receipt_url || payload.receipt_url || null,
        p_source: "webhook",
        p_idempotency_key: idempotencyKey,
        p_verification_result: checkData,
      }
    );

    if (rpcErr) {
      return jsonResponse({ error: "Erro transacional ao confirmar pagamento: " + rpcErr.message }, 500);
    }

    return jsonResponse({
      ok: true,
      verified: true,
      result: confirmRes,
    });
  } catch (err: any) {
    return jsonResponse({ error: err?.message || "Erro interno no webhook" }, 500);
  }
});
