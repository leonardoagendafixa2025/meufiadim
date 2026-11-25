"use client";

import React, { useMemo, useState } from "react";
import {
  Clock,
  ChefHat,
  Bike,
  CheckCircle2,
  XCircle,
  PackageCheck,
  RefreshCw,
  MapPin,
  MessageCircle,
  Loader2,
  Tag,
  ShoppingBag,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatBRL } from "@/lib/whatsapp";
import { formatPhoneBR } from "@/lib/customer-auth";
import {
  ORDER_STATUS_META,
  normalizeOrderStatus,
  type OrderStatus,
} from "@/lib/store-features";
import { OrderAlertsBar } from "@/components/admin/OrderAlertsBar";

export interface AdminOrderItem {
  id: string;
  total_amount: number;
  payment_method: string;
  description?: string | null;
  items?: Array<{ id?: string; name?: string; qty: number; price?: number }> | null;
  created_at: string;
  order_status?: string | null;
  delivery_type?: string | null;
  delivery_address?: string | null;
  notes?: string | null;
  coupon_code?: string | null;
  discount_amount?: number;
  loyalty_reward_used?: number;
  customer?: {
    id: string;
    name: string;
    phone: string;
  } | null;
}

interface MerchantOrdersTabProps {
  storeId?: string;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  orders: AdminOrderItem[];
  loading: boolean;
  onRefresh: () => Promise<void> | void;
}

