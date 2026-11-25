import { NextResponse } from "next/server";
import { getSupabaseAdmin, getSaoPauloDateString } from "@/lib/encomendas";
import { canMerchantAccessSystem } from "@/lib/infinitepay";
import { formatBRL, getZapApiUrl, getZapApiKey } from "@/lib/whatsapp";
import {
  DEFAULT_FIADO_BILLING_CONFIG,
  type FiadoBillingConfig,
} from "@/lib/store-features";

export const dynamic = "force-dynamic";

function daysDiff(targetDateStr: string, todayStr: string): number {
  const t = new Date(`${targetDateStr}T12:00:00Z`).getTime();
  const c = new Date(`${todayStr}T12:00:00Z`).getTime();
  return Math.round((t - c) / (24 * 60 * 60 * 1000));
}

function buildFiadoStageMessage(params: {
  stage: "BEFORE_DUE" | "DUE_TODAY" | "OVERDUE";
  customerName: string;
  storeName: string;
  balance: number;
  dueDate: string;
  hasPixKey: boolean;
  daysLateOrBefore: number;
}): string {
  const formattedVal = formatBRL(params.balance);
  const formattedDue = new Date(`${params.dueDate}T12:00:00`).toLocaleDateString("pt-BR");

  const lines: string[] = [];
  if (params.stage === "BEFORE_DUE") {
    lines.push(
      `Olá, *${params.customerName}*! Tudo bem? 😊`,
      `Lembrete amigável da *${params.storeName}*: seu fiado vence em ${params.daysLateOrBefore === 1 ? "amanhã" : `${params.daysLateOrBefore} dias`} (${formattedDue}).`
    );
  } else if (params.stage === "DUE_TODAY") {
    lines.push(
      `Olá, *${params.customerName}*! Tudo bem?`,
      `Hoje (${formattedDue}) é a data combinada para acerto do seu fiado na *${params.storeName}*:`
    );
  } else {
    lines.push(
      `Olá, *${params.customerName}*, tudo bem?`,
      `Notamos que seu fiado na *${params.storeName}* venceu em ${formattedDue} (há ${params.daysLateOrBefore} dias):`
    );
  }

  lines.push(``, `💰 *Valor em aberto:* ${formattedVal}`, `📅 *Vencimento:* ${formattedDue}`, ``);
  lines.push(
    params.hasPixKey
      ? `Para facilitar o pagamento agora, toque em *"Copiar código Pix"* na mensagem abaixo 👇`
      : `Quando realizar o pagamento, basta nos avisar por aqui. Obrigado pela confiança!`
  );

  return lines.join("\n");
}

