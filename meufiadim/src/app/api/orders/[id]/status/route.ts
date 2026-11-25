import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/encomendas";
import { canMerchantAccessSystem } from "@/lib/infinitepay";
import { cleanPhone } from "@/lib/customer-auth";
import { getZapApiUrl, getZapApiKey } from "@/lib/whatsapp";
import { sendWebPushToStoreTarget } from "@/lib/web-push";
import {
  buildOrderStatusWhatsAppMessage,
  ORDER_STATUS_META,
  VALID_ORDER_STATUSES,
  type OrderStatus,
} from "@/lib/store-features";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/orders/[id]/status
 * Atualiza o status ao vivo do pedido (RECEBIDO -> EM_PREPARO -> SAIU_ENTREGA -> ENTREGUE / CANCELADO)
 * e notifica o cliente automaticamente via WhatsApp (Baileys).
 */
export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await context.params;
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
      .select("id, name, slug, owner_id")
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
    const nextStatus = String(body.status || "").toUpperCase().trim() as OrderStatus;
    const notifyWhatsapp = body.notifyWhatsapp !== false;

    if (!VALID_ORDER_STATUSES.includes(nextStatus)) {
      return NextResponse.json({ error: "Status inválido." }, { status: 400 });
    }

    const { data: order, error: orderErr } = await supabase
      .from("sales")
      .select("*, customer:customers(id, name, phone)")
      .eq("id", orderId)
      .eq("store_id", store.id)
      .maybeSingle();

    if (orderErr || !order) {
      return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    }

    const nowIso = new Date().toISOString();

    // Tenta atualizar nas colunas dedicadas de public.sales (se já existirem no Supabase)
    const { error: updateErr } = await supabase
      .from("sales")
      .update({
        order_status: nextStatus,
        status_updated_at: nowIso,
      })
      .eq("id", orderId)
      .eq("store_id", store.id);

    if (updateErr && !updateErr.message?.includes("column") && updateErr.code !== "42703") {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Espelha também nos metadados do dono para garantir funcionamento imediato mesmo antes da SQL migration
    const currentStatuses = { ...(user.user_metadata?.order_statuses || {}) };
    currentStatuses[orderId] = nextStatus;

    // Mantém mapa enxuto (últimos 200 pedidos)
    const keys = Object.keys(currentStatuses);
    if (keys.length > 200) {
      for (const k of keys.slice(0, keys.length - 200)) {
        delete currentStatuses[k];
      }
    }

    await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...(user.user_metadata || {}),
        order_statuses: currentStatuses,
      },
    });

    // Notificar cliente via Baileys
    let customerNotified = false;
    const customer = Array.isArray(order.customer) ? order.customer[0] : order.customer;
    const metaDetails = user.user_metadata?.order_details?.[orderId] || {};
    const deliveryType = order.delivery_type || metaDetails.delivery_type || null;

    if (notifyWhatsapp && customer?.phone && nextStatus !== "RECEBIDO") {
      try {
        const messageText = buildOrderStatusWhatsAppMessage({
          customerName: customer.name,
          storeName: store.name,
          status: nextStatus,
          deliveryType,
          totalAmount: Number(order.total_amount || 0),
        });

        const zapRes = await fetch(`${getZapApiUrl()}/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": getZapApiKey(),
          },
          body: JSON.stringify({
            phone: cleanPhone(customer.phone),
            text: messageText,
          }),
        });
        customerNotified = zapRes.ok;
      } catch (err) {
        console.warn("Falha ao enviar atualização de status no WhatsApp:", err);
      }
    }

    let customerPushSent = false;
    if (customer?.id && nextStatus !== "RECEBIDO") {
      const statusMeta = ORDER_STATUS_META[nextStatus];
      const statusLabel =
        deliveryType === "retirada" && statusMeta.pickupLabel
          ? statusMeta.pickupLabel
          : statusMeta.label;
      const pushRes = await sendWebPushToStoreTarget({
        storeId: store.id,
        role: "customer",
        customerId: customer.id,
        title: `${store.name} — ${statusLabel}`,
        body: `Seu pedido agora está: ${statusLabel}. Toque para acompanhar.`,
        url: `/${store.slug}`,
        tag: `order-status-${orderId}`,
      });
      customerPushSent = pushRes.sent > 0;
    }

    return NextResponse.json({
      ok: true,
      orderId,
      status: nextStatus,
      customerNotified,
      customerPushSent,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Erro ao atualizar status do pedido." },
      { status: 500 }
    );
  }
}
