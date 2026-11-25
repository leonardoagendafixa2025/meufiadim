import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/encomendas";
import { canMerchantAccessSystem } from "@/lib/infinitepay";
import { cleanPhone } from "@/lib/customer-auth";
import { getZapApiKey, getZapApiUrl } from "@/lib/whatsapp";
import { getAppPublicBaseUrl } from "@/lib/order-service";
import {
  analyzeDormantCustomers,
  buildReactivationWhatsAppMessage,
} from "@/lib/crm-radar";

export const dynamic = "force-dynamic";

async function authenticateMerchantStore(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) };
  }

  const token = authHeader.replace("Bearer ", "").trim();
  const supabase = getSupabaseAdmin();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser(token);

  if (authErr || !user) {
    return { error: NextResponse.json({ error: "Sessão inválida" }, { status: 401 }) };
  }

  const { data: store } = await supabase
    .from("stores")
    .select("id, name, slug, owner_id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!store) {
    return { error: NextResponse.json({ error: "Loja não encontrada" }, { status: 404 }) };
  }

  return { supabase, user, store };
}

/**
 * GET /api/crm/reactivate?inactiveDays=21
 * Lista clientes sumidos da loja autenticada com LTV e último pedido.
 */
export async function GET(req: Request) {
  try {
    const auth = await authenticateMerchantStore(req);
    if ("error" in auth && auth.error) return auth.error;
    const { supabase, user, store } = auth;

    const { searchParams } = new URL(req.url);
    const inactiveDays = Math.max(
      1,
      Math.min(180, Number(searchParams.get("inactiveDays") || 21))
    );

    const [custRes, salesRes] = await Promise.all([
      supabase
        .from("customers")
        .select("id, name, phone, balance")
        .eq("store_id", store.id),
      supabase
        .from("sales")
        .select("id, customer_id, total_amount, description, items, order_status, created_at")
        .eq("store_id", store.id)
        .order("created_at", { ascending: false }),
    ]);

    const dormantCustomers = analyzeDormantCustomers({
      customers: custRes.data || [],
      sales: salesRes.data || [],
      inactiveDays,
    });

    const reactivatedAt: Record<string, string> =
      user.user_metadata?.crm_reactivated_at || {};

    return NextResponse.json({
      ok: true,
      inactiveDays,
      dormantCustomers,
      reactivatedAt,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Erro ao consultar radar de clientes sumidos." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/crm/reactivate
 * Envia mensagem de reativação via WhatsApp (Baileys) com cupom opcional para um cliente sumido.
 */
export async function POST(req: Request) {
  try {
    const auth = await authenticateMerchantStore(req);
    if ("error" in auth && auth.error) return auth.error;
    const { supabase, user, store } = auth;

    const access = await canMerchantAccessSystem(store.id);
    if (!access.allowed) {
      return NextResponse.json(
        { error: access.reason || "Loja bloqueada financeiramente." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const customerId = String(body.customerId || "").trim();
    const couponCode = body.couponCode ? String(body.couponCode).trim().toUpperCase() : null;
    const customMessage = body.customMessage ? String(body.customMessage).trim() : null;

    if (!customerId) {
      return NextResponse.json({ error: "customerId é obrigatório." }, { status: 400 });
    }

    const { data: customer } = await supabase
      .from("customers")
      .select("id, name, phone")
      .eq("id", customerId)
      .eq("store_id", store.id)
      .maybeSingle();

    if (!customer) {
      return NextResponse.json(
        { error: "Cliente não encontrado nesta loja." },
        { status: 404 }
      );
    }

    if (!customer.phone) {
      return NextResponse.json(
        { error: "Este cliente não possui WhatsApp cadastrado." },
        { status: 400 }
      );
    }

    const { data: lastSales } = await supabase
      .from("sales")
      .select("description, created_at")
      .eq("store_id", store.id)
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false })
      .limit(1);

    const lastOrder = lastSales?.[0];
    const daysSince = lastOrder?.created_at
      ? Math.max(
          1,
          Math.floor((Date.now() - new Date(lastOrder.created_at).getTime()) / (24 * 60 * 60 * 1000))
        )
      : undefined;

    const baseUrl = getAppPublicBaseUrl(req);
    const storeUrl = `${baseUrl}/${store.slug}${
      couponCode ? `?coupon=${encodeURIComponent(couponCode)}` : ""
    }`;

    const messageText =
      customMessage ||
      buildReactivationWhatsAppMessage({
        customerName: customer.name,
        storeName: store.name,
        storeUrl,
        lastOrderDescription: lastOrder?.description,
        couponCode,
        daysSince,
      });

    const phoneDigits = cleanPhone(customer.phone);
    const fallbackUrl = `https://wa.me/${
      phoneDigits.startsWith("55") ? phoneDigits : `55${phoneDigits}`
    }?text=${encodeURIComponent(messageText)}`;

    let sent = false;
    let zapError: string | null = null;
    try {
      const zapRes = await fetch(`${getZapApiUrl()}/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": getZapApiKey(),
        },
        body: JSON.stringify({
          phone: phoneDigits,
          text: messageText,
        }),
      });
      if (zapRes.ok) {
        sent = true;
      } else {
        const errData = await zapRes.json().catch(() => ({}));
        zapError = errData?.error || "WhatsApp central temporariamente indisponível.";
      }
    } catch {
      zapError = "Falha ao conectar com o robô de WhatsApp.";
    }

    const nowIso = new Date().toISOString();
    const prevMap: Record<string, string> = {
      ...(user.user_metadata?.crm_reactivated_at || {}),
    };
    prevMap[customer.id] = nowIso;

    // Mantém histórico enxuto das últimas 150 reativações
    const keys = Object.keys(prevMap);
    if (keys.length > 150) {
      for (const k of keys.slice(0, keys.length - 150)) {
        delete prevMap[k];
      }
    }

    await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...(user.user_metadata || {}),
        crm_reactivated_at: prevMap,
      },
    });

    return NextResponse.json({
      ok: sent,
      sent,
      customerName: customer.name,
      reactivatedAt: nowIso,
      fallbackUrl,
      ...(zapError && !sent ? { error: zapError } : {}),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Erro ao enviar reativação CRM." },
      { status: 500 }
    );
  }
}