async function runFiadoCron(scopedStoreId?: string) {
  const supabase = getSupabaseAdmin();
  const todayStr = getSaoPauloDateString();
  const zapUrl = getZapApiUrl();
  const zapKey = getZapApiKey();

  let storeQuery = supabase.from("stores").select("*").eq("status", "active");
  if (scopedStoreId) {
    storeQuery = storeQuery.eq("id", scopedStoreId);
  }

  const { data: stores } = await storeQuery;
  const activeStores = stores || [];

  let scanned = 0;
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const details: any[] = [];

  for (const store of activeStores) {
    if (!store.owner_id) continue;
    const { data: ownerData } = await supabase.auth.admin.getUserById(store.owner_id);
    const meta = ownerData?.user?.user_metadata || {};
    const config: FiadoBillingConfig = {
      ...DEFAULT_FIADO_BILLING_CONFIG,
      ...(meta.fiado_billing_config || {}),
    };

    // No modo global (cron), respeita o toggle enabled; se o lojista clicou manualmente para testar/rodar na loja dele e enabled=false, ainda exigimos enabled=true ou passamos flag? Respeitamos enabled para segurança!
    if (!config.enabled) {
      continue;
    }

    const access = await canMerchantAccessSystem(store.id);
    if (!access.allowed) {
      skipped++;
      continue;
    }

    const { data: debtors } = await supabase
      .from("customers")
      .select("*")
      .eq("store_id", store.id)
      .gt("balance", 0)
      .not("due_date", "is", null);

    for (const c of debtors || []) {
      scanned++;
      if (!c.phone || !c.due_date) {
        skipped++;
        continue;
      }

      // Nunca envia mais de uma cobrança automática no mesmo dia para o mesmo cliente
      if (c.last_notified_at === todayStr) {
        skipped++;
        continue;
      }

      const diff = daysDiff(c.due_date, todayStr);
      let stage: "BEFORE_DUE" | "DUE_TODAY" | "OVERDUE" | null = null;
      let daysMetric = 0;

      if (config.remindBeforeDays > 0 && diff === config.remindBeforeDays) {
        stage = "BEFORE_DUE";
        daysMetric = config.remindBeforeDays;
      } else if (config.remindOnDueDate && diff === 0) {
        stage = "DUE_TODAY";
        daysMetric = 0;
      } else if (diff < 0 && Math.abs(diff) >= Math.max(1, config.remindOverdueDays)) {
        // Verifica se já passou intervalo desde a última notificação
        if (
          !c.last_notified_at ||
          Math.abs(daysDiff(c.last_notified_at, todayStr)) >= Math.max(1, config.remindOverdueDays)
        ) {
          stage = "OVERDUE";
          daysMetric = Math.abs(diff);
        }
      }

      if (!stage) {
        skipped++;
        continue;
      }

      const idempotencyKey = `fiado_${c.id}_${todayStr}_${stage}`;
      const { data: existingLog } = await supabase
        .from("fiado_notifications")
        .select("id")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();

      if (existingLog) {
        skipped++;
        continue;
      }

      const text = buildFiadoStageMessage({
        stage,
        customerName: c.name,
        storeName: store.name,
        balance: Number(c.balance),
        dueDate: c.due_date,
        hasPixKey: Boolean(store.pix_key),
        daysLateOrBefore: daysMetric,
      });

      try {
        const res = await fetch(`${zapUrl}/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": zapKey,
          },
          body: JSON.stringify({
            phone: c.phone,
            text,
            pix: store.pix_key
              ? {
                  pixKey: store.pix_key,
                  merchantName: store.name || "MEUFIADIM",
                  merchantCity: store.pix_city || "BRASIL",
                  amount: Number(c.balance),
                }
              : null,
          }),
        });

        if (!res.ok) {
          failed++;
          details.push({ customer: c.name, stage, status: "failed" });
          continue;
        }

        await supabase
          .from("customers")
          .update({ last_notified_at: todayStr })
          .eq("id", c.id);

        try {
          await supabase.from("fiado_notifications").insert({
            store_id: store.id,
            customer_id: c.id,
            idempotency_key: idempotencyKey,
            stage,
            amount: Number(c.balance),
            phone: c.phone,
            status: "sent",
          });
        } catch {
          // Ignora caso SQL migration ainda não aplicada
        }

        sent++;
        details.push({ customer: c.name, stage, amount: Number(c.balance), status: "sent" });
      } catch {
        failed++;
        details.push({ customer: c.name, stage, status: "failed" });
      }
    }
  }

  return { ok: true, today: todayStr, scanned, sent, skipped, failed, details };
}

async function authorizeCronRequest(req: Request): Promise<{
  allowed: boolean;
  scopedStoreId?: string;
}> {
  const apiKey = req.headers.get("x-api-key") || "";
  if (apiKey && apiKey === getZapApiKey()) {
    return { allowed: true };
  }

  const cronHeader = req.headers.get("x-vercel-cron");
  if (cronHeader) {
    return { allowed: true };
  }

  const authHeader = req.headers.get("authorization") || "";
  if (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return { allowed: true };
  }

  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "").trim();
    const supabase = getSupabaseAdmin();
    const {
      data: { user },
    } = await supabase.auth.getUser(token);
    if (user) {
      const { data: store } = await supabase
        .from("stores")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (store) {
        return { allowed: true, scopedStoreId: store.id };
      }
    }
  }

  return { allowed: false };
}

export async function GET(req: Request) {
  const auth = await authorizeCronRequest(req);
  if (!auth.allowed) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const result = await runFiadoCron(auth.scopedStoreId);
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const auth = await authorizeCronRequest(req);
  if (!auth.allowed) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const result = await runFiadoCron(auth.scopedStoreId);
  return NextResponse.json(result);
}
