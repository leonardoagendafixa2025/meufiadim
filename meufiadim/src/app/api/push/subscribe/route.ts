import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/encomendas";
import {
  getStoreVapidKeys,
  savePushSubscription,
  type PushRole,
} from "@/lib/web-push";

export const dynamic = "force-dynamic";

/**
 * GET /api/push/subscribe?storeId=...
 * Retorna a chave pública VAPID para o navegador registrar Web Push nessa loja.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const storeId = (searchParams.get("storeId") || "").trim();

    if (!storeId) {
      return NextResponse.json({ error: "storeId é obrigatório." }, { status: 400 });
    }

    const vapid = await getStoreVapidKeys(storeId);
    if (!vapid) {
      return NextResponse.json({ error: "Loja não encontrada." }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      supported: true,
      publicKey: vapid.publicKey,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Erro ao obter configuração de Push." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/push/subscribe
 * Registra inscrição Web Push para Lojista (Bearer Auth) ou Cliente (store_id validado).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const storeId = String(body.storeId || "").trim();
    const role: PushRole = body.role === "merchant" ? "merchant" : "customer";
    const customerId = body.customerId ? String(body.customerId).trim() : null;
    const subscription = body.subscription;

    if (!storeId || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json(
        { error: "Dados de assinatura Web Push incompletos." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    if (role === "merchant") {
      const authHeader = req.headers.get("authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
      }
      const token = authHeader.replace("Bearer ", "").trim();
      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser(token);

      if (authErr || !user) {
        return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
      }

      const { data: store } = await supabase
        .from("stores")
        .select("id")
        .eq("id", storeId)
        .eq("owner_id", user.id)
        .maybeSingle();

      if (!store) {
        return NextResponse.json(
          { error: "Você não tem permissão para registrar alertas nesta loja." },
          { status: 403 }
        );
      }
    } else {
      if (!customerId) {
        return NextResponse.json(
          { error: "customerId é obrigatório para notificações de pedidos." },
          { status: 400 }
        );
      }

      // Validação multi-tenant anti-IDOR: cliente deve pertencer exatamente àquela loja
      const { data: cust } = await supabase
        .from("customers")
        .select("id")
        .eq("id", customerId)
        .eq("store_id", storeId)
        .maybeSingle();

      if (!cust) {
        return NextResponse.json(
          { error: "Cliente não localizado nesta loja." },
          { status: 403 }
        );
      }
    }

    await savePushSubscription({
      storeId,
      role,
      customerId,
      subscription,
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Erro ao salvar assinatura Push." },
      { status: 500 }
    );
  }
}
