import { createClient } from "@supabase/supabase-js";
import { formatBRL } from "@/lib/whatsapp";
import { generatePixCopiaECola } from "@/lib/pix";

export interface Encomenda {
  id: string;
  store_id: string;
  customer_id: string;
  sale_id?: string | null;
  description: string;
  quantity: number;
  total_amount: number;
  delivery_date?: string | null;
  due_date: string;
  paid_at?: string | null;
  status: "PENDENTE" | "PAGA" | "ATRASADA" | "CANCELADA";
  notes?: string | null;
  last_notified_at?: string | null;
  notification_count: number;
  created_at: string;
  updated_at: string;
  // Joins
  customer?: {
    id: string;
    name: string;
    phone: string;
    balance: number;
  };
  notifications?: EncomendaNotification[];
}

export interface EncomendaNotification {
  id: string;
  encomenda_id: string;
  store_id: string;
  customer_id: string;
  idempotency_key: string;
  phone: string;
  amount: number;
  message: string;
  status: "sent" | "failed" | "pending";
  error_message?: string | null;
  sent_at: string;
}

/**
 * Retorna o cliente administrativo do Supabase com service_role para operações de backend seguras.
 */
export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  return createClient(url, key);
}

/**
 * Retorna a data de hoje no fuso horário America/Sao_Paulo (YYYY-MM-DD).
 */
export function getSaoPauloDateString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value || "";
  const month = parts.find((p) => p.type === "month")?.value || "";
  const day = parts.find((p) => p.type === "day")?.value || "";
  return `${year}-${month}-${day}`;
}

/**
 * Calcula o status dinâmico da encomenda (se PENDENTE e due_date < hoje => ATRASADA).
 */
export function resolveEncomendaStatus(
  status: "PENDENTE" | "PAGA" | "ATRASADA" | "CANCELADA",
  dueDate: string
): "PENDENTE" | "PAGA" | "ATRASADA" | "CANCELADA" {
  if (status === "PAGA" || status === "CANCELADA") return status;
  const todayStr = getSaoPauloDateString();
  if (dueDate < todayStr) {
    return "ATRASADA";
  }
  return "PENDENTE";
}

/**
 * Formata o modelo oficial de cobrança WhatsApp para encomendas.
 */
export function buildEncomendaWhatsAppMessage(params: {
  customerName: string;
  description: string;
  quantity: number;
  amount: number;
  dueDate: string;
  storeName: string;
  pixKey?: string | null;
  pixCity?: string | null;
}): { messageText: string; pixCode: string | null } {
  const { customerName, description, amount, dueDate, storeName, pixKey, pixCity } = params;

  const formattedAmount = formatBRL(amount);
  const formattedDate = dueDate
    ? new Date(`${dueDate}T12:00:00`).toLocaleDateString("pt-BR")
    : dueDate;

  let pixCode: string | null = null;
  if (pixKey) {
    try {
      pixCode = generatePixCopiaECola({
        pixKey: pixKey.trim(),
        merchantName: storeName || "MEUFIADIM",
        merchantCity: pixCity || "BRASIL",
        amount,
      });
    } catch (e) {
      console.warn("Erro ao gerar Pix Copia e Cola da encomenda:", e);
    }
  }

  const lines = [
    `Olá, ${customerName}! 👋`,
    ``,
    `Passando para lembrar do pagamento da sua encomenda:`,
    ``,
    `🍱 *${description}*`,
    `💰 *Valor:* ${formattedAmount}`,
    `📅 *Data combinada para pagamento:* ${formattedDate}`,
    ``,
  ];

  if (pixCode) {
    lines.push(
      `🔑 *Chave Pix:* ${pixKey}`,
      ``,
      `*Pix Copia e Cola:*`,
      pixCode,
      ``,
      `Toque no código acima para copiar e pagar pelo seu aplicativo do banco. 👇`,
      ``
    );
  } else if (pixKey) {
    lines.push(`🔑 *Chave Pix:* ${pixKey}`, ``);
  }

  lines.push(`Obrigado pela preferência!`, `*${storeName || "MEU FIADIM"}*`);

  return {
    messageText: lines.join("\n"),
    pixCode,
  };
}
