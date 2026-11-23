import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const zapUrl = process.env.ZAP_API_URL;
  const zapKey = process.env.ZAP_API_KEY || "minha-chave-secreta-meufiadim";

  if (!zapUrl) {
    return NextResponse.json({
      configured: false,
      connected: false,
      error: "A URL do robô WhatsApp (ZAP_API_URL) ainda não foi definida nas variáveis da Vercel.",
    });
  }

  try {
    const cleanUrl = zapUrl.replace(/\/$/, "");
    const res = await fetch(`${cleanUrl}/api/qr-json`, {
      headers: {
        "x-api-key": zapKey,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json({
        configured: true,
        connected: false,
        error: err.error || "Erro ao consultar status do WhatsApp.",
      });
    }

    const data = await res.json();
    return NextResponse.json({
      configured: true,
      connected: !!data.connected,
      qrDataUrl: data.qrDataUrl || null,
      waiting: !!data.waiting,
    });
  } catch (err: any) {
    return NextResponse.json({
      configured: true,
      connected: false,
      error: "Não foi possível alcançar o serviço do WhatsApp no momento.",
    });
  }
}
