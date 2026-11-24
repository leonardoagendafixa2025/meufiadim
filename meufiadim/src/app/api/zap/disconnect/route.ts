import { NextResponse } from "next/server";
import { getZapApiUrl, getZapApiKey } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export async function POST() {
  const zapUrl = getZapApiUrl();
  const zapKey = getZapApiKey();

  try {
    const res = await fetch(`${zapUrl}/api/disconnect`, {
      method: "POST",
      headers: {
        "x-api-key": zapKey,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: err.error || "Erro ao desconectar WhatsApp." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Falha ao comunicar desconexão com o robô de WhatsApp." },
      { status: 500 }
    );
  }
}
