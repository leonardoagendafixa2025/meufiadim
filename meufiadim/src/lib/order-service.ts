import { getSupabaseAdmin } from "@/lib/encomendas";
import { formatPhoneBR, cleanPhone } from "@/lib/customer-auth";
import { formatBRL, getZapApiKey, getZapApiUrl } from "@/lib/whatsapp";
import { generatePixCopiaECola } from "@/lib/pix";
import { sendWebPushToStoreTarget } from "@/lib/web-push";
import {
  DEFAULT_LOYALTY_CONFIG,
  computeOrderDiscounts,
  type LoyaltyConfig,
  type StoreCoupon,
} from "@/lib/store-features";

export const FALLBACK_PUBLIC_APP_URL = "https://meufiadimdigital.vercel.app";

export function getAppPublicBaseUrl(req?: Request): string {
  if (req) {
    const forwardedHost = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const forwardedProto = req.headers.get("x-forwarded-proto") || "https";
    if (forwardedHost && !forwardedHost.includes("localhost")) {
      return `${forwardedProto}://${forwardedHost}`.replace(/\/$/, "");
    }
    const origin = req.headers.get("origin");
    if (origin && !origin.includes("localhost")) {
      return origin.replace(/\/$/, "");
    }
  }

  const envUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "")
    .trim()
    .replace(/\/$/, "");

  if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("meufiadim.com")) {
    return envUrl;
  }

  return FALLBACK_PUBLIC_APP_URL;
}

export interface OrderInputItem {
  id?: string;
  productId?: string;
  name?: string;
  price?: number;
  qty?: number;
}

export interface CreateCustomerOrderInput {
  storeId: string;
  customerId: string;
  totalAmount?: number;
  paymentMethod?: string;
  items?: OrderInputItem[];
  description?: string;
  deliveryType?: "entrega" | "retirada" | string | null;
  freightFee?: number;
  address?: string | null;
  notes?: string | null;
  couponCode?: string | null;
  redeemLoyalty?: boolean;
  requireMatchedCatalogItems?: boolean;
}

export type CreateCustomerOrderResult =
  | {
      ok: false;
      status: number;
      error: string;
    }
  | {
      ok: true;
      sale: any;
      storeName: string;
      storeSlug: string;
      finalTotal: number;
      subtotal: number;
      freightFee: number;
      discountTotal: number;
      loyaltyPoints: number;
      pixCopiaECola: string | null;
      merchantNotified: boolean;
      customerNotified: boolean;
      merchantPushSent: number;
    };

/**
 * Núcleo autoritativo de criação de pedido do cliente (usado pelo Checkout da Vitrine e pelo Vendedor IA).
 * Sempre recalcula preços pelo catálogo do servidor, aplica cupons/fidelidade, baixa estoque e dispara Zap + Push.
 */