export function MerchantOrdersTab({
  storeId,
  soundEnabled = true,
  onToggleSound,
  orders,
  loading,
  onRefresh,
}: MerchantOrdersTabProps) {
  const [filter, setFilter] = useState<"abertos" | "todos" | "entregues" | "cancelados">("abertos");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const normalizedOrders = useMemo(
    () =>
      orders.map((o) => ({
        ...o,
        resolvedStatus: normalizeOrderStatus(o.order_status),
      })),
    [orders]
  );

  const openCount = normalizedOrders.filter(
    (o) =>
      o.resolvedStatus === "RECEBIDO" ||
      o.resolvedStatus === "EM_PREPARO" ||
      o.resolvedStatus === "SAIU_ENTREGA"
  ).length;

  const filtered = useMemo(() => {
    return normalizedOrders.filter((o) => {
      if (filter === "abertos") {
        return (
          o.resolvedStatus === "RECEBIDO" ||
          o.resolvedStatus === "EM_PREPARO" ||
          o.resolvedStatus === "SAIU_ENTREGA"
        );
      }
      if (filter === "entregues") return o.resolvedStatus === "ENTREGUE";
      if (filter === "cancelados") return o.resolvedStatus === "CANCELADO";
      return true;
    });
  }, [normalizedOrders, filter]);

  async function handleStatusChange(orderId: string, nextStatus: OrderStatus) {
    setUpdatingId(orderId);
    setFeedback(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ status: nextStatus, notifyWhatsapp: true }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Não foi possível atualizar o status.");
      }

      const metaLabel = ORDER_STATUS_META[nextStatus].label;
      setFeedback(
        data.customerNotified
          ? `Status alterado para "${metaLabel}" e cliente notificado no WhatsApp!`
          : `Status alterado para "${metaLabel}".`
      );
      await onRefresh();
    } catch (err: any) {
      alert(err?.message || "Erro ao atualizar status do pedido.");
    } finally {
      setUpdatingId(null);
    }
  }

  function formatTime(iso: string) {
    try {
      return new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  return (
    <div className="space-y-4">
      {storeId && onToggleSound && (
        <OrderAlertsBar
          storeId={storeId}
          soundEnabled={soundEnabled}
          onToggleSound={onToggleSound}
        />
      )}
      {/* Cabeçalho */}
      <div className="bg-white rounded-[32px] p-5 sm:p-6 border border-slate-200/70 shadow-sm shadow-slate-200/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-extrabold text-lg text-slate-900 tracking-tight">
              Pedidos ao Vivo
            </h2>
            {openCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 animate-pulse">
                {openCount} em andamento
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Avance as etapas do pedido para atualizar a vitrine do cliente e avisá-lo no WhatsApp automaticamente.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onRefresh()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs active:scale-[0.98] transition shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Atualizar Fila</span>
        </button>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Filtros */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {(
          [
            { id: "abertos", label: `Em Aberto (${openCount})` },
            { id: "todos", label: `Todos (${normalizedOrders.length})` },
            {
              id: "entregues",
              label: `Entregues (${
                normalizedOrders.filter((o) => o.resolvedStatus === "ENTREGUE").length
              })`,
            },
            {
              id: "cancelados",
              label: `Cancelados (${
                normalizedOrders.filter((o) => o.resolvedStatus === "CANCELADO").length
              })`,
            },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={`px-3.5 py-2 rounded-2xl text-xs font-extrabold whitespace-nowrap transition active:scale-[0.98] ${
              filter === item.id
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Lista de Pedidos */}
      {loading && orders.length === 0 ? (
        <div className="bg-white rounded-[32px] p-10 text-center border border-slate-200/70">
          <Loader2 className="w-7 h-7 animate-spin text-emerald-600 mx-auto mb-2" />
          <p className="text-xs font-bold text-slate-400">Carregando pedidos...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-[32px] p-10 text-center border border-slate-200/70">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
            <ShoppingBag className="w-7 h-7 stroke-[1.75]" />
          </div>
          <h3 className="text-sm font-extrabold text-slate-800">
            Nenhum pedido nesta fila
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Novos pedidos feitos na sua vitrine aparecerão aqui instantaneamente.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filtered.map((order) => {
            const st = order.resolvedStatus;
            const meta = ORDER_STATUS_META[st];
            const isPickup = order.delivery_type === "retirada";
            const statusLabel =
              isPickup && meta.pickupLabel ? meta.pickupLabel : meta.label;
            const isUpdating = updatingId === order.id;

            return (
              <div
                key={order.id}
                className="bg-white rounded-[28px] p-5 border border-slate-200/80 shadow-sm shadow-slate-200/40 space-y-3.5"
              >
                {/* Top */}
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black border ${meta.badgeClass}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${meta.dotClass}`} />
                        {statusLabel}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(order.created_at)}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-extrabold">
                        {order.payment_method}
                      </span>
                    </div>

                    <h3 className="font-extrabold text-sm sm:text-base text-slate-900 mt-1.5">
                      {order.customer?.name || "Venda Direta / Balcão"}
                      {order.customer?.phone && (
                        <span className="ml-2 text-xs font-semibold text-slate-500">
                          ({formatPhoneBR(order.customer.phone)})
                        </span>
                      )}
                    </h3>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">
                      Total
                    </span>
                    <span className="text-lg font-black text-emerald-700">
                      {formatBRL(order.total_amount)}
                    </span>
                  </div>
                </div>

                {/* Itens e detalhes */}
                <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100 space-y-1.5 text-xs">
                  {Array.isArray(order.items) && order.items.length > 0 ? (
                    <div className="space-y-1">
                      {order.items.map((it, idx) => (
                        <div key={idx} className="flex justify-between font-semibold text-slate-700">
                          <span>
                            {it.qty}x {it.name || "Item"}
                          </span>
                          {it.price !== undefined && (
                            <span className="text-slate-500">
                              {formatBRL(Number(it.price) * Number(it.qty || 1))}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="font-semibold text-slate-700">
                      {order.description || "Pedido registrado no sistema"}
                    </p>
                  )}

                  {order.delivery_address && (
                    <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/70 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{order.delivery_address}</span>
                    </p>
                  )}

                  {order.notes && (
                    <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200/70 rounded-xl px-2.5 py-1.5 font-semibold">
                      Obs.: {order.notes}
                    </p>
                  )}

                  {(order.coupon_code || Number(order.discount_amount || 0) > 0) && (
                    <p className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                      <Tag className="w-3 h-3" />
                      Desconto aplicado
                      {order.coupon_code ? ` (${order.coupon_code})` : ""}: -
                      {formatBRL(Number(order.discount_amount || 0) + Number(order.loyalty_reward_used || 0))}
                    </p>
                  )}
                </div>

                {/* Botões de transição de status */}
                {st !== "ENTREGUE" && st !== "CANCELADO" && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {st === "RECEBIDO" && (
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleStatusChange(order.id, "EM_PREPARO")}
                        className="flex-1 min-w-[160px] py-2.5 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition disabled:opacity-50"
                      >
                        {isUpdating ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <ChefHat className="w-4 h-4" />
                        )}
                        <span>Iniciar Preparo</span>
                      </button>
                    )}

                    {(st === "RECEBIDO" || st === "EM_PREPARO") && (
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleStatusChange(order.id, "SAIU_ENTREGA")}
                        className="flex-1 min-w-[160px] py-2.5 px-4 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition disabled:opacity-50"
                      >
                        {isUpdating ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : isPickup ? (
                          <PackageCheck className="w-4 h-4" />
                        ) : (
                          <Bike className="w-4 h-4" />
                        )}
                        <span>
                          {isPickup ? "Pronto p/ Retirada" : "Saiu para Entrega"}
                        </span>
                      </button>
                    )}

                    {st === "SAIU_ENTREGA" && (
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleStatusChange(order.id, "ENTREGUE")}
                        className="flex-1 min-w-[160px] py-2.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition disabled:opacity-50"
                      >
                        {isUpdating ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                        <span>{isPickup ? "Confirmar Retirada" : "Confirmar Entrega"}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => {
                        if (confirm("Deseja realmente cancelar este pedido e avisar o cliente?")) {
                          handleStatusChange(order.id, "CANCELADO");
                        }
                      }}
                      className="py-2.5 px-3.5 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center gap-1.5 active:scale-[0.98] transition disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Cancelar</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
