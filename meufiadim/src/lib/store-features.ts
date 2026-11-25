export type OrderStatus =
  | "RECEBIDO"
  | "EM_PREPARO"
  | "SAIU_ENTREGA"
  | "ENTREGUE"
  | "CANCELADO";

export const VALID_ORDER_STATUSES: OrderStatus[] = [
  "RECEBIDO",
  "EM_PREPARO",
  "SAIU_ENTREGA",
  "ENTREGUE",
  "CANCELADO",
];

export const ORDER_STATUS_META: Record<
  OrderStatus,
  {
    label: string;
    pickupLabel?: string;
    step: number;
    badgeClass: string;
    dotClass: string;
  }
> = {
  RECEBIDO: {
    label: "Pedido Recebido",
    step: 1,
    badgeClass: "bg-sky-50 text-sky-700 border-sky-200",
    dotClass: "bg-sky-500",
  },
  EM_PREPARO: {
    label: "Em Preparo",
    step: 2,
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
    dotClass: "bg-amber-500",
  },
  SAIU_ENTREGA: {
    label: "Saiu para Entrega",
    pickupLabel: "Pronto p/ Retirada",
    step: 3,
    badgeClass: "bg-purple-50 text-purple-700 border-purple-200",
    dotClass: "bg-purple-500",
  },
  ENTREGUE: {
    label: "Entregue",
    pickupLabel: "Retirado",
    step: 4,
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dotClass: "bg-emerald-500",
  },
  CANCELADO: {
    label: "Cancelado",
    step: 0,
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
    dotClass: "bg-rose-500",
  },
};

export function normalizeOrderStatus(status?: string | null): OrderStatus {
  const upper = String(status || "RECEBIDO").toUpperCase().trim() as OrderStatus;
  if (VALID_ORDER_STATUSES.includes(upper)) return upper;
  return "RECEBIDO";
}

export function buildOrderStatusWhatsAppMessage(params: {
  customerName: string;
  storeName: string;
  status: OrderStatus;
  deliveryType?: string | null;
  totalAmount?: number;
}): string {
  const firstName = (params.customerName || "Cliente").split(" ")[0];
  const isPickup = params.deliveryType === "retirada";

  switch (params.status) {
    case "RECEBIDO":
      return `Olá, *${firstName}*! Seu pedido na *${params.storeName}* foi recebido e já está na fila. ✅`;
    case "EM_PREPARO":
      return `👩‍🍳 Olá, *${firstName}*!\n\nSeu pedido na *${params.storeName}* já está *EM PREPARO*! Em breve teremos novidades por aqui.`;
    case "SAIU_ENTREGA":
      return isPickup
        ? `🛍️ Olá, *${firstName}*!\n\nBoas notícias: seu pedido na *${params.storeName}* já está *PRONTO PARA RETIRADA* no balcão!`
        : `🛵 Olá, *${firstName}*!\n\nSeu pedido na *${params.storeName}* *SAIU PARA ENTREGA*! Fique atento(a) ao telefone/campainha.`;
    case "ENTREGUE":
      return `🎉 Pedido *concluído* na *${params.storeName}*, ${firstName}!\n\nMuito obrigado pela preferência. Conte sempre com a gente!`;
    case "CANCELADO":
      return `⚠️ Olá, *${firstName}*.\n\nInformamos que seu pedido na *${params.storeName}* foi *cancelado*. Caso tenha dúvidas, responda esta mensagem para falar com a loja.`;
  }
}

export interface FiadoBillingConfig {
  enabled: boolean;
  remindBeforeDays: number;
  remindOnDueDate: boolean;
  remindOverdueDays: number;
}

export const DEFAULT_FIADO_BILLING_CONFIG: FiadoBillingConfig = {
  enabled: false,
  remindBeforeDays: 1,
  remindOnDueDate: true,
  remindOverdueDays: 3,
};

export interface StoreCoupon {
  id: string;
  code: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  minOrder: number;
  active: boolean;
  usesCount: number;
  createdAt?: string;
}

export interface LoyaltyConfig {
  enabled: boolean;
  targetOrders: number;
  rewardAmount: number;
}

export const DEFAULT_LOYALTY_CONFIG: LoyaltyConfig = {
  enabled: false,
  targetOrders: 10,
  rewardAmount: 15,
};

/**
 * Calcula descontos de cupom e fidelidade com total segurança determinística.
 * Nunca permite que o desconto ultrapasse o subtotal dos produtos.
 */
export function computeOrderDiscounts(params: {
  subtotal: number;
  freightFee: number;
  coupon?: StoreCoupon | null;
  loyaltyConfig?: LoyaltyConfig | null;
  customerPoints?: number;
  redeemLoyalty?: boolean;
}) {
  const subtotal = Math.max(0, Number(params.subtotal || 0));
  const freightFee = Math.max(0, Number(params.freightFee || 0));
  let couponDiscount = 0;
  let couponError: string | null = null;
  let appliedCouponCode: string | null = null;

  if (params.coupon) {
    const c = params.coupon;
    if (!c.active) {
      couponError = "Este cupom está pausado no momento.";
    } else if (subtotal < Number(c.minOrder || 0)) {
      couponError = `Este cupom exige compra mínima de R$ ${Number(c.minOrder).toFixed(2).replace(".", ",")} em produtos.`;
    } else {
      const raw =
        c.discountType === "percent"
          ? (subtotal * Number(c.discountValue || 0)) / 100
          : Number(c.discountValue || 0);
      couponDiscount = Number(Math.min(subtotal, Math.max(0, raw)).toFixed(2));
      appliedCouponCode = c.code.toUpperCase();
    }
  }

  let loyaltyRewardUsed = 0;
  let pointsRedeemed = 0;
  const lc = params.loyaltyConfig;
  const pts = Math.max(0, Math.floor(Number(params.customerPoints || 0)));

  if (params.redeemLoyalty && lc?.enabled && pts >= lc.targetOrders) {
    const remainingSubtotal = Math.max(0, subtotal - couponDiscount);
    loyaltyRewardUsed = Number(
      Math.min(remainingSubtotal, Math.max(0, Number(lc.rewardAmount || 0))).toFixed(2)
    );
    if (loyaltyRewardUsed > 0) {
      pointsRedeemed = lc.targetOrders;
    }
  }

  const totalDiscount = Number((couponDiscount + loyaltyRewardUsed).toFixed(2));
  const finalTotal = Number(Math.max(0, subtotal - totalDiscount + freightFee).toFixed(2));

  return {
    subtotal,
    freightFee,
    couponDiscount,
    appliedCouponCode,
    couponError,
    loyaltyRewardUsed,
    pointsRedeemed,
    totalDiscount,
    finalTotal,
  };
}
