import { NextResponse } from "next/server";
import { getZapApiUrl, getZapApiKey } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export async function GET() {
  const zapUrl = getZapApiUrl();
  const zapKey = getZapApiKey();

  try {
    const res = await fetch(`${zapUrl}/api/qr-json`, {
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
        error: err.error || `Erro de conexão HTTP ${res.status} ao consultar o WhatsApp.`,
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
    console.error("Falha ao alcançar robô WhatsApp:", err);
    return NextResponse.json({
      configured: true,
      connected: false,
      error: "O robô oficial de WhatsApp está inicializando ou sincronizando. Aguarde...",
    });
  }
}