export async function createCustomerOrderCore(
  input: CreateCustomerOrderInput
): Promise<CreateCustomerOrderResult> {
  const {
    storeId,
    customerId,
    totalAmount,
    paymentMethod = "Pix",
    items,
    description,
    deliveryType,
    freightFee,
    address,
    notes,
    couponCode,
    redeemLoyalty,
    requireMatchedCatalogItems = false,
  } = input;

  if (
    !storeId ||
    !customerId ||
    (!totalAmount && (!Array.isArray(items) || items.length === 0))
  ) {
    return {
      ok: false,
      status: 400,
      error: "Dados incompletos para registrar o pedido.",
    };
  }

  const supabase = getSupabaseAdmin();

  // 1. Validar loja
  const { data: store, error: storeErr } = await supabase
    .from("stores")
    .select(
      "id, owner_id, name, slug, whatsapp, pix_key, pix_city, commission_rate, is_open, status"
    )
    .eq("id", storeId)
    .maybeSingle();

  if (storeErr || !store) {
    return { ok: false, status: 404, error: "Loja não encontrada." };
  }

  if (store.status === "blocked") {
    return {
      ok: false,
      status: 403,
      error: "Esta loja está temporariamente indisponível.",
    };
  }

  let ownerUser: any = null;
  if (store.owner_id) {
    const { data: ownerData } = await supabase.auth.admin.getUserById(store.owner_id);
    ownerUser = ownerData?.user || null;
  }
  const ownerMeta: Record<string, any> = ownerUser?.user_metadata || {};
  const storeOpen =
    ownerMeta.is_open !== undefined ? Boolean(ownerMeta.is_open) : store.is_open !== false;

  if (!storeOpen) {
    return {
      ok: false,
      status: 400,
      error: "A loja está fechada no momento e não está aceitando novos pedidos.",
    };
  }

  // 2. Validar cliente pertencente à loja (anti-IDOR)
  const { data: customer, error: custErr } = await supabase
    .from("customers")
    .select("*")
    .eq("id", customerId)
    .eq("store_id", storeId)
    .maybeSingle();

  if (custErr || !customer) {
    return {
      ok: false,
      status: 401,
      error: "Cliente não autenticado ou não encontrado para esta loja.",
    };
  }

  // 3. Recalcular subtotal com preços oficiais do catálogo no servidor
  let authoritativeItemsSubtotal = 0;
  const storeProductsById = new Map<string, any>();
  const storeProductsList: any[] = [];
  const normalizedItems: Array<{ id: string; name: string; price: number; qty: number }> = [];

  if (Array.isArray(items) && items.length > 0) {
    const { data: dbProducts } = await supabase
      .from("products")
      .select("id, name, price, stock")
      .eq("store_id", storeId);

    for (const p of dbProducts || []) {
      storeProductsById.set(p.id, p);
      storeProductsList.push(p);
    }

    for (const item of items) {
      const qty = Math.max(1, Math.min(50, Math.round(Number(item.qty || 1))));
      const lookupId = item.id || item.productId || "";
      let dbProd = lookupId ? storeProductsById.get(lookupId) : null;
      if (!dbProd && item.name) {
        const q = String(item.name).toLowerCase().trim();
        dbProd = storeProductsList.find((p) => p.name.toLowerCase().includes(q)) || null;
      }

      if (dbProd) {
        const price = Number(dbProd.price);
        authoritativeItemsSubtotal += price * qty;
        normalizedItems.push({
          id: dbProd.id,
          name: dbProd.name,
          price,
          qty,
        });
      } else if (!requireMatchedCatalogItems) {
        const fallbackPrice = Math.max(0, Number(item.price || 0));
        authoritativeItemsSubtotal += fallbackPrice * qty;
        normalizedItems.push({
          id: lookupId,
          name: String(item.name || "Item"),
          price: fallbackPrice,
          qty,
        });
      }
    }

    if (requireMatchedCatalogItems && normalizedItems.length === 0) {
      return {
        ok: false,
        status: 400,
        error: "Nenhum produto informado foi encontrado no cardápio da loja.",
      };
    }

    authoritativeItemsSubtotal = Number(authoritativeItemsSubtotal.toFixed(2));
  }

  // 4. Cupons e Fidelidade no servidor
  const parsedFreight =
    deliveryType === "retirada" ? 0 : Math.max(0, Number(freightFee || 0));
  let coupons: StoreCoupon[] = ownerMeta.store_coupons || [];
  const { data: dbCoupons, error: dbCouponsErr } = await supabase
    .from("store_coupons")
    .select("*")
    .eq("store_id", storeId);

  if (!dbCouponsErr && dbCoupons && dbCoupons.length > 0) {
    coupons = dbCoupons.map((c: any) => ({
      id: c.id,
      code: c.code,
      discountType: c.discount_type,
      discountValue: Number(c.discount_value),
      minOrder: Number(c.min_order || 0),
      active: Boolean(c.active),
      usesCount: Number(c.uses_count || 0),
    }));
  }

  let matchedCoupon: StoreCoupon | null = null;
  if (couponCode && String(couponCode).trim()) {
    const normCode = String(couponCode).trim().toUpperCase();
    matchedCoupon = coupons.find((c) => c.code.toUpperCase() === normCode) || null;
    if (!matchedCoupon) {
      return {
        ok: false,
        status: 400,
        error: `Cupom "${normCode}" não encontrado ou expirado.`,
      };
    }
  }

  const loyaltyConfig: LoyaltyConfig = {
    ...DEFAULT_LOYALTY_CONFIG,
    ...(ownerMeta.loyalty_config || {}),
  };
  const metaPointsMap: Record<string, number> = {
    ...(ownerMeta.customer_loyalty_points || {}),
  };
  const currentPoints = Number(
    customer.loyalty_points !== undefined && customer.loyalty_points !== null
      ? customer.loyalty_points
      : metaPointsMap[customer.id] || 0
  );

  const effectiveSubtotal =
    authoritativeItemsSubtotal > 0
      ? authoritativeItemsSubtotal
      : Math.max(0, Number(totalAmount || 0) - parsedFreight);

  const discountCalc = computeOrderDiscounts({
    subtotal: effectiveSubtotal,
    freightFee: parsedFreight,
    coupon: matchedCoupon,
    loyaltyConfig,
    customerPoints: currentPoints,
    redeemLoyalty: Boolean(redeemLoyalty),
  });

  if (discountCalc.couponError) {
    return { ok: false, status: 400, error: discountCalc.couponError };
  }

  const parsedTotal =
    authoritativeItemsSubtotal > 0 || discountCalc.totalDiscount > 0
      ? discountCalc.finalTotal
      : Number(Number(totalAmount || 0).toFixed(2));

  const commissionRate = Number(store.commission_rate || 5.0);
  const commissionAmount = Number(((parsedTotal * commissionRate) / 100).toFixed(2));
  const persistedItems = normalizedItems.length > 0 ? normalizedItems : items || null;

  let formattedDescription = description || "";
  if (!formattedDescription && Array.isArray(persistedItems)) {
    formattedDescription = persistedItems
      .map((i: any) => `${i.qty}x ${i.name || i.product?.name || "Item"}`)
      .join(" • ");
  }

  const pointsEarned = loyaltyConfig.enabled ? 1 : 0;

  // 5. Inserir venda com fallback v3 -> v2
  let saleRecord: any = null;
  const fullInsertPayload: any = {
    store_id: storeId,
    customer_id: customer.id,
    total_amount: parsedTotal,
    commission_amount: commissionAmount,
    payment_method: paymentMethod || "Pix",
    description: formattedDescription,
    items: persistedItems,
    order_status: "RECEBIDO",
    status_updated_at: new Date().toISOString(),
    delivery_type: deliveryType || null,
    delivery_address: address || null,
    notes: notes ? String(notes).trim() : null,
    coupon_code: discountCalc.appliedCouponCode,
    discount_amount: discountCalc.couponDiscount,
    loyalty_points_earned: pointsEarned,
    loyalty_reward_used: discountCalc.loyaltyRewardUsed,
  };

  const { data: saleData, error: saleErr } = await supabase
    .from("sales")
    .insert(fullInsertPayload)
    .select()
    .single();

  if (saleErr) {
    if (saleErr.message?.includes("column") || saleErr.code === "42703") {
      const corePayload: any = {
        store_id: storeId,
        customer_id: customer.id,
        total_amount: parsedTotal,
        commission_amount: commissionAmount,
        payment_method: paymentMethod || "Pix",
        description: formattedDescription,
        items: persistedItems,
      };
      const resCore = await supabase.from("sales").insert(corePayload).select().single();
      if (resCore.error) {
        const minRes = await supabase
          .from("sales")
          .insert({
            store_id: storeId,
            customer_id: customer.id,
            total_amount: parsedTotal,
            commission_amount: commissionAmount,
            payment_method: paymentMethod || "Pix",
          })
          .select()
          .single();
        if (minRes.error) {
          return {
            ok: false,
            status: 500,
            error: "Erro ao registrar venda: " + minRes.error.message,
          };
        }
        saleRecord = minRes.data;
      } else {
        saleRecord = resCore.data;
      }
    } else {
      return {
        ok: false,
        status: 500,
        error: "Erro ao registrar venda: " + saleErr.message,
      };
    }
  } else {
    saleRecord = saleData;
  }

  // 6. Baixa automática de estoque
  if (Array.isArray(persistedItems) && persistedItems.length > 0) {
    for (const item of persistedItems) {
      const dbProd = item.id ? storeProductsById.get(item.id) : null;
      if (dbProd) {
        const qty = Math.max(1, Math.round(Number(item.qty || 1)));
        const nextStock = Math.max(0, Number(dbProd.stock || 0) - qty);
        await supabase
          .from("products")
          .update({ stock: nextStock })
          .eq("id", dbProd.id)
          .eq("store_id", storeId);
      }
    }
  }

  // 7. Atualizar saldo Fiado e pontos de fidelidade
  const isFiado = String(paymentMethod).toLowerCase().includes("fiado");
  const nextBalance = isFiado
    ? Number((Number(customer.balance || 0) + parsedTotal).toFixed(2))
    : Number(customer.balance || 0);
  const nextPoints =
    Math.max(0, currentPoints - discountCalc.pointsRedeemed) + pointsEarned;

  const custUpdateRes = await supabase
    .from("customers")
    .update({
      ...(isFiado ? { balance: nextBalance } : {}),
      loyalty_points: nextPoints,
    })
    .eq("id", customer.id);

  if (custUpdateRes.error && isFiado) {
    await supabase
      .from("customers")
      .update({ balance: nextBalance })
      .eq("id", customer.id);
  }

  // 8. Espelho em user_metadata
  if (ownerUser) {
    const updatedStatuses = {
      ...(ownerMeta.order_statuses || {}),
      [saleRecord.id]: "RECEBIDO",
    };
    const updatedDetails = {
      ...(ownerMeta.order_details || {}),
      [saleRecord.id]: {
        delivery_type: deliveryType || null,
        delivery_address: address || null,
        notes: notes ? String(notes).trim() : null,
        coupon_code: discountCalc.appliedCouponCode,
        discount_amount: discountCalc.couponDiscount,
        loyalty_reward_used: discountCalc.loyaltyRewardUsed,
      },
    };

    const nextCoupons = (ownerMeta.store_coupons || []).map((c: StoreCoupon) =>
      discountCalc.appliedCouponCode &&
      c.code.toUpperCase() === discountCalc.appliedCouponCode
        ? { ...c, usesCount: Number(c.usesCount || 0) + 1 }
        : c
    );

    metaPointsMap[customer.id] = nextPoints;

    await supabase.auth.admin.updateUserById(ownerUser.id, {
      user_metadata: {
        ...ownerMeta,
        order_statuses: updatedStatuses,
        order_details: updatedDetails,
        customer_loyalty_points: metaPointsMap,
        store_coupons: nextCoupons,
      },
    });
  }

  if (discountCalc.appliedCouponCode && !dbCouponsErr) {
    await supabase
      .from("store_coupons")
      .update({ uses_count: Number(matchedCoupon?.usesCount || 0) + 1 })
      .eq("store_id", storeId)
      .eq("code", discountCalc.appliedCouponCode);
  }

  // 9. Gerar Pix Copia e Cola se pagamento Pix e loja tiver chave
  const isPix = String(paymentMethod).toLowerCase().includes("pix");
  const pixCopiaECola =
    isPix && store.pix_key && parsedTotal > 0
      ? generatePixCopiaECola({
          pixKey: store.pix_key,
          merchantName: store.name || "MEUFIADIM",
          merchantCity: store.pix_city || "BRASIL",
          amount: parsedTotal,
          txid: `MF${String(saleRecord.id).replace(/-/g, "").slice(0, 12).toUpperCase()}`,
        })
      : null;

  // 10. Disparos WhatsApp (Baileys) + Web Push ao Lojista
  const zapUrl = getZapApiUrl();
  const zapKey = getZapApiKey();
  let merchantNotified = false;
  let customerNotified = false;

  const itemsLines =
    Array.isArray(persistedItems) && persistedItems.length > 0
      ? persistedItems
          .map(
            (i: any) =>
              `• ${i.qty}x ${i.name || i.product?.name || "Item"} — ${formatBRL(
                Number(i.price || 0) * Number(i.qty || 1)
              )}`
          )
          .join("\n")
      : formattedDescription;

  if (store.whatsapp) {
    try {
      const merchantLines = [
        `🛍️ *NOVO PEDIDO RECEBIDO — ${store.name}*`,
        ``,
        `👤 *Cliente:* ${customer.name}`,
        `📱 *WhatsApp:* ${formatPhoneBR(customer.phone)}`,
        `🛵 *Modalidade:* ${deliveryType === "retirada" ? "RETIRADA NA LOJA" : "ENTREGA EM DOMICÍLIO"}`,
        address
          ? address
          : deliveryType === "retirada"
          ? "🏬 Retirada no balcão da loja"
          : "",
        `💳 *Forma de Pagamento:* ${paymentMethod || "Pix"}`,
        ``,
        `📋 *ITENS DO PEDIDO:*`,
        itemsLines,
        ``,
        `Subtotal: ${formatBRL(discountCalc.subtotal)}`,
        deliveryType === "retirada"
          ? `Frete: Grátis (Retirada)`
          : `Taxa de Entrega: ${formatBRL(parsedFreight)}`,
      ];

      if (discountCalc.couponDiscount > 0) {
        merchantLines.push(
          `🏷️ Cupom ${discountCalc.appliedCouponCode}: -${formatBRL(discountCalc.couponDiscount)}`
        );
      }
      if (discountCalc.loyaltyRewardUsed > 0) {
        merchantLines.push(
          `🎁 Prêmio Fidelidade: -${formatBRL(discountCalc.loyaltyRewardUsed)}`
        );
      }
      merchantLines.push(`💰 *VALOR TOTAL: ${formatBRL(parsedTotal)}*`);

      if (notes && String(notes).trim()) {
        merchantLines.push(``, `📝 *Observações:* ${String(notes).trim()}`);
      }

      const resMerchant = await fetch(`${zapUrl}/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": zapKey,
        },
        body: JSON.stringify({
          phone: cleanPhone(store.whatsapp),
          text: merchantLines.filter(Boolean).join("\n"),
        }),
      });

      merchantNotified = resMerchant.ok;
    } catch (err) {
      console.error("Erro ao notificar lojista via Baileys:", err);
    }
  }

  if (customer.phone) {
    try {
      const firstName = customer.name.split(" ")[0];
      const customerLines = [
        `Olá, *${firstName}*! 👋`,
        ``,
        `Seu pedido na *${store.name}* foi recebido e confirmado com sucesso! ✅`,
        ``,
        `📋 *ITENS:*`,
        itemsLines,
        ``,
        `💳 *Pagamento:* ${paymentMethod || "Pix"}`,
        `💰 *Total:* ${formatBRL(parsedTotal)}`,
        `🛵 *Modalidade:* ${deliveryType === "retirada" ? "Retirada na loja" : "Entrega em domicílio"}`,
      ];

      if (loyaltyConfig.enabled) {
        customerLines.push(
          `⭐ *Fidelidade:* Você agora tem *${nextPoints}/${loyaltyConfig.targetOrders}* carimbos!`
        );
      }

      if (isPix && store.pix_key) {
        customerLines.push(
          ``,
          `Para pagar agora, toque em *"Copiar código Pix"* na mensagem abaixo 👇`
        );
      } else {
        customerLines.push(
          ``,
          `Acompanhe o preparo do seu pedido ao vivo direto pela vitrine da loja. Obrigado pela preferência!`
        );
      }

      const resCustomer = await fetch(`${zapUrl}/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": zapKey,
        },
        body: JSON.stringify({
          phone: cleanPhone(customer.phone),
          text: customerLines.join("\n"),
          pix:
            isPix && store.pix_key
              ? {
                  pixKey: store.pix_key,
                  merchantName: store.name || "MEUFIADIM",
                  merchantCity: store.pix_city || "BRASIL",
                  amount: parsedTotal,
                }
              : null,
        }),
      });

      customerNotified = resCustomer.ok;
    } catch (err) {
      console.error("Erro ao notificar cliente via Baileys:", err);
    }
  }

  // 11. Web Push em tempo real para o Lojista
  const pushResult = await sendWebPushToStoreTarget({
    storeId: store.id,
    role: "merchant",
    title: `🛍️ Novo pedido em ${store.name}!`,
    body: `${customer.name} • ${formatBRL(parsedTotal)} (${paymentMethod || "Pix"})`,
    url: "/admin?tab=pedidos",
    tag: `new-order-${saleRecord.id}`,
  });

  return {
    ok: true,
    sale: { ...saleRecord, order_status: "RECEBIDO" },
    storeName: store.name,
    storeSlug: store.slug,
    finalTotal: parsedTotal,
    subtotal: discountCalc.subtotal,
    freightFee: parsedFreight,
    discountTotal: discountCalc.totalDiscount,
    loyaltyPoints: nextPoints,
    pixCopiaECola,
    merchantNotified,
    customerNotified,
    merchantPushSent: pushResult.sent,
  };
}
