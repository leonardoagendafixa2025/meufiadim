import { NextResponse } from "next/server";
import {
  getSupabaseAdmin,
  buildEncomendaWhatsAppMessage,
  type Encomenda,
} from "@/lib/encomendas";
import { getZapApiUrl, getZapApiKey } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

async function authenticateRequest(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  const supabase = getSupabaseAdmin();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  const { data: store } = await supabase
    .from("stores")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!store) return null;
  return { user, store, supabase };
}

/**
 * POST /api/encomendas/[id]/cobrar
 * Envia cobrança imediata no WhatsApp para o cliente da encomenda e registra histórico.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const { user, store, supabase } = auth;

    // 1. Localizar a encomenda com cliente
    let encomenda: Encomenda | null = null;
    const { data: dbData } = await supabase
      .from("encomendas")
      .select(`
        *,
        customer:customers(id, name, phone, balance)
      `)
      .eq("id", id)
      .eq("store_id", store.id)
      .maybeSingle();

    if (dbData) {
      encomenda = dbData as unknown as Encomenda;
    } else {
      const metaEncomendas: Encomenda[] = user.user_metadata?.encomendas || [];
      const found = metaEncomendas.find((e) => e.id === id);
      if (found) {
        const { data: customer } = await supabase
          .from("customers")
          .select("id, name, phone, balance")
          .eq("id", found.customer_id)
          .maybeSingle();

        encomenda = {
          ...found,
          customer: customer || {
            id: found.customer_id,
            name: "Cliente",
            phone: "",
            balance: 0,
          },
        };
      }
    }

    if (!encomenda) {
      return NextResponse.json(
        { error: "Encomenda não encontrada" },
        { status: 404 }
      );
    }

    if (encomenda.status === "PAGA") {
      return NextResponse.json(
        { error: "Esta encomenda já foi paga e não pode ser cobrada." },
        { status: 400 }
      );
    }

    if (encomenda.status === "CANCELADA") {
      return NextResponse.json(
        { error: "Esta encomenda está cancelada." },
        { status: 400 }
      );
    }

    const customer = encomenda.customer;
    if (!customer?.phone) {
      return NextResponse.json(
        { error: "O cliente desta encomenda não possui telefone cadastrado." },
        { status: 400 }
      );
    }

    // 2. Construir mensagem oficial formatada com Pix Copia e Cola
    const { messageText, pixCode } = buildEncomendaWhatsAppMessage({
      customerName: customer.name,
      description: encomenda.description,
      quantity: encomenda.quantity,
      amount: encomenda.total_amount,
      dueDate: encomenda.due_date,
      storeName: store.name,
      pixKey: store.pix_key,
      pixCity: store.pix_city,
    });

    const zapUrl = getZapApiUrl();
    const zapKey = getZapApiKey();
    const cleanPhone = customer.phone.replace(/\D/g, "");

    let sendStatus: "sent" | "failed" = "sent";
    let sendError: string | null = null;

    try {
      const zapRes = await fetch(`${zapUrl}/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": zapKey,
        },
        body: JSON.stringify({
          phone: cleanPhone,
          text: messageText,
          pix: store.pix_key
            ? {
                pixKey: store.pix_key,
                merchantName: store.name || "MEUFIADIM",
                merchantCity: store.pix_city || "BRASIL",
                amount: Number(encomenda.total_amount),
              }
            : null,
        }),
      });

      if (!zapRes.ok) {
        const errJson = await zapRes.json().catch(() => ({}));
        sendStatus = "failed";
        sendError = errJson.error || `HTTP ${zapRes.status}`;
      }
    } catch (err: any) {
      sendStatus = "failed";
      sendError = err.message || "Erro de conexão com o WhatsApp";
    }

    // 3. Registrar notificação para controle de histórico e auditoria
    const notificationId = crypto.randomUUID();
    const idempotencyKey = `manual_${id}_${Date.now()}`;
    const notificationRecord = {
      id: notificationId,
      encomenda_id: id,
      store_id: store.id,
      customer_id: customer.id,
      idempotency_key: idempotencyKey,
      phone: cleanPhone,
      amount: encomenda.total_amount,
      message: messageText,
      status: sendStatus,
      error_message: sendError,
      sent_at: new Date().toISOString(),
    };

    // Tentar salvar na tabela encomenda_notifications
    const { error: notifErr } = await supabase
      .from("encomenda_notifications")
      .insert(notificationRecord);

    if (notifErr) {
      // Salva no fallback
      const metaNotifs: any[] = user.user_metadata?.encomenda_notifications || [];
      metaNotifs.unshift(notificationRecord);
      await supabase.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...user.user_metadata,
          encomenda_notifications: metaNotifs,
        },
      });
    }

    // 4. Atualizar contadores na encomenda
    const nowIso = new Date().toISOString();
    const count = (encomenda.notification_count || 0) + (sendStatus === "sent" ? 1 : 0);

    if (dbData) {
      await supabase
        .from("encomendas")
        .update({
          last_notified_at: sendStatus === "sent" ? nowIso : encomenda.last_notified_at,
          notification_count: count,
          updated_at: nowIso,
        })
        .eq("id", id);
    } else {
      const metaEncomendas: Encomenda[] = user.user_metadata?.encomendas || [];
      const updatedList = metaEncomendas.map((e) =>
        e.id === id
          ? {
              ...e,
              last_notified_at: sendStatus === "sent" ? nowIso : e.last_notified_at,
              notification_count: count,
              updated_at: nowIso,
            }
          : e
      );
      await supabase.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...user.user_metadata,
          encomendas: updatedList,
        },
      });
    }

    if (sendStatus === "failed") {
      return NextResponse.json(
        {
          error: `Erro ao enviar WhatsApp: ${sendError || "Verifique o QR Code ou conexão do WhatsApp"}`,
          notification: notificationRecord,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Cobrança enviada com sucesso no WhatsApp!",
      messageText,
      pixCode,
      notification: notificationRecord,
    });
  } catch (error: any) {
    console.error("Erro ao cobrar encomenda:", error);
    return NextResponse.json(
      { error: "Erro interno ao processar disparo de cobrança" },
      { status: 500 }
    );
  }
}
