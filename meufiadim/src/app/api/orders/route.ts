import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/encomendas";
import { normalizeOrderStatus } from "@/lib/store-features";

export const dynamic = "force-dynamic";

/**
 * GET /api/orders
 * Lista os pedidos e vendas recentes da loja autenticada com status de rastreamento ao vivo.
 */
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

    const { data: store } = await supabase
      .from("stores")
      .select("id, name")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!store) {
      return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
    }

    const { data: salesRows, error: salesErr } = await supabase
      .from("sales")
      .select("*, customer:customers(id, name, phone)")
      .eq("store_id", store.id)
      .order("created_at", { ascending: false })
      .limit(80);

    if (salesErr) {
      return NextResponse.json({ error: salesErr.message }, { status: 500 });
    }

    const statusFallbackMap: Record<string, string> =
      user.user_metadata?.order_statuses || {};
    const orderMetaMap: Record<string, any> =
      user.user_metadata?.order_details || {};

    const orders = (salesRows || []).map((row: any) => {
      const meta = orderMetaMap[row.id] || {};
      const resolvedStatus = normalizeOrderStatus(
        row.order_status || statusFallbackMap[row.id] || "RECEBIDO"
      );

      return {
        ...row,
        order_status: resolvedStatus,
        delivery_type: row.delivery_type || meta.delivery_type || null,
        delivery_address: row.delivery_address || meta.delivery_address || null,
        notes: row.notes || meta.notes || null,
        coupon_code: row.coupon_code || meta.coupon_code || null,
        discount_amount:
          row.discount_amount !== undefined
            ? Number(row.discount_amount)
            : Number(meta.discount_amount || 0),
        loyalty_reward_used:
          row.loyalty_reward_used !== undefined
            ? Number(row.loyalty_reward_used)
            : Number(meta.loyalty_reward_used || 0),
      };
    });

    return NextResponse.json({
      ok: true,
      orders,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Erro ao listar pedidos." },
      { status: 500 }
    );
  }
}
