import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/encomendas";
import { canMerchantAccessSystem } from "@/lib/infinitepay";
import {
  DEFAULT_LOYALTY_CONFIG,
  computeOrderDiscounts,
  type LoyaltyConfig,
  type StoreCoupon,
} from "@/lib/store-features";

export const dynamic = "force-dynamic";

async function loadStorePromotions(storeId: string, ownerId: string) {
  const supabase = getSupabaseAdmin();
  const { data: userData } = await supabase.auth.admin.getUserById(ownerId);
  const meta = userData?.user?.user_metadata || {};

  let coupons: StoreCoupon[] = meta.store_coupons || [];
  const { data: dbCoupons, error: dbErr } = await supabase
    .from("store_coupons")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });

  if (!dbErr && dbCoupons && dbCoupons.length > 0) {
    coupons = dbCoupons.map((c: any) => ({
      id: c.id,
      code: c.code,
      discountType: c.discount_type,
      discountValue: Number(c.discount_value),
      minOrder: Number(c.min_order || 0),
      active: Boolean(c.active),
      usesCount: Number(c.uses_count || 0),
      createdAt: c.created_at,
    }));
  }

  const loyaltyConfig: LoyaltyConfig = {
    ...DEFAULT_LOYALTY_CONFIG,
    ...(meta.loyalty_config || {}),
  };

  return { coupons, loyaltyConfig, meta };
}

/**
 * GET /api/store/promotions
 * - Com Bearer Token (Lojista): retorna cupons completos e configuração de fidelidade.
 * - Público (?slug=...): retorna status da fidelidade, pontos do cliente (se customerId válido) e valida cupom (validateCode).
 */
