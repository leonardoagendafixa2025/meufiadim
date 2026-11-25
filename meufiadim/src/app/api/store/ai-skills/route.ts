import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/encomendas";
import { canMerchantAccessSystem } from "@/lib/infinitepay";
import {
  DEFAULT_AI_SKILL_ID,
  STORE_AI_SKILLS,
  resolveStoreAiSkill,
  sanitizeCustomInstructions,
} from "@/lib/ai-skills";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
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

    const meta = user.user_metadata || {};
    const skill = resolveStoreAiSkill(meta.ai_skill_id || DEFAULT_AI_SKILL_ID);
    const customInstructions = sanitizeCustomInstructions(meta.ai_custom_instructions);

    return NextResponse.json({
      ok: true,
      skillId: skill.id,
      customInstructions,
      skillsCatalog: STORE_AI_SKILLS.map((s) => ({
        id: s.id,
        name: s.name,
        badge: s.badge,
        description: s.description,
        exampleTip: s.exampleTip,
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Erro interno" }, { status: 500 });
  }
}

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
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!store) {
      return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
    }

    const access = await canMerchantAccessSystem(store.id);
    if (!access.allowed) {
      return NextResponse.json(
        { error: access.reason || "Operação bloqueada por pendência financeira." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const skill = resolveStoreAiSkill(body.skillId);
    const customInstructions = sanitizeCustomInstructions(body.customInstructions);

    const meta = user.user_metadata || {};
    const { error: updErr } = await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...meta,
        ai_skill_id: skill.id,
        ai_custom_instructions: customInstructions,
      },
    });

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      skillId: skill.id,
      customInstructions,
      message: `Skill "${skill.name}" ativada para sua IA na vitrine e no WhatsApp!`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Erro interno" }, { status: 500 });
  }
}
