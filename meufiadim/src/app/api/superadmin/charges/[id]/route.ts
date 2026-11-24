import { NextResponse } from "next/server";
import {
  authenticateSuperAdmin,
  executeCheckPayment,
  executeCreateCheckout,
  formatCentsBRL,
} from "@/lib/infinitepay";
import { getZapApiKey, getZapApiUrl } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateSuperAdmin(req);
    if (!auth) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const { id: chargeId } = await context.params;
    const { token, supabase } = auth;
    const body = await req.json();
    const { action, adminNotes, slug, transactionNsu } = body;

    const { data: charge } = await supabase
      .from("merchant_charges")
      .select("*, stores(id, name, whatsapp)")
      .eq("id", chargeId)
      .maybeSingle();

    if (!charge) {
      return NextResponse.json({ error: "Cobrança não encontrada" }, { status: 404 });
    }

    if (action === "generate_checkout" || action === "regenerate_checkout") {
      const res = await executeCreateCheckout({
        userToken: token,
        chargeId,
        regenerate: action === "regenerate_checkout",
      });

      if (!res.ok) {
        return NextResponse.json(
          { error: res.data?.error || "Erro ao gerar checkout InfinitePay" },
          { status: res.status || 500 }
        );
      }

      return NextResponse.json({ ok: true, ...res.data });
    }

    if (action === "check_payment") {
      const res = await executeCheckPayment({
        userToken: token,
        chargeId,
        slug,
        transactionNsu,
      });
      return NextResponse.json(res.data, { status: res.status || 200 });
    }

    if (action === "cancel") {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc(
        "cancel_merchant_charge",
        {
          p_charge_id: chargeId,
          p_admin_notes: adminNotes || null,
        }
      );

      if (rpcErr || !rpcRes?.ok) {
        return NextResponse.json(
          { error: rpcErr?.message || rpcRes?.error || "Erro ao cancelar cobrança" },
          { status: 400 }
        );
      }

      return NextResponse.json({ ok: true, result: rpcRes });
    }

    if (action === "confirm_refund") {
      if (charge.status !== "refunded_review" && charge.status !== "paid") {
        return NextResponse.json(
          { error: "Apenas cobranças pagas ou em análise de estorno podem ter estorno confirmado." },
          { status: 400 }
        );
      }

      await supabase
        .from("merchant_charges")
        .update({
          status: "canceled",
          canceled_at: new Date().toISOString(),
          admin_notes: adminNotes || charge.admin_notes || "Estorno confirmado manualmente pelo Super Admin.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", chargeId);

      await supabase.from("infinitepay_webhook_events").insert({
        charge_id: chargeId,
        event_type: "refund_confirmed",
        order_nsu: charge.order_nsu,
        invoice_slug: charge.invoice_slug,
        transaction_nsu: charge.transaction_nsu,
        source: "superadmin",
        verified: true,
        payload: { admin_notes: adminNotes || null },
      });

      const { data: access } = await supabase.rpc("reevaluate_merchant_access", {
        p_merchant_id: charge.merchant_id,
      });

      return NextResponse.json({ ok: true, access });
    }

    if (action === "update_notes") {
      await supabase
        .from("merchant_charges")
        .update({
          admin_notes: adminNotes ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", chargeId);

      return NextResponse.json({ ok: true });
    }

    if (action === "send_whatsapp") {
      if (!charge.stores?.whatsapp) {
        return NextResponse.json(
          { error: "Lojista não possui WhatsApp cadastrado." },
          { status: 400 }
        );
      }
      if (!charge.checkout_url) {
        return NextResponse.json(
          { error: "Gere o link InfinitePay antes de enviar pelo WhatsApp." },
          { status: 400 }
        );
      }

      const dueText = charge.due_date
        ? `\n📅 *Vencimento:* ${new Date(charge.due_date).toLocaleDateString("pt-BR")}`
        : "";

      const msg = [
        `Olá, *${charge.stores.name}*! 👋`,
        ``,
        `Foi gerada uma cobrança administrativa no *MEU FIADIM*:`,
        `📝 *Descrição:* ${charge.description}`,
        `💰 *Valor:* ${formatCentsBRL(charge.amount)}${dueText}`,
        ``,
        `Para regularizar seu acesso (Pix ou Cartão), acesse o link oficial abaixo:`,
        charge.checkout_url,
      ].join("\n");

      const zapRes = await fetch(`${getZapApiUrl()}/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": getZapApiKey(),
        },
        body: JSON.stringify({
          phone: charge.stores.whatsapp,
          text: msg,
        }),
      });

      if (!zapRes.ok) {
        const errData = await zapRes.json().catch(() => ({}));
        return NextResponse.json(
          { error: errData.error || "Erro ao enviar via WhatsApp Baileys" },
          { status: 502 }
        );
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Erro interno ao atualizar cobrança" },
      { status: 500 }
    );
  }
}
