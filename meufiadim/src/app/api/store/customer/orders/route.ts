import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/encomendas";
import { cleanPhone, formatPhoneBR } from "@/lib/customer-auth";
import { formatBRL, getZapApiUrl, getZapApiKey } from "@/lib/whatsapp";
import {
  DEFAULT_LOYALTY_CONFIG,
  computeOrderDiscounts,
  normalizeOrderStatus,
  type LoyaltyConfig,
  type StoreCoupon,
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
        order_status: normalizeOrderStatus(s.order_status || statusFallbackMap[s.id] || "RECEBIDO"),
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
 * POST: Registra pedido da vitrine com validação server-side de cupom, fidelidade e estoque.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      storeId,
      customerId,
      totalAmount,
      paymentMethod,
      items,
      description,
      deliveryType,
      freightFee,
      address,
      notes,
      couponCode,
      redeemLoyalty,
    } = body;

    if (!storeId || !customerId || (!totalAmount && (!Array.isArray(items) || items.length === 0))) {
      return NextResponse.json(
        { error: "Dados incompletos para registrar o pedido." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // 1. Validar loja
    const { data: store, error: storeErr } = await supabase
      .from("stores")
      .select("id, owner_id, name, whatsapp, pix_key, pix_city, commission_rate, is_open, status")
      .eq("id", storeId)
      .maybeSingle();

    if (storeErr || !store) {
      return NextResponse.json({ error: "Loja não encontrada." }, { status: 404 });
    }

    if (store.status === "blocked") {
      return NextResponse.json(
        { error: "Esta loja está temporariamente indisponível." },
        { status: 403 }
      );
    }

    // Verifica abertura em user_metadata + stores.is_open
    let ownerUser: any = null;
    if (store.owner_id) {
      const { data: ownerData } = await supabase.auth.admin.getUserById(store.owner_id);
      ownerUser = ownerData?.user || null;
    }
    const ownerMeta: Record<string, any> = ownerUser?.user_metadata || {};
    const storeOpen =
      ownerMeta.is_open !== undefined ? Boolean(ownerMeta.is_open) : store.is_open !== false;

    if (!storeOpen) {
      return NextResponse.json(
        { error: "A loja está fechada no momento e não está aceitando novos pedidos." },
        { status: 400 }
      );
    }

    // 2. Validar cliente
    const { data: customer, error: custErr } = await supabase
      .from("customers")
      .select("*")
      .eq("id", customerId)
      .eq("store_id", storeId)
      .maybeSingle();

    if (custErr || !customer) {
      return NextResponse.json(
        { error: "Cliente não autenticado ou não encontrado para esta loja." },
        { status: 401 }
      );
    }

    // 3. Recalcular subtotal com preços oficiais do catálogo no servidor
    let authoritativeItemsSubtotal = 0;
    const storeProductsMap = new Map<string, any>();

    if (Array.isArray(items) && items.length > 0) {
      const { data: dbProducts } = await supabase
        .from("products")
        .select("id, name, price, stock")
        .eq("store_id", storeId);

      for (const p of dbProducts || []) {
        storeProductsMap.set(p.id, p);
      }

      for (const item of items) {
        const qty = Math.max(1, Math.round(Number(item.qty || 1)));
        const dbProd = item.id ? storeProductsMap.get(item.id) : null;
        const unitPrice = dbProd ? Number(dbProd.price) : Math.max(0, Number(item.price || 0));
        authoritativeItemsSubtotal += unitPrice * qty;
      }
      authoritativeItemsSubtotal = Number(authoritativeItemsSubtotal.toFixed(2));
    }

    // 4. Carregar cupons e fidelidade da loja para cálculo server-side
    const parsedFreight = deliveryType === "retirada" ? 0 : Math.max(0, Number(freightFee || 0));
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
        return NextResponse.json(
          { error: `Cupom "${normCode}" não encontrado ou expirado.` },
          { status: 400 }
        );
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
        : Math.max(0, Number(totalAmount) - parsedFreight);

    const discountCalc = computeOrderDiscounts({
      subtotal: effectiveSubtotal,
      freightFee: parsedFreight,
      coupon: matchedCoupon,
      loyaltyConfig,
      customerPoints: currentPoints,
      redeemLoyalty: Boolean(redeemLoyalty),
    });

    if (discountCalc.couponError) {
      return NextResponse.json({ error: discountCalc.couponError }, { status: 400 });
    }

    const parsedTotal =
      authoritativeItemsSubtotal > 0 || discountCalc.totalDiscount > 0
        ? discountCalc.finalTotal
        : Number(Number(totalAmount).toFixed(2));

    const commissionRate = Number(store.commission_rate || 5.0);
    const commissionAmount = Number(((parsedTotal * commissionRate) / 100).toFixed(2));

    let formattedDescription = description || "";
    if (!formattedDescription && Array.isArray(items)) {
      formattedDescription = items
        .map((i: any) => `${i.qty}x ${i.name || i.product?.name || "Item"}`)
        .join(" • ");
    }

    const pointsEarned = loyaltyConfig.enabled ? 1 : 0;

    // 5. Inserir venda com colunas completas (e fallback transparente se SQL v3 ainda não foi executado)
    let saleRecord: any = null;
    const fullInsertPayload: any = {
      store_id: storeId,
      customer_id: customer.id,
      total_amount: parsedTotal,
      commission_amount: commissionAmount,
      payment_method: paymentMethod || "Pix",
      description: formattedDescription,
      items: items || null,
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
        // Fallback preservando description & items se já existirem ou núcleo mínimo
        const corePayload: any = {
          store_id: storeId,
          customer_id: customer.id,
          total_amount: parsedTotal,
          commission_amount: commissionAmount,
          payment_method: paymentMethod || "Pix",
          description: formattedDescription,
          items: items || null,
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
            return NextResponse.json(
              { error: "Erro ao registrar venda: " + minRes.error.message },
              { status: 500 }
            );
          }
          saleRecord = minRes.data;
        } else {
          saleRecord = resCore.data;
        }
      } else {
        return NextResponse.json(
          { error: "Erro ao registrar venda: " + saleErr.message },
          { status: 500 }
        );
      }
    } else {
      saleRecord = saleData;
    }

    // 6. Baixa automática de estoque dos produtos comprados
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const dbProd = item.id ? storeProductsMap.get(item.id) : null;
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

    // 7. Atualiza saldo devedor (se Fiado) e pontos de fidelidade do cliente
    const nextBalance =
      paymentMethod === "Fiado"
        ? Number((Number(customer.balance || 0) + parsedTotal).toFixed(2))
        : Number(customer.balance || 0);

    const nextPoints =
      Math.max(0, currentPoints - discountCalc.pointsRedeemed) + pointsEarned;

    const custUpdateRes = await supabase
      .from("customers")
      .update({
        ...(paymentMethod === "Fiado" ? { balance: nextBalance } : {}),
        loyalty_points: nextPoints,
      })
      .eq("id", customer.id);

    if (custUpdateRes.error && paymentMethod === "Fiado") {
      await supabase
        .from("customers")
        .update({ balance: nextBalance })
        .eq("id", customer.id);
    }

    // 8. Espelhar status/detalhes/fidelidade/cupons no metadata do dono (zero risco de perda antes do SQL v3)
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

    // 9. Disparo automático via Baileys
    const zapUrl = getZapApiUrl();
    const zapKey = getZapApiKey();
    let merchantNotified = false;
    let customerNotified = false;

    const itemsLines =
      Array.isArray(items) && items.length > 0
        ? items
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
          address ? address : deliveryType === "retirada" ? "🏬 Retirada no balcão da loja" : "",
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

        if (paymentMethod === "Pix" && store.pix_key) {
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
              paymentMethod === "Pix" && store.pix_key
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

    return NextResponse.json({
      success: true,
      message: "Pedido registrado com sucesso!",
      sale: { ...saleRecord, order_status: "RECEBIDO" },
      finalTotal: parsedTotal,
      loyaltyPoints: nextPoints,
      merchantNotified,
      customerNotified,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro interno ao processar pedido." },
      { status: 500 }
    );
  }
}
