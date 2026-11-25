import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/encomendas";
import { cleanPhone } from "@/lib/customer-auth";
import { createCustomerOrderCore } from "@/lib/order-service";
import {
  DEFAULT_LOYALTY_CONFIG,
  normalizeOrderStatus,
  type LoyaltyConfig,
} from "@/lib/store-features";

export const dynamic = "force-dynamic";

/**
 * GET: Retorna histórico de compras, status ao vivo, pontos de fidelidade e encomendas.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const storeId = searchParams.get("storeId");
    const customerId = searchParams.get("customerId");
    const phone = searchParams.get("phone");

    if (!storeId || (!customerId && !phone)) {
      return NextResponse.json(
        { error: "Parâmetros obrigatórios ausentes (storeId e customerId/phone)." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: storeRow } = await supabase
      .from("stores")
      .select("id, owner_id")
      .eq("id", storeId)
      .maybeSingle();

    let ownerMeta: Record<string, any> = {};
    if (storeRow?.owner_id) {
      const { data: ownerData } = await supabase.auth.admin.getUserById(storeRow.owner_id);
      ownerMeta = ownerData?.user?.user_metadata || {};
    }

    // 1. Buscar dados do cliente
    let query = supabase.from("customers").select("*").eq("store_id", storeId);
    if (customerId) {
      query = query.eq("id", customerId);
    } else if (phone) {
      query = query.eq("phone", cleanPhone(phone));
    }

    const { data: customer, error: custErr } = await query.maybeSingle();

    if (custErr || !customer) {
      return NextResponse.json(
        { error: "Cliente não encontrado nesta loja." },
        { status: 404 }
      );
    }

    // 2. Buscar vendas realizadas
    const { data: sales, error: salesErr } = await supabase
      .from("sales")
      .select("*")
      .eq("store_id", storeId)
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false });

    if (salesErr) {
      return NextResponse.json(
        { error: "Erro ao buscar vendas do cliente: " + salesErr.message },
        { status: 500 }
      );
    }

    // 3. Buscar encomendas programadas
    const { data: encomendas, error: encErr } = await supabase
      .from("encomendas")
      .select("*")
      .eq("store_id", storeId)
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false });

    const statusFallbackMap: Record<string, string> = ownerMeta.order_statuses || {};
    const detailsFallbackMap: Record<string, any> = ownerMeta.order_details || {};
    const enrichedSales = (sales || []).map((s: any) => {
      const details = detailsFallbackMap[s.id] || {};
      return {
        ...s,
        order_status: normalizeOrderStatus(
          s.order_status || statusFallbackMap[s.id] || "RECEBIDO"
        ),
        delivery_type: s.delivery_type || details.delivery_type || null,
        coupon_code: s.coupon_code || details.coupon_code || null,
        discount_amount:
          s.discount_amount !== undefined
            ? Number(s.discount_amount)
            : Number(details.discount_amount || 0),
        loyalty_reward_used:
          s.loyalty_reward_used !== undefined
            ? Number(s.loyalty_reward_used)
            : Number(details.loyalty_reward_used || 0),
      };
    });

    const loyaltyConfig: LoyaltyConfig = {
      ...DEFAULT_LOYALTY_CONFIG,
      ...(ownerMeta.loyalty_config || {}),
    };
    const metaPointsMap: Record<string, number> = ownerMeta.customer_loyalty_points || {};
    const customerLoyaltyPoints = Number(
      customer.loyalty_points !== undefined && customer.loyalty_points !== null
        ? customer.loyalty_points
        : metaPointsMap[customer.id] || 0
    );

    return NextResponse.json({
      success: true,
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        balance: customer.balance || 0,
        credit_limit: customer.credit_limit || 0,
        due_date: customer.due_date,
        loyalty_points: customerLoyaltyPoints,
      },
      loyaltyConfig,
      sales: enrichedSales,
      encomendas: encErr ? [] : encomendas || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro interno ao consultar histórico." },
      { status: 500 }
    );
  }
}

/**
 * POST: Registra pedido da vitrine com validação server-side, Pix Copia e Cola, WhatsApp e Web Push.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = await createCustomerOrderCore({
      storeId: body.storeId,
      customerId: body.customerId,
      totalAmount: body.totalAmount,
      paymentMethod: body.paymentMethod,
      items: body.items,
      description: body.description,
      deliveryType: body.deliveryType,
      freightFee: body.freightFee,
      address: body.address,
      notes: body.notes,
      couponCode: body.couponCode,
      redeemLoyalty: body.redeemLoyalty,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      success: true,
      message: "Pedido registrado com sucesso!",
      sale: result.sale,
      finalTotal: result.finalTotal,
      loyaltyPoints: result.loyaltyPoints,
      pixCopiaECola: result.pixCopiaECola,
      merchantNotified: result.merchantNotified,
      customerNotified: result.customerNotified,
      merchantPushSent: result.merchantPushSent,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro interno ao processar pedido." },
      { status: 500 }
    );
  }
}
