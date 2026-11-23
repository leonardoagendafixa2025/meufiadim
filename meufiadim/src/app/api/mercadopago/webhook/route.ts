import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const paymentId = body?.data?.id;

    if (!paymentId) {
      return NextResponse.json({ received: true });
    }

    const mpRes = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        },
      }
    );

    const payment = await mpRes.json();

    if (payment.status === "approved" && payment.external_reference) {
      const storeId = payment.external_reference;

      await supabaseAdmin
        .from("stores")
        .update({ status: "active" })
        .eq("id", storeId);

      await supabaseAdmin.from("platform_invoices").insert({
        store_id: storeId,
        period_start: new Date().toISOString().split("T")[0],
        period_end: new Date().toISOString().split("T")[0],
        commission_due: payment.transaction_amount,
        status: "paid",
        pix_txid: String(payment.id),
        paid_at: new Date().toISOString(),
      });

      await supabaseAdmin
        .from("sales")
        .update({ commission_amount: 0 })
        .eq("store_id", storeId);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Webhook error" }, { status: 500 });
  }
}
