"use client";

import { useEffect, useState } from "react";
import {
  X,
  ShoppingBag,
  Calendar,
  CreditCard,
  Banknote,
  QrCode,
  BookOpen,
  LogOut,
  Clock,
  AlertCircle,
  CheckCircle2,
  Phone,
  RefreshCw,
  Loader2,
  ChefHat,
  Bike,
  Award,
  Tag,
  RotateCcw,
  BellRing,
} from "lucide-react";
import { formatBRL } from "@/lib/whatsapp";
import { formatPhoneBR } from "@/lib/customer-auth";
import {
  getBrowserNotificationPermission,
  isBrowserPushSupported,
  subscribeBrowserPush,
} from "@/lib/push-client";
import {
  ORDER_STATUS_META,
  normalizeOrderStatus,
  type LoyaltyConfig,
} from "@/lib/store-features";
import type { CustomerUser } from "./StoreCustomerAuthModal";

interface Sale {
  id: string;
  store_id: string;
  customer_id: string;
  total_amount: number;
  payment_method: string;
  description?: string;
  items?: any;
  order_status?: string;
  delivery_type?: string | null;
  coupon_code?: string | null;
  discount_amount?: number;
  loyalty_reward_used?: number;
  created_at: string;
}

interface Encomenda {
  id: string;
  description: string;
  quantity: number;
  total_amount: number;
  due_date: string;
  delivery_date?: string;
  status: "PENDENTE" | "PAGA" | "ATRASADA" | "CANCELADA";
  created_at: string;
}

interface StoreCustomerOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: CustomerUser;
  storeId: string;
  storeName: string;
  brandColor?: string;
  onLogout: () => void;
  onNewOrderClick: () => void;
  onRepeatOrder?: (items: Array<{ id?: string; name?: string; qty?: number; price?: number }>) => void;
}

