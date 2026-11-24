import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return createClient(url, key);
}

// GET /api/store/status?slug=nome-da-loja
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug");

    if (!slug) {
      return NextResponse.json({ error: "Slug é obrigatório." }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: store, error: storeErr } = await supabaseAdmin
      .from("stores")
      .select("id, owner_id, status")
      .eq("slug", slug)
      .single();

    if (storeErr || !store) {
      return NextResponse.json({ error: "Loja não encontrada." }, { status: 404 });
    }

    // Se a loja estiver bloqueada pelo SuperAdmin, ela está fechada
    if (store.status === "blocked") {
      return NextResponse.json({ ok: true, is_open: false, blocked: true });
    }

    // Busca o status nos metadados do dono
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(store.owner_id);
    const isOpen = userData?.user?.user_metadata?.is_open ?? true;

    return NextResponse.json({
      ok: true,
      is_open: Boolean(isOpen),
      blocked: false,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/store/status — Lojista atualiza Aberta / Fechada
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseAdmin = getSupabaseAdmin();
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: "Usuário não autenticado." }, { status: 401 });
    }

    const body = await req.json();
    const { is_open } = body;

    if (typeof is_open !== "boolean") {
      return NextResponse.json(
        { error: "O campo 'is_open' deve ser um booleano (true ou false)." },
        { status: 400 }
      );
    }

    // Atualiza nos metadados do usuário lojista
    const { data: updated, error: updateError } =
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...(user.user_metadata || {}),
          is_open: is_open,
        },
      });

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Tentativa opcional de salvar no banco caso a coluna stores.is_open exista
    try {
      await supabaseAdmin
        .from("stores")
        .update({ is_open: is_open } as any)
        .eq("owner_id", user.id);
    } catch {
      // Ignora se coluna não existir no schema
    }

    return NextResponse.json({
      ok: true,
      is_open: updated.user.user_metadata?.is_open ?? is_open,
      message: is_open
        ? "Loja aberta com sucesso! Sua vitrine está aceitando pedidos."
        : "Loja fechada com sucesso! Novos pedidos na vitrine foram pausados.",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
