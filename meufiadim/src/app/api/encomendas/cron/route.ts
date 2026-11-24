import { NextResponse } from "next/server";
import {
  getSupabaseAdmin,
  getSaoPauloDateString,
  buildEncomendaWhatsAppMessage,
} from "@/lib/encomendas";
import { getZapApiUrl, getZapApiKey } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

/**
 * GET e POST /api/encomendas/cron
 * Agendador automatizado de cobranças de encomendas:
 * 1. Identifica encomendas com vencimento na data de hoje (America/Sao_Paulo)
 * 2. Verifica se a encomenda continua PENDENTE
 * 3. Verifica se o cliente ainda possui débito em aberto
 * 4. Valida idempotência (chave única encomenda_{id}_{dueDate}) para NUNCA duplicar disparo
 * 5. Envia cobrança pelo WhatsApp com modelo oficial
 * 6. Registra no histórico de notificações
 * 7. Atualiza contadores da encomenda
 */
async function processEncomendasCron(targetDate?: string) {
  const supabase = getSupabaseAdmin();
  const todayStr = targetDate || getSaoPauloDateString();
  const zapUrl = getZapApiUrl();
  const zapKey = getZapApiKey();

  const results: any[] = [];
  let scanned = 0;
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  // 1. Buscar todas as encomendas elegíveis (tabela oficial)
  let eligibleEncomendas: any[] = [];
  const { data: dbEncomendas, error: dbErr } = await supabase
    .from("encomendas")
    .select(`
      *,
      store:stores(id, name, pix_key, pix_city, status),
      customer:customers(id, name, phone, balance)
    `)
    .eq("due_date", todayStr)
    .eq("status", "PENDENTE");

  if (!dbErr && dbEncomendas) {
    eligibleEncomendas = dbEncomendas;
  } else {
    // Fallback: verificar lojistas em auth.users
    const { data: usersData } = await supabase.auth.admin.listUsers();
    if (usersData?.users) {
      for (const u of usersData.users) {
        const metaEnc: any[] = u.user_metadata?.encomendas || [];
        for (const e of metaEnc) {
          if (e.due_date === todayStr && e.status === "PENDENTE") {
            const { data: store } = await supabase
              .from("stores")
              .select("id, name, pix_key, pix_city, status")
              .eq("id", e.store_id)
              .maybeSingle();

            const { data: customer } = await supabase
              .from("customers")
              .select("id, name, phone, balance")
              .eq("id", e.customer_id)
              .maybeSingle();

            eligibleEncomendas.push({
              ...e,
              store,
              customer,
            });
          }
        }
      }
    }
  }

  scanned = eligibleEncomendas.length;

  for (const item of eligibleEncomendas) {
    const { id: encomendaId, store, customer, due_date, description, quantity, total_amount } = item;

    // Verificar se o lojista está ativo
    if (!store || store.status === "blocked") {
      skipped++;
      results.push({
        encomendaId,
        reason: "Loja bloqueada ou não encontrada",
        status: "skipped",
      });
      continue;
    }

    // Verificar se o cliente tem saldo em aberto e telefone válido
    if (!customer || !customer.phone || Number(customer.balance) <= 0) {
      skipped++;
      results.push({
        encomendaId,
        customerName: customer?.name || "Desconhecido",
        reason: "Cliente sem saldo devedor ou sem telefone",
        status: "skipped",
      });
      continue;
    }

    // Controle de Idempotência Obrigatório:
    // Chave única: encomenda_{encomendaId}_{dueDate}
    const idempotencyKey = `encomenda_${encomendaId}_${due_date}`;

    // Verificar se já existe envio com sucesso para esta chave
    const { data: existingNotif } = await supabase
      .from("encomenda_notifications")
      .select("id")
      .eq("idempotency_key", idempotencyKey)
      .eq("status", "sent")
      .maybeSingle();

    if (existingNotif) {
      skipped++;
      results.push({
        encomendaId,
        idempotencyKey,
        customerName: customer.name,
        reason: "Cobrança para esta data já foi enviada anteriormente (idempotência)",
        status: "skipped",
      });
      continue;
    }

    // Montar mensagem oficial
    const { messageText } = buildEncomendaWhatsAppMessage({
      customerName: customer.name,
      description,
      quantity,
      amount: total_amount,
      dueDate: due_date,
      storeName: store.name,
      pixKey: store.pix_key,
      pixCity: store.pix_city,
    });

    const cleanPhone = customer.phone.replace(/\D/g, "");
    let sendOk = false;
    let errMsg: string | null = null;

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
                amount: Number(total_amount),
              }
            : null,
        }),
      });

      if (zapRes.ok) {
        sendOk = true;
      } else {
        const errJson = await zapRes.json().catch(() => ({}));
        errMsg = errJson.error || `HTTP ${zapRes.status}`;
      }
    } catch (e: any) {
      errMsg = e.message || "Falha de conexão com o WhatsApp";
    }

    // Registrar no histórico de notificações
    const notifRecord = {
      id: crypto.randomUUID(),
      encomenda_id: encomendaId,
      store_id: store.id,
      customer_id: customer.id,
      idempotency_key: idempotencyKey,
      phone: cleanPhone,
      amount: total_amount,
      message: messageText,
      status: sendOk ? ("sent" as const) : ("failed" as const),
      error_message: errMsg,
      sent_at: new Date().toISOString(),
    };

    await supabase.from("encomenda_notifications").insert(notifRecord);

    if (sendOk) {
      sent++;
      // Atualizar last_notified_at na encomenda
      await supabase
        .from("encomendas")
        .update({
          last_notified_at: new Date().toISOString(),
          notification_count: (item.notification_count || 0) + 1,
        })
        .eq("id", encomendaId);

      results.push({
        encomendaId,
        customerName: customer.name,
        phone: cleanPhone,
        status: "sent",
      });
    } else {
      failed++;
      results.push({
        encomendaId,
        customerName: customer.name,
        phone: cleanPhone,
        status: "failed",
        error: errMsg,
      });
    }

    // Delay preventivo de 1.5s entre disparos
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  return {
    date: todayStr,
    scanned,
    sent,
    skipped,
    failed,
    results,
  };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const dateParam = url.searchParams.get("date") || undefined;
    const report = await processEncomendasCron(dateParam);
    return NextResponse.json({ ok: true, report });
  } catch (err: any) {
    console.error("Erro no cron de encomendas:", err);
    return NextResponse.json(
      { error: "Erro interno no cron de encomendas", message: err.message },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const dateParam = body.date || undefined;
    const report = await processEncomendasCron(dateParam);
    return NextResponse.json({ ok: true, report });
  } catch (err: any) {
    console.error("Erro no cron de encomendas:", err);
    return NextResponse.json(
      { error: "Erro interno no cron de encomendas", message: err.message },
      { status: 500 }
    );
  }
}