export function StoreCustomerOrdersModal({
  isOpen,
  onClose,
  customer,
  storeId,
  storeName,
  brandColor = "#059669",
  onLogout,
  onNewOrderClick,
  onRepeatOrder,
}: StoreCustomerOrdersModalProps) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [encomendas, setEncomendas] = useState<Encomenda[]>([]);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [loyaltyConfig, setLoyaltyConfig] = useState<LoyaltyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"compras" | "encomendas">("compras");
  const [error, setError] = useState<string | null>(null);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushActive, setPushActive] = useState(false);
  const [enablingPush, setEnablingPush] = useState(false);
  const [pushFeedback, setPushFeedback] = useState<string | null>(null);

  const fetchOrders = async (silent = false) => {
    if (!customer?.id || !storeId) return;
    if (!silent) {
      setLoading(true);
      setError(null);
    }

    try {
      const res = await fetch(
        `/api/store/customer/orders?storeId=${storeId}&customerId=${customer.id}&phone=${customer.phone}`
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Não foi possível carregar o histórico.");
      }

      setSales(data.sales || []);
      setEncomendas(data.encomendas || []);
      if (data.customer?.loyalty_points !== undefined) {
        setLoyaltyPoints(Number(data.customer.loyalty_points || 0));
      }
      if (data.loyaltyConfig) {
        setLoyaltyConfig(data.loyaltyConfig);
      }
    } catch (err: any) {
      if (!silent) {
        setError(err.message || "Erro de conexão ao buscar histórico.");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    const supported = isBrowserPushSupported();
    setPushSupported(supported);
    if (supported && getBrowserNotificationPermission() === "granted" && storeId) {
      try {
        if (localStorage.getItem(`meufiadim_cust_push_${storeId}_${customer?.id}`) === "1") {
          setPushActive(true);
        }
      } catch {}
    }

    if (!isOpen) return;
    fetchOrders(false);

    // Atualização silenciosa em tempo real a cada 12s enquanto o cliente acompanha o pedido
    const timer = setInterval(() => {
      fetchOrders(true);
    }, 12000);

    return () => clearInterval(timer);
  }, [isOpen, customer?.id, storeId]);

  async function handleEnableCustomerPush() {
    if (!storeId || !customer?.id || enablingPush) return;
    setEnablingPush(true);
    setPushFeedback(null);
    try {
      const res = await subscribeBrowserPush({
        storeId,
        role: "customer",
        customerId: customer.id,
      });
      if (res.ok) {
        setPushActive(true);
        try {
          localStorage.setItem(`meufiadim_cust_push_${storeId}_${customer.id}`, "1");
        } catch {}
        setPushFeedback("Avisos ativados! Você receberá alertas quando seu pedido avançar.");
      } else {
        setPushFeedback(res.reason || "Não foi possível ativar notificações neste navegador.");
      }
    } finally {
      setEnablingPush(false);
    }
  }

  if (!isOpen) return null;

  const initials = customer.name
    ? customer.name
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
    : "CL";

  const totalSpent = sales.reduce((acc, s) => acc + Number(s.total_amount || 0), 0);

  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  const formatDateSimple = (dateStr?: string | null) => {
    if (!dateStr) return "-";
    const [y, m, d] = dateStr.split("-");
    if (y && m && d) return `${d}/${m}/${y}`;
    return dateStr;
  };

  const getPaymentIcon = (method: string) => {
    const norm = (method || "").toLowerCase();
    if (norm.includes("pix")) return <QrCode className="w-3.5 h-3.5 text-teal-600" />;
    if (norm.includes("fiado")) return <BookOpen className="w-3.5 h-3.5 text-amber-600" />;
    if (
      norm.includes("cartão") ||
      norm.includes("cartao") ||
      norm.includes("crédito") ||
      norm.includes("debito")
    ) {
      return <CreditCard className="w-3.5 h-3.5 text-blue-600" />;
    }
    return <Banknote className="w-3.5 h-3.5 text-emerald-600" />;
  };

  const renderOrderTimeline = (sale: Sale) => {
    const status = normalizeOrderStatus(sale.order_status);
    const meta = ORDER_STATUS_META[status];
    const isPickup = sale.delivery_type === "retirada";

    if (status === "CANCELADO") {
      return (
        <div className="mt-3 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200/80 dark:border-rose-800/60 text-[11px] font-bold text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Pedido cancelado pela loja</span>
        </div>
      );
    }

    const steps = [
      { step: 1, label: "Recebido", icon: CheckCircle2 },
      { step: 2, label: "Preparo", icon: ChefHat },
      { step: 3, label: isPickup ? "Retirar" : "A caminho", icon: Bike },
      { step: 4, label: isPickup ? "Retirado" : "Entregue", icon: ShoppingBag },
    ];

    return (
      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between gap-1">
          {steps.map((s) => {
            const Icon = s.icon;
            const reached = meta.step >= s.step;
            const current = meta.step === s.step && meta.step < 4;
            return (
              <div key={s.step} className="flex-1 flex flex-col items-center text-center gap-1">
                <div
                  style={reached ? { backgroundColor: brandColor } : undefined}
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                    reached
                      ? `text-white shadow-xs ${current ? "ring-4 ring-emerald-400/30 animate-pulse" : ""}`
                      : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span
                  className={`text-[9px] font-extrabold leading-tight ${
                    reached ? "text-slate-800 dark:text-slate-100" : "text-slate-400"
                  }`}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full sm:max-w-xl bg-white dark:bg-slate-900 rounded-t-[32px] sm:rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh] animate-in slide-in-from-bottom-6 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* CABEÇALHO DO PERFIL */}
        <div className="p-5 sm:p-6 bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3.5">
              <div
                style={{ backgroundColor: `${brandColor}20`, color: brandColor }}
                className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-xs"
              >
                {initials}
              </div>

              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
                  {customer.name}
                </h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-400" />
                    {formatPhoneBR(customer.phone)}
                  </span>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <span className="text-[11px] font-bold text-slate-400">{storeName}</span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              aria-label="Fechar"
              className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center shadow-xs transition active:scale-95"
            >
              <X className="w-4 h-4 stroke-[2]" />
            </button>
          </div>

          {/* CARDS RESUMO DO CLIENTE */}
          <div className="grid grid-cols-2 gap-2.5 mt-4">
            <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Total de Pedidos
              </span>
              <p className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                {sales.length} {sales.length === 1 ? "compra" : "compras"}
              </p>
              <p className="text-[10px] font-semibold text-slate-400">
                Acumulado: {formatBRL(totalSpent)}
              </p>
            </div>

            <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Saldo no Fiado
              </span>
              {Number(customer.balance || 0) > 0 ? (
                <>
                  <p className="text-base font-black text-amber-600 dark:text-amber-400 mt-0.5">
                    {formatBRL(customer.balance)}
                  </p>
                  <p className="text-[10px] font-semibold text-amber-500">
                    Aguardando acerto
                  </p>
                </>
              ) : (
                <>
                  <p className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                    R$ 0,00
                  </p>
                  <p className="text-[10px] font-semibold text-emerald-500">
                    Contas em dia ✅
                  </p>
                </>
              )}
            </div>
          </div>

          {/* CARTÃO FIDELIDADE DIGITAL */}
          {loyaltyConfig?.enabled && (
            <div className="mt-3 p-3.5 rounded-2xl bg-gradient-to-r from-amber-50 to-emerald-50 dark:from-amber-950/30 dark:to-emerald-950/30 border border-amber-200/70 dark:border-amber-800/50 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-500" />
                  Cartão Fidelidade ({loyaltyPoints}/{loyaltyConfig.targetOrders})
                </span>
                <span className="text-[11px] font-extrabold text-emerald-700 dark:text-emerald-300">
                  Prêmio: {formatBRL(loyaltyConfig.rewardAmount)}
                </span>
              </div>
              <div className="h-2 bg-white/80 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  style={{
                    width: `${Math.min(100, (loyaltyPoints / Math.max(1, loyaltyConfig.targetOrders)) * 100)}%`,
                    backgroundColor: brandColor,
                  }}
                  className="h-full rounded-full transition-all duration-300"
                />
              </div>
              <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                {loyaltyPoints >= loyaltyConfig.targetOrders
                  ? `🎉 Prêmio liberado! Ative seu desconto de ${formatBRL(loyaltyConfig.rewardAmount)} ao fechar seu próximo pedido na sacola.`
                  : `Faltam ${loyaltyConfig.targetOrders - loyaltyPoints} pedido(s) para ganhar ${formatBRL(loyaltyConfig.rewardAmount)} de desconto!`}
              </p>
            </div>
          )}
        </div>

        {/* SELETOR DE ABAS + AVISOS PUSH */}
        <div className="px-5 sm:px-6 pt-3 pb-2 border-b border-slate-100 dark:border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab("compras")}
                className={`px-3 py-1.5 text-xs font-black rounded-xl transition-all ${
                  activeTab === "compras"
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                }`}
              >
                Pedidos ao Vivo ({sales.length})
              </button>
              <button
                onClick={() => setActiveTab("encomendas")}
                className={`px-3 py-1.5 text-xs font-black rounded-xl transition-all ${
                  activeTab === "encomendas"
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                }`}
              >
                Encomendas ({encomendas.length})
              </button>
            </div>

            <button
              onClick={() => fetchOrders(false)}
              disabled={loading}
              title="Atualizar histórico"
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition rounded-lg"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {pushSupported && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/70 text-[11px]">
              <span className="font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <BellRing className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                {pushActive
                  ? "Avisos em tempo real ativos neste aparelho"
                  : "Receba push na tela quando seu pedido sair"}
              </span>
              <button
                type="button"
                disabled={enablingPush || pushActive}
                onClick={handleEnableCustomerPush}
                className={`px-2.5 py-1 rounded-xl font-extrabold text-[11px] transition active:scale-95 ${
                  pushActive
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-slate-900 text-white hover:bg-slate-800 dark:bg-emerald-600"
                }`}
              >
                {enablingPush ? "Ativando..." : pushActive ? "Ativado ✓" : "Ativar Avisos"}
              </button>
            </div>
          )}

          {pushFeedback && (
            <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
              {pushFeedback}
            </p>
          )}
        </div>

        {/* LISTAGEM DE ITENS */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-3">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-2" />
              <p className="text-xs font-bold text-slate-400">
                Buscando seu histórico de compras...
              </p>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 rounded-2xl text-center text-xs font-semibold text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-6 h-6 text-rose-500 mx-auto mb-1.5" />
              <p>{error}</p>
              <button
                onClick={() => fetchOrders(false)}
                className="mt-2 text-xs font-bold underline"
              >
                Tentar novamente
              </button>
            </div>
          ) : activeTab === "compras" ? (
            sales.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
                  <ShoppingBag className="w-7 h-7 stroke-[1.5]" />
                </div>
                <h3 className="text-sm font-black text-slate-800 dark:text-white">
                  Nenhuma compra registrada ainda
                </h3>
                <p className="text-xs text-slate-400 max-w-xs mt-1">
                  Seus pedidos realizados na vitrine desta loja aparecerão aqui com acompanhamento ao vivo.
                </p>
                <button
                  onClick={() => {
                    onClose();
                    onNewOrderClick();
                  }}
                  style={{ backgroundColor: brandColor }}
                  className="mt-4 px-4 py-2.5 rounded-xl text-white font-bold text-xs shadow-md shadow-black/10 active:scale-95 transition"
                >
                  Ver Cardápio e Pedir
                </button>
              </div>
            ) : (
              sales.map((sale) => {
                const st = normalizeOrderStatus(sale.order_status);
                const meta = ORDER_STATUS_META[st];
                const isPickup = sale.delivery_type === "retirada";
                const statusLabel =
                  isPickup && meta.pickupLabel ? meta.pickupLabel : meta.label;

                return (
                  <div
                    key={sale.id}
                    className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:border-slate-200 dark:hover:border-slate-700 transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {formatDateTime(sale.created_at)}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {getPaymentIcon(sale.payment_method)}
                            {sale.payment_method}
                          </span>
                        </div>

                        <p className="text-xs font-bold text-slate-800 dark:text-slate-100 mt-2 line-clamp-2">
                          {sale.description || "Pedido realizado na vitrine"}
                        </p>

                        {Array.isArray(sale.items) && sale.items.length > 0 && (
                          <div className="mt-2 space-y-0.5 pl-2 border-l-2 border-slate-100 dark:border-slate-800">
                            {sale.items.map((item: any, idx: number) => (
                              <div
                                key={idx}
                                className="text-[11px] text-slate-500 dark:text-slate-400 flex justify-between gap-3"
                              >
                                <span>
                                  {item.qty}x {item.name || item.product?.name || "Item"}
                                </span>
                                {item.price && (
                                  <span className="font-semibold">
                                    {formatBRL(item.price * item.qty)}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {(sale.coupon_code || Number(sale.discount_amount || 0) > 0 || Number(sale.loyalty_reward_used || 0) > 0) && (
                          <p className="mt-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <Tag className="w-3 h-3" />
                            Economizou{" "}
                            {formatBRL(
                              Number(sale.discount_amount || 0) +
                                Number(sale.loyalty_reward_used || 0)
                            )}
                            {sale.coupon_code ? ` (${sale.coupon_code})` : ""}
                          </p>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                          Valor
                        </span>
                        <span
                          style={{ color: brandColor }}
                          className="text-base font-black tracking-tight"
                        >
                          {formatBRL(sale.total_amount)}
                        </span>
                        <span
                          className={`block text-[9px] font-extrabold border px-1.5 py-0.5 rounded-md mt-1 ${meta.badgeClass}`}
                        >
                          {statusLabel}
                        </span>
                      </div>
                    </div>

                    {renderOrderTimeline(sale)}

                    {Array.isArray(sale.items) &&
                      sale.items.length > 0 &&
                      onRepeatOrder && (
                        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              onRepeatOrder(sale.items);
                              onClose();
                            }}
                            style={{ borderColor: `${brandColor}40`, color: brandColor }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 font-extrabold text-xs shadow-xs active:scale-95 transition"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Pedir de Novo</span>
                          </button>
                        </div>
                      )}
                  </div>
                );
              })
            )
          ) : encomendas.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
                <Calendar className="w-7 h-7 stroke-[1.5]" />
              </div>
              <h3 className="text-sm font-black text-slate-800 dark:text-white">
                Nenhuma encomenda programada
              </h3>
              <p className="text-xs text-slate-400 max-w-xs mt-1">
                Encomendas antecipadas cadastradas pelo comerciante com data combinada de pagamento aparecerão aqui.
              </p>
            </div>
          ) : (
            encomendas.map((enc) => {
              const isPaid = enc.status === "PAGA";
              const isLate = enc.status === "ATRASADA";

              return (
                <div
                  key={enc.id}
                  className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            isPaid
                              ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200"
                              : isLate
                              ? "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200"
                              : "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200"
                          }`}
                        >
                          {enc.status}
                        </span>
                        <span className="text-xs font-semibold text-slate-400">
                          {enc.quantity}x
                        </span>
                      </div>

                      <p className="text-xs font-black text-slate-900 dark:text-white mt-1.5">
                        {enc.description}
                      </p>

                      <div className="mt-2 space-y-0.5 text-[11px] text-slate-500">
                        {enc.delivery_date && (
                          <p>
                            🚚 Entrega prevista:{" "}
                            <strong>{formatDateSimple(enc.delivery_date)}</strong>
                          </p>
                        )}
                        <p>
                          📅 Pagamento combinado:{" "}
                          <strong className={isLate ? "text-rose-600 font-bold" : ""}>
                            {formatDateSimple(enc.due_date)}
                          </strong>
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                        Total
                      </span>
                      <span className="text-base font-black text-slate-900 dark:text-white">
                        {formatBRL(enc.total_amount)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* RODAPÉ DO MODAL */}
        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <button
            onClick={onLogout}
            className="py-2.5 px-3 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 font-bold text-xs flex items-center gap-1.5 transition active:scale-95"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sair desta conta</span>
          </button>

          <button
            onClick={() => {
              onClose();
              onNewOrderClick();
            }}
            style={{ backgroundColor: brandColor }}
            className="py-2.5 px-5 rounded-xl text-white font-black text-xs shadow-md shadow-black/10 hover:opacity-95 active:scale-95 transition"
          >
            Fazer Novo Pedido
          </button>
        </div>
      </div>
    </div>
  );
}
