import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const zapUrl = process.env.ZAP_API_URL;
  const zapKey = process.env.ZAP_API_KEY || "minha-chave-secreta-meufiadim";

  if (!zapUrl) {
    return NextResponse.json(
      { error: "ZAP_API_URL não configurada." },
      { status: 400 }
    );
  }

  try {
    const cleanUrl = zapUrl.replace(/\/$/, "");
    const res = await fetch(`${cleanUrl}/api/disconnect`, {
      method: "POST",
      headers: {
        "x-api-key": zapKey,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: err.error || "Erro ao desconectar." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Falha ao conectar com o servidor do WhatsApp." },
      { status: 500 }
    );
  }
}