export async function GET(req: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const authHeader = req.headers.get("authorization");

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "").trim();
      const {
        data: { user },
      } = await supabase.auth.getUser(token);
      if (user) {
        const { data: store } = await supabase
          .from("stores")
          .select("id, owner_id")
          .eq("owner_id", user.id)
          .maybeSingle();

        if (!store) {
          return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
        }

        const { coupons, loyaltyConfig } = await loadStorePromotions(
          store.id,
          store.owner_id
        );
        return NextResponse.json({ ok: true, coupons, loyaltyConfig });
      }
    }

    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug");
    const storeIdParam = searchParams.get("storeId");
    const customerId = searchParams.get("customerId");
    const validateCode = searchParams.get("validateCode");
    const subtotal = Number(searchParams.get("subtotal") || 0);

    let storeQuery = supabase.from("stores").select("id, owner_id, slug");
    if (storeIdParam) storeQuery = storeQuery.eq("id", storeIdParam);
    else if (slug) storeQuery = storeQuery.eq("slug", slug);
    else {
      return NextResponse.json(
        { error: "Informe slug ou storeId." },
        { status: 400 }
      );
    }

    const { data: store } = await storeQuery.maybeSingle();
    if (!store) {
      return NextResponse.json({ error: "Loja não encontrada." }, { status: 404 });
    }

    const { coupons, loyaltyConfig, meta } = await loadStorePromotions(
      store.id,
      store.owner_id
    );

    let customerPoints = 0;
    if (customerId) {
      const { data: cust } = await supabase
        .from("customers")
        .select("*")
        .eq("id", customerId)
        .eq("store_id", store.id)
        .maybeSingle();
      if (cust) {
        const metaPointsMap: Record<string, number> = meta.customer_loyalty_points || {};
        customerPoints = Number(
          cust.loyalty_points !== undefined && cust.loyalty_points !== null
            ? cust.loyalty_points
            : metaPointsMap[cust.id] || 0
        );
      }
    }

    let couponValidation: any = null;
    if (validateCode && validateCode.trim()) {
      const codeUpper = validateCode.trim().toUpperCase();
      const found = coupons.find((c) => c.code.toUpperCase() === codeUpper);
      if (!found) {
        couponValidation = {
          valid: false,
          error: `Cupom "${codeUpper}" não encontrado.`,
        };
      } else {
        const calc = computeOrderDiscounts({
          subtotal,
          freightFee: 0,
          coupon: found,
        });
        if (calc.couponError) {
          couponValidation = { valid: false, error: calc.couponError };
        } else {
          couponValidation = {
            valid: true,
            code: found.code,
            discountType: found.discountType,
            discountValue: found.discountValue,
            discountAmount: calc.couponDiscount,
          };
        }
      }
    }

    return NextResponse.json({
      ok: true,
      loyaltyConfig,
      customerPoints,
      hasActiveCoupons: coupons.some((c) => c.active),
      couponValidation,
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
      .select("id, owner_id")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!store) {
      return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
    }

    const access = await canMerchantAccessSystem(store.id);
    if (!access.allowed) {
      return NextResponse.json(
        { error: access.reason || "Operação bloqueada financeiramente." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { coupons, loyaltyConfig, meta } = await loadStorePromotions(
      store.id,
      store.owner_id
    );

    let nextCoupons = [...coupons];
    let nextLoyalty = { ...loyaltyConfig };

    if (body.action === "create_coupon") {
      const code = String(body.code || "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9_-]/g, "");
      const discountType = body.discountType === "fixed" ? "fixed" : "percent";
      const discountValue = Number(body.discountValue || 0);
      const minOrder = Math.max(0, Number(body.minOrder || 0));

      if (!code || code.length < 3) {
        return NextResponse.json(
          { error: "O código do cupom deve ter ao menos 3 letras/números." },
          { status: 400 }
        );
      }
      if (!Number.isFinite(discountValue) || discountValue <= 0) {
        return NextResponse.json(
          { error: "Informe um valor de desconto válido." },
          { status: 400 }
        );
      }
      if (discountType === "percent" && discountValue > 90) {
        return NextResponse.json(
          { error: "Desconto percentual máximo permitido é 90%." },
          { status: 400 }
        );
      }
      if (nextCoupons.some((c) => c.code === code)) {
        return NextResponse.json(
          { error: `Já existe um cupom com o código "${code}".` },
          { status: 409 }
        );
      }

      const newCoupon: StoreCoupon = {
        id: crypto.randomUUID(),
        code,
        discountType,
        discountValue,
        minOrder,
        active: true,
        usesCount: 0,
        createdAt: new Date().toISOString(),
      };
      nextCoupons = [newCoupon, ...nextCoupons];

      try {
        await supabase.from("store_coupons").insert({
          id: newCoupon.id,
          store_id: store.id,
          code: newCoupon.code,
          discount_type: newCoupon.discountType,
          discount_value: newCoupon.discountValue,
          min_order: newCoupon.minOrder,
          active: true,
        });
      } catch {
        // Fallback em metadata se tabela ainda não existir
      }
    } else if (body.action === "toggle_coupon") {
      nextCoupons = nextCoupons.map((c) =>
        c.id === body.couponId ? { ...c, active: !c.active } : c
      );
      const toggled = nextCoupons.find((c) => c.id === body.couponId);
      if (toggled) {
        try {
          await supabase
            .from("store_coupons")
            .update({ active: toggled.active })
            .eq("id", toggled.id)
            .eq("store_id", store.id);
        } catch {}
      }
    } else if (body.action === "delete_coupon") {
      nextCoupons = nextCoupons.filter((c) => c.id !== body.couponId);
      try {
        await supabase
          .from("store_coupons")
          .delete()
          .eq("id", body.couponId)
          .eq("store_id", store.id);
      } catch {}
    } else if (body.action === "save_loyalty") {
      nextLoyalty = {
        enabled: Boolean(body.loyaltyConfig?.enabled),
        targetOrders: Math.max(2, Math.min(50, Math.round(Number(body.loyaltyConfig?.targetOrders || 10)))),
        rewardAmount: Math.max(1, Number(Number(body.loyaltyConfig?.rewardAmount || 15).toFixed(2))),
      };
    }

    await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...meta,
        store_coupons: nextCoupons,
        loyalty_config: nextLoyalty,
      },
    });

    return NextResponse.json({
      ok: true,
      coupons: nextCoupons,
      loyaltyConfig: nextLoyalty,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Erro interno" }, { status: 500 });
  }
}
