import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { name, phone, balance, dueDate, storeName, pixKey, pixCity } =
      await req.json();

    if (!phone || !balance) {
      return NextResponse.json(
        { error: "Telefone e valor são obrigatórios." },
        { status: 400 }
      );
    }

    const formattedBalance = Number(balance).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

    const formattedDate = dueDate
      ? new Date(`${dueDate}T12:00:00`).toLocaleDateString("pt-BR")
      : null;

    const lines = [
      `Olá, ${name}! Tudo bem?`,
      `Passando para lembrar do seu fiado em aberto na *${storeName || "meufiadim"}*:`,
      ``,
      `💰 *Valor em aberto:* ${formattedBalance}`,
    ];

    if (formattedDate) {
      lines.push(`📅 *Data final de pagamento:* ${formattedDate}`);
    }

    lines.push(
      ``,
      pixKey
        ? `Para pagar agora, toque em *"Copiar código Pix"* na mensagem abaixo 👇`
        : `Quando puder fazer o acerto, é só responder por aqui. Obrigado!`
    );

    const response = await fetch(`${process.env.ZAP_API_URL}/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ZAP_API_KEY || "",
      },
      body: JSON.stringify({
        phone,
        text: lines.join("\n"),
        pix: pixKey
          ? {
              pixKey,
              merchantName: storeName || "MEUFIADIM",
              merchantCity: pixCity || "BRASIL",
              amount: Number(balance),
            }
          : null,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || "Erro na API do WhatsApp" },
        { status: response.status }
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível conectar ao serviço de mensagens." },
      { status: 500 }
    );
  }
}
