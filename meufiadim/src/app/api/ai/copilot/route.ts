import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/encomendas";
import { runAiAgent, type ChatTurn } from "@/lib/ai-agent";

export const dynamic = "force-dynamic";

/**
 * POST /api/ai/copilot
 * Endpoint do Copiloto IA exclusivo do lojista autenticado no /admin.
 */
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const supabase = getSupabaseAdmin();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser(token);

    if (authErr || !user) {
      return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
    }

    const { data: store } = await supabase
      .from("stores")
      .select("id, name, status")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!store) {
      return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
    }

    const body = await req.json();
    const message = String(body.message || "").trim();
    const history: ChatTurn[] = Array.isArray(body.history) ? body.history : [];

    if (!message) {
      return NextResponse.json({ error: "Mensagem é obrigatória" }, { status: 400 });
    }

    const result = await runAiAgent({
      message,
      history,
      ctx: {
        role: "merchant",
        storeId: store.id,
        userId: user.id,
      },
      storeName: store.name,
    });

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Erro interno no Copiloto IA." },
      { status: 500 }
    );
  }
}
