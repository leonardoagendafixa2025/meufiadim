import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/encomendas";
import { runAiAgent, type ChatTurn } from "@/lib/ai-agent";

export const dynamic = "force-dynamic";

/**
 * POST /api/ai/seller
 * Endpoint do Vendedor IA na vitrine pública /[slug].
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { storeId, storeSlug, customerId, message, history } = body;

    const cleanMsg = String(message || "").trim();
    if (!cleanMsg) {
      return NextResponse.json({ error: "Mensagem é obrigatória" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    let query = supabase.from("stores").select("id, owner_id, name, slug, status");
    if (storeId) {
      query = query.eq("id", storeId);
    } else if (storeSlug) {
      query = query.eq("slug", storeSlug);
    } else {
      return NextResponse.json({ error: "storeId ou storeSlug é obrigatório" }, { status: 400 });
    }

    const { data: store } = await query.maybeSingle();
    if (!store) {
      return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
    }

    let skillId: string | null = null;
    let customInstructions: string | null = null;
    if (store.owner_id) {
      try {
        const { data: ownerData } = await supabase.auth.admin.getUserById(store.owner_id);
        skillId = ownerData?.user?.user_metadata?.ai_skill_id || null;
        customInstructions = ownerData?.user?.user_metadata?.ai_custom_instructions || null;
      } catch {}
    }

    // Valida que o customerId informado realmente pertence àquela loja (proteção contra IDOR)
    let verifiedCustomerId: string | null = null;
    if (customerId) {
      const { data: cust } = await supabase
        .from("customers")
        .select("id")
        .eq("id", customerId)
        .eq("store_id", store.id)
        .maybeSingle();
      if (cust) verifiedCustomerId = cust.id;
    }

    const result = await runAiAgent({
      message: cleanMsg,
      history: Array.isArray(history) ? (history as ChatTurn[]) : [],
      ctx: {
        role: "customer",
        storeId: store.id,
        customerId: verifiedCustomerId,
      },
      storeName: store.name,
      skillId,
      customInstructions,
    });

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Erro interno no Vendedor IA." },
      { status: 500 }
    );
  }
}
