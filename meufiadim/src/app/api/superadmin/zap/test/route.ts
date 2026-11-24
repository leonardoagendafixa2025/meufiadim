import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return createClient(url, key);
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseAdmin = getSupabaseAdmin();
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    const userEmail = (user?.email || "").toLowerCase().trim();
    const superAdmins = [
      "toyesterdayagencia@gmail.com",
      (process.env.NEXT_PUBLIC_SUPERADMIN_EMAIL || "").toLowerCase().trim(),
    ].filter(Boolean);

    if (authError || !user || !superAdmins.includes(userEmail)) {
      return NextResponse.json(
        { error: "Acesso negado." },
        { status: 403 }
      );
    }

    const { phone } = await req.json();
    if (!phone) {
      return NextResponse.json(
        { error: "Informe o telefone com DDD para teste." },
        { status: 400 }
      );
    }

    const zapUrl = process.env.ZAP_API_URL;
    const zapKey = process.env.ZAP_API_KEY || "minha-chave-secreta-meufiadim";

    if (!zapUrl) {
      return NextResponse.json(
        { error: "ZAP_API_URL não configurada no servidor." },
        { status: 500 }
      );
    }

    const cleanUrl = zapUrl.replace(/\/$/, "");
    const res = await fetch(`${cleanUrl}/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": zapKey,
      },
      body: JSON.stringify({
        phone,
        text: `🚀 *MeuFiadim • Teste do Robô Central*\n\nParabéns! O robô de WhatsApp oficial da plataforma está online, conectado e operando 24/7.\n\nHorário do teste: ${new Date().toLocaleTimeString("pt-BR")}`,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json(
        { error: data.error || "Falha ao enviar mensagem pelo robô central." },
        { status: res.status }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Erro interno ao conectar ao robô." },
      { status: 500 }
    );
  }
}
