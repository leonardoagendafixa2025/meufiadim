import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return createClient(url, key);
}

// GET /api/store/delivery?slug=nome-da-loja
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug");
    const storeId = searchParams.get("store_id");

    if (!slug && !storeId) {
      return NextResponse.json({ error: "Slug ou store_id é obrigatório." }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    let query = supabaseAdmin.from("stores").select("id, owner_id, slug, name");

    if (slug) {
      query = query.eq("slug", slug);
    } else if (storeId) {
      query = query.eq("id", storeId);
    }

    const { data: store, error: storeErr } = await query.single();

    if (storeErr || !store) {
      return NextResponse.json({ error: "Loja não encontrada." }, { status: 404 });
    }

    // Busca metadados do dono da loja
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(store.owner_id);
    const metadata = userData?.user?.user_metadata || {};

    return NextResponse.json({
      ok: true,
      neighborhoods: metadata.delivery_neighborhoods || [],
      cep_ranges: metadata.delivery_cep_ranges || [],
      category_icons: metadata.category_icons || {},
      featured_ids: metadata.featured_ids || [],
      delivery_time: metadata.delivery_time || "30min",
      min_order: metadata.min_order !== undefined ? Number(metadata.min_order) : 25.0,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/store/delivery
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Token de autorização não fornecido." }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseAdmin = getSupabaseAdmin();

    const {
      data: { user },
      error: userErr,
    } = await supabaseAdmin.auth.getUser(token);

    if (userErr || !user) {
      return NextResponse.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
    }

    const body = await req.json();
    const {
      neighborhoods,
      cep_ranges,
      category_icons,
      featured_ids,
      delivery_time,
      min_order,
    } = body;

    const currentMeta = user.user_metadata || {};

    const updatedMeta = {
      ...currentMeta,
      ...(neighborhoods !== undefined && { delivery_neighborhoods: neighborhoods }),
      ...(cep_ranges !== undefined && { delivery_cep_ranges: cep_ranges }),
      ...(category_icons !== undefined && { category_icons: category_icons }),
      ...(featured_ids !== undefined && { featured_ids: featured_ids }),
      ...(delivery_time !== undefined && { delivery_time: delivery_time }),
      ...(min_order !== undefined && { min_order: Number(min_order) }),
    };

    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: updatedMeta,
    });

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      message: "Configurações de entrega e vitrine atualizadas com sucesso!",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
