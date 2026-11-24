import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getZapApiUrl, getZapApiKey } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return createClient(url, key);
}

function interpolateMessage(
  template: string,
  store: {
    name?: string | null;
    slug?: string | null;
    commission_rate?: number | null;
    whatsapp?: string | null;
  }
): string {
  const storeName = store.name || "Lojista Parceiro";
  const storeSlug = store.slug || "";
  const storeCommission = store.commission_rate !== undefined && store.commission_rate !== null
    ? `${store.commission_rate}%`
    : "5%";
  const storeWhatsapp = store.whatsapp || "";
  const storeLink = storeSlug ? `https://meufiadim.com.br/${storeSlug}` : "https://meufiadim.com.br";

  return template
    .replace(/{nome_loja}/gi, storeName)
    .replace(/{slug}/gi, storeSlug)
    .replace(/{comissao}/gi, storeCommission)
    .replace(/{whatsapp}/gi, storeWhatsapp)
    .replace(/{link_loja}/gi, storeLink);
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseAdmin = getSupabaseAdmin();
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    const userEmail = (user?.email || "").toLowerCase().trim();
    const superAdmins = [
      "toyesterdayagencia@gmail.com",
      (process.env.NEXT_PUBLIC_SUPERADMIN_EMAIL || "").toLowerCase().trim(),
    ].filter(Boolean);

    if (authError || !user || !superAdmins.includes(userEmail)) {
      return NextResponse.json(
        { error: "Acesso negado. Apenas o SuperAdmin pode disparar comunicados." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { target, title, message, testPhone } = body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { error: "A mensagem do comunicado não pode ficar vazia." },
        { status: 400 }
      );
    }

    const campaignTitle = (title || "").trim() || "Comunicado Oficial";
    const zapUrl = getZapApiUrl();
    const zapKey = getZapApiKey();

    // 1. MODO TESTE (Envio individual)
    if (target === "test") {
      const rawPhone = (testPhone || user.user_metadata?.whatsapp || "").replace(/\D/g, "");
      if (!rawPhone || rawPhone.length < 10) {
        return NextResponse.json(
          { error: "Informe um número de WhatsApp válido com DDD para o envio de teste." },
          { status: 400 }
        );
      }

      // Interpolação com dados de exemplo realistas
      const previewText = interpolateMessage(message, {
        name: "Loja Modelo Exemplo",
        slug: "loja-exemplo",
        commission_rate: 8,
        whatsapp: rawPhone,
      });

      const res = await fetch(`${zapUrl}/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": zapKey,
        },
        body: JSON.stringify({
          phone: rawPhone,
          text: `[TESTE DE CAMPANHA]\n\n${previewText}`,
        }),
      });

      const zapData = await res.json().catch(() => ({}));

      if (!res.ok) {
        return NextResponse.json(
          { error: zapData.error || "Falha ao enviar mensagem de teste pelo robô oficial." },
          { status: res.status }
        );
      }

      return NextResponse.json({
        ok: true,
        isTest: true,
        sentTo: rawPhone,
        message: "Mensagem de teste enviada com sucesso para o seu WhatsApp!",
      });
    }

    // 2. MODO DISPARO EM MASSA (Lojas cadastradas)
    let query = supabaseAdmin
      .from("stores")
      .select("id, name, slug, whatsapp, commission_rate, status");

    if (target === "active") {
      query = query.eq("status", "active");
    } else if (target === "blocked") {
      query = query.eq("status", "blocked");
    }

    const { data: storesList, error: storesError } = await query;

    if (storesError) {
      return NextResponse.json(
        { error: `Erro ao consultar lojistas: ${storesError.message}` },
        { status: 500 }
      );
    }

    // Filtra apenas lojas com WhatsApp cadastrado
    const eligibleStores = (storesList || []).filter((s) => {
      const digits = (s.whatsapp || "").replace(/\D/g, "");
      return digits.length >= 10;
    });

    if (eligibleStores.length === 0) {
      return NextResponse.json(
        {
          error:
            "Nenhum lojista encontrado para o público selecionado com número de WhatsApp válido.",
        },
        { status: 400 }
      );
    }

    const results: Array<{
      storeId: string;
      storeName: string;
      phone: string;
      status: "sent" | "failed";
      error?: string;
    }> = [];

    // Disparo cadenciado com delay seguro entre cada loja para proteção contra spam
    for (let i = 0; i < eligibleStores.length; i++) {
      const store = eligibleStores[i];
      const cleanPhone = (store.whatsapp || "").replace(/\D/g, "");
      const storeMessage = interpolateMessage(message, store);

      try {
        const res = await fetch(`${zapUrl}/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": zapKey,
          },
          body: JSON.stringify({
            phone: cleanPhone,
            text: storeMessage,
          }),
        });

        if (res.ok) {
          results.push({
            storeId: store.id,
            storeName: store.name,
            phone: cleanPhone,
            status: "sent",
          });
        } else {
          const errRes = await res.json().catch(() => ({}));
          results.push({
            storeId: store.id,
            storeName: store.name,
            phone: cleanPhone,
            status: "failed",
            error: errRes.error || `HTTP ${res.status}`,
          });
        }
      } catch (sendErr: any) {
        results.push({
          storeId: store.id,
          storeName: store.name,
          phone: cleanPhone,
          status: "failed",
          error: sendErr.message || "Erro de conexão",
        });
      }

      // Intervalo de segurança de 1.8 segundos entre os disparos
      if (i < eligibleStores.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1800));
      }
    }

    const sentCount = results.filter((r) => r.status === "sent").length;
    const failedCount = results.filter((r) => r.status === "failed").length;

    // 3. Salvar no histórico de campanhas em user_metadata do SuperAdmin
    const existingHistory: any[] = user.user_metadata?.campaigns_history || [];
    const newEntry = {
      id: crypto.randomUUID(),
      title: campaignTitle,
      target,
      target_label:
        target === "all"
          ? "Todas as Lojas"
          : target === "active"
          ? "Lojas Ativas"
          : "Lojas Bloqueadas",
      message_preview: message.slice(0, 160) + (message.length > 160 ? "..." : ""),
      full_message: message,
      total_target: eligibleStores.length,
      sent_count: sentCount,
      failed_count: failedCount,
      created_at: new Date().toISOString(),
    };

    // Mantém as últimas 30 campanhas
    const updatedHistory = [newEntry, ...existingHistory].slice(0, 30);

    await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...(user.user_metadata || {}),
        campaigns_history: updatedHistory,
      },
    });

    return NextResponse.json({
      ok: true,
      sentCount,
      failedCount,
      totalTarget: eligibleStores.length,
      results,
      campaign: newEntry,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Erro interno ao processar campanha." },
      { status: 500 }
    );
  }
}
