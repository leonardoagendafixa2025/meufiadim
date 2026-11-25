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

    const { storeId, patch, unblockMode } = await req.json();

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

    // Se o SuperAdmin está tentando DESBLOQUEAR/ATIVAR a loja, verificar pendências InfinitePay
    if (filteredPatch.status === "active") {
      const { data: pendingCharges } = await supabaseAdmin
        .from("merchant_charges")
        .select("id, amount, order_nsu")
        .eq("merchant_id", storeId)
        .in("status", ["pending", "expired"]);

      const pendingList = pendingCharges || [];

      if (pendingList.length > 0 && !unblockMode) {
        const pendingTotalCents = pendingList.reduce(
          (acc, c) => acc + Number(c.amount || 0),
          0
        );
        const { data: storeRow } = await supabaseAdmin
          .from("stores")
          .select("name")
          .eq("id", storeId)
          .maybeSingle();

        return NextResponse.json({
          ok: false,
          requiresUnblockChoice: true,
          pendingCount: pendingList.length,
          pendingTotalCents,
          storeName: storeRow?.name || "Loja",
        });
      }

      if (pendingList.length > 0 && unblockMode === "cancel_charges") {
        for (const ch of pendingList) {
          await supabaseAdmin.rpc("cancel_merchant_charge", {
            p_charge_id: ch.id,
            p_admin_notes: "Cancelada pelo Super Admin ao desbloquear loja manualmente.",
          });
        }
      }

      filteredPatch.admin_blocked = false;
      filteredPatch.financial_blocked = false;
      filteredPatch.regularized_at = new Date().toISOString();
    } else if (filteredPatch.status === "blocked") {
      filteredPatch.admin_blocked = true;
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

    // Se optou por liberar mantendo cobranças em aberto, registra auditoria e não rebloqueia
    if (filteredPatch.status === "active" && unblockMode === "keep_charges") {
      await supabaseAdmin.from("infinitepay_webhook_events").insert({
        event_type: "manual_admin_unblock",
        source: "superadmin",
        verified: true,
        payload: {
          store_id: storeId,
          unblocked_by: user.email,
          mode: "keep_charges",
        },
      });
    } else if (filteredPatch.status === "blocked") {
      await supabaseAdmin.rpc("reevaluate_merchant_access", {
        p_merchant_id: storeId,
      });
    }

    const { data: refreshed } = await supabaseAdmin
      .from("stores")
      .select("*")
      .eq("id", storeId)
      .single();

    return NextResponse.json({ ok: true, store: refreshed || data });
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
