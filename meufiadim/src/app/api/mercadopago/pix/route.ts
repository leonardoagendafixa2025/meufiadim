import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { storeId, storeName, amount } = await req.json();

    const response = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        "X-Idempotency-Key": `${storeId}-${Date.now()}`,
      },
      body: JSON.stringify({
        transaction_amount: Number(amount),
        description: `Comissão meufiadim - ${storeName}`,
        payment_method_id: "pix",
        external_reference: storeId,
        notification_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/mercadopago/webhook`,
        payer: {
          email: "fatura@meufiadim.com",
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || "Erro ao gerar Pix no Mercado Pago" },
        { status: 400 }
      );
    }

    const txData = data.point_of_interaction?.transaction_data;
    return NextResponse.json({
      payment_id: data.id,
      qr_code: txData?.qr_code,
      qr_code_base64: txData?.qr_code_base64,
    });
  } catch {
    return NextResponse.json(
      { error: "Erro interno ao conectar com Mercado Pago." },
      { status: 500 }
    );
  }
}
