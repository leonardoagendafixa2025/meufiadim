import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/encomendas";
import { getZapApiKey, formatBRL } from "@/lib/whatsapp";
import { cleanPhone } from "@/lib/customer-auth";
import { runAiAgent } from "@/lib/ai-agent";

export const dynamic = "force-dynamic";

function matchPhone(a?: string | null, b?: string | null): boolean {
  const da = cleanPhone(a || "");
  const db = cleanPhone(b || "");
  if (!da || !db) return false;
  // Compara últimos 10/11 dígitos (com ou sem 55)
  const normA = da.startsWith("55") && da.length >= 12 ? da.slice(2) : da;
  const normB = db.startsWith("55") && db.length >= 12 ? db.slice(2) : db;
  if (normA === normB) return true;
  // Tolerância ao 9º dígito brasileiro (últimos 8 dígitos + DDD)
  return normA.slice(-8) === normB.slice(-8) && normA.slice(0, 2) === normB.slice(0, 2);
}

/**
 * POST /api/ai/whatsapp
 * Webhook chamado pelo robô Baileys (meufiadim-zap) quando chega uma mensagem privada de texto.
 * Identifica automaticamente se o remetente é um Lojista (Copiloto) ou Consumidor (Vendedor).
 */
export async function POST(req: Request) {
  try {
    const apiKey = req.headers.get("x-api-key") || "";
    if (apiKey !== getZapApiKey()) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const { fromPhone, text } = body;
    const cleanText = String(text || "").trim();

    if (!fromPhone || !cleanText) {
      return NextResponse.json({ ok: true, shouldReply: false });
    }

    const supabase = getSupabaseAdmin();

    // 1. Verificar se quem enviou a mensagem é um LOJISTA dono de alguma loja
    const { data: stores } = await supabase
      .from("stores")
      .select("id, owner_id, name, slug, whatsapp, status");

    const merchantStore = (stores || []).find((s) => matchPhone(s.whatsapp, fromPhone));

    if (merchantStore) {
      // Lojista falando no WhatsApp com o Copiloto IA da própria loja
      const result = await runAiAgent({
        message: cleanText,
        history: [],
        ctx: {
          role: "merchant",
          storeId: merchantStore.id,
          userId: merchantStore.owner_id,
        },
        storeName: merchantStore.name,
      });

      return NextResponse.json({
        ok: true,
        shouldReply: true,
        role: "merchant",
        reply: `🏪 *${merchantStore.name}*\n\n${result.reply}`,
      });
    }

    // 2. Se não for lojista, verificar se é um CLIENTE cadastrado em alguma loja (ou mencionou #slug)
    const slugMatch = cleanText.match(/#([a-z0-9-]+)/i);
    let targetStore = slugMatch
      ? (stores || []).find((s) => s.slug.toLowerCase() === slugMatch[1].toLowerCase())
      : null;

    let customerId: string | null = null;
    const { data: allCustomers } = await supabase
      .from("customers")
      .select("id, store_id, name, phone, balance");

    const matchingCustomers = (allCustomers || []).filter((c) =>
      matchPhone(c.phone, fromPhone)
    );

    if (!targetStore && matchingCustomers.length === 1) {
      targetStore = (stores || []).find((s) => s.id === matchingCustomers[0].store_id) || null;
      customerId = matchingCustomers[0].id;
    } else if (targetStore) {
      const custInStore = matchingCustomers.find((c) => c.store_id === targetStore!.id);
      customerId = custInStore?.id || null;
    }

    // Se o cliente não pertence a uma loja única nem indicou #slug,
    // só respondemos se ele explicitamente saudou/pediu ajuda para não responder conversas pessoais!
    if (!targetStore) {
      const lower = cleanText.toLowerCase();
      const isAskingBot =
        lower.startsWith("/ajuda") ||
        lower.startsWith("#") ||
        lower.includes("cardápio") ||
        lower.includes("cardapio") ||
        lower.includes("fiado") ||
        lower.includes("meufiadim");

      if (!isAskingBot) {
        return NextResponse.json({ ok: true, shouldReply: false });
      }

      if (matchingCustomers.length > 1) {
        const storeLines = matchingCustomers
          .map((c) => {
            const st = (stores || []).find((s) => s.id === c.store_id);
            return st ? `• *${st.name}* — digite *#${st.slug}* (Saldo fiado: ${formatBRL(c.balance)})` : null;
          })
          .filter(Boolean);

        return NextResponse.json({
          ok: true,
          shouldReply: true,
          role: "customer",
          reply: `Olá! Encontrei seu cadastro em mais de uma loja do *MeuFiadim*:\n\n${storeLines.join("\n")}\n\nEnvie sua pergunta com o código da loja (ex: *#paola cardápio*).`,
        });
      }

      return NextResponse.json({
        ok: true,
        shouldReply: true,
        role: "customer",
        reply: `Olá! Para falar com uma loja específica pelo WhatsApp, envie a sigla da loja com *#* (exemplo: *#nomedaloja cardápio*) ou acesse diretamente o link da vitrine da loja.`,
      });
    }

    // 3. Cliente identificado em uma loja -> Vendedor IA responde com catálogo/frete/pedidos reais!
    const cleanQuestion = cleanText.replace(/#[a-z0-9-]+/gi, "").trim() || "olá";
    const result = await runAiAgent({
      message: cleanQuestion,
      history: [],
      ctx: {
        role: "customer",
        storeId: targetStore.id,
        customerId,
      },
      storeName: targetStore.name,
    });

    return NextResponse.json({
      ok: true,
      shouldReply: true,
      role: "customer",
      reply: `🛍️ *Atendimento ${targetStore.name}*\n\n${result.reply}`,
    });
  } catch (err: any) {
    console.error("Erro em /api/ai/whatsapp:", err);
    return NextResponse.json({ ok: false, shouldReply: false });
  }
}
