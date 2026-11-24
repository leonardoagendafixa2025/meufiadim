import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return createClient(url, key);
}

export async function PATCH(req: Request) {
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
        { error: "Acesso negado. Apenas o SuperAdmin pode alterar lojas." },
        { status: 403 }
      );
    }

    const { storeId, patch } = await req.json();

    if (!storeId || !patch) {
      return NextResponse.json(
        { error: "storeId e patch são obrigatórios" },
        { status: 400 }
      );
    }

    // Apenas campos permitidos para alteração pelo SuperAdmin
    const allowedFields = [
      "name",
      "slug",
      "whatsapp",
      "pix_key",
      "pix_city",
      "commission_rate",
      "billing_cycle",
      "status",
    ];
    const filteredPatch: Record<string, any> = {};
    for (const key of Object.keys(patch)) {
      if (allowedFields.includes(key)) {
        filteredPatch[key] = patch[key];
      }
    }

    const { data, error } = await supabaseAdmin
      .from("stores")
      .update(filteredPatch)
      .eq("id", storeId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, store: data });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Erro interno" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
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
        { error: "Acesso negado. Apenas o SuperAdmin pode excluir lojas." },
        { status: 403 }
      );
    }

    const { storeId } = await req.json();
    if (!storeId) {
      return NextResponse.json(
        { error: "storeId é obrigatório" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin.from("stores").delete().eq("id", storeId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Erro interno" },
      { status: 500 }
    );
  }
}
