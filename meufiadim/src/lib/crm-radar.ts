import { formatBRL } from "@/lib/whatsapp";

export interface CrmCustomerInput {
  id: string;
  name: string;
  phone: string;
  balance?: number | null;
}

export interface CrmSaleInput {
  id: string;
  customer_id?: string | null;
  total_amount: number;
  description?: string | null;
  items?: Array<{ id?: string; name?: string; qty?: number; price?: number }> | null;
  order_status?: string | null;
  created_at: string;
}

export interface DormantCustomerCandidate {
  customerId: string;
  name: string;
  phone: string;
  balance: number;
  totalOrders: number;
  totalSpent: number;
  totalSpentFormatted: string;
  averageTicket: number;
  averageTicketFormatted: string;
  daysSinceLastPurchase: number;
  lastOrderAt: string;
  lastOrderDescription: string;
  isVipRecurrent: boolean;
}

/**
 * Identifica clientes que já compraram na loja e estão sem pedir há pelo menos `inactiveDays` dias.
 * Ignora pedidos cancelados e prioriza clientes recorrentes e de maior valor acumulado.
 */
export function analyzeDormantCustomers(params: {
  customers: CrmCustomerInput[];
  sales: CrmSaleInput[];
  inactiveDays?: number;
  nowMs?: number;
}): DormantCustomerCandidate[] {
  const inactiveDays = Math.max(1, Math.min(365, Number(params.inactiveDays ?? 21)));
  const nowMs = params.nowMs ?? Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  const statsMap = new Map<
    string,
    {
      totalOrders: number;
      totalSpent: number;
      lastOrderMs: number;
      lastOrderAt: string;
      lastOrderDescription: string;
    }
  >();

  for (const sale of params.sales || []) {
    if (!sale.customer_id) continue;
    if (String(sale.order_status || "").toUpperCase() === "CANCELADO") continue;

    const createdMs = new Date(sale.created_at).getTime();
    if (!Number.isFinite(createdMs)) continue;

    const current = statsMap.get(sale.customer_id);
    const amount = Math.max(0, Number(sale.total_amount || 0));
    const desc =
      (sale.description || "").trim() ||
      (Array.isArray(sale.items) && sale.items.length > 0
        ? sale.items.map((i) => `${i.qty || 1}x ${i.name || "Item"}`).join(" • ")
        : "Pedido na loja");

    if (!current) {
      statsMap.set(sale.customer_id, {
        totalOrders: 1,
        totalSpent: amount,
        lastOrderMs: createdMs,
        lastOrderAt: sale.created_at,
        lastOrderDescription: desc,
      });
    } else {
      current.totalOrders += 1;
      current.totalSpent += amount;
      if (createdMs > current.lastOrderMs) {
        current.lastOrderMs = createdMs;
        current.lastOrderAt = sale.created_at;
        current.lastOrderDescription = desc;
      }
    }
  }

  const results: DormantCustomerCandidate[] = [];

  for (const cust of params.customers || []) {
    const stats = statsMap.get(cust.id);
    if (!stats) continue;

    const daysSince = Math.floor((nowMs - stats.lastOrderMs) / DAY_MS);
    if (daysSince < inactiveDays) continue;

    const avg = stats.totalOrders > 0 ? stats.totalSpent / stats.totalOrders : 0;

    results.push({
      customerId: cust.id,
      name: cust.name,
      phone: cust.phone,
      balance: Number(cust.balance || 0),
      totalOrders: stats.totalOrders,
      totalSpent: Number(stats.totalSpent.toFixed(2)),
      totalSpentFormatted: formatBRL(stats.totalSpent),
      averageTicket: Number(avg.toFixed(2)),
      averageTicketFormatted: formatBRL(avg),
      daysSinceLastPurchase: daysSince,
      lastOrderAt: stats.lastOrderAt,
      lastOrderDescription: stats.lastOrderDescription,
      isVipRecurrent: stats.totalOrders >= 2,
    });
  }

  return results.sort((a, b) => {
    if (a.isVipRecurrent !== b.isVipRecurrent) return a.isVipRecurrent ? -1 : 1;
    if (b.totalSpent !== a.totalSpent) return b.totalSpent - a.totalSpent;
    return b.daysSinceLastPurchase - a.daysSinceLastPurchase;
  });
}

/**
 * Monta mensagem humanizada de reativação para clientes sumidos com cupom opcional.
 */
export function buildReactivationWhatsAppMessage(params: {
  customerName: string;
  storeName: string;
  storeUrl: string;
  lastOrderDescription?: string | null;
  couponCode?: string | null;
  daysSince?: number;
}): string {
  const firstName = (params.customerName || "Cliente").trim().split(" ")[0];
  const lines = [
    `Olá, *${firstName}*! Tudo bem por aí? 😊`,
    `Faz um tempinho (${params.daysSince ? `${params.daysSince} dias` : "algumas semanas"}) que você não passa na *${params.storeName}* e sentimos sua falta!`,
  ];

  if (params.lastOrderDescription) {
    lines.push(
      ``,
      `Seu último pedido com a gente foi: _${params.lastOrderDescription.slice(0, 120)}_.`
    );
  }

  if (params.couponCode && params.couponCode.trim()) {
    lines.push(
      ``,
      `🎁 Preparamos um cupom especial de volta para você usar hoje na vitrine: *${params.couponCode.trim().toUpperCase()}*`
    );
  }

  lines.push(
    ``,
    `👉 Peça de novo em poucos segundos pelo nosso cardápio online:`,
    params.storeUrl
  );

  return lines.join("\n");
}
