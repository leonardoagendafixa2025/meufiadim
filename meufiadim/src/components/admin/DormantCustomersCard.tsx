"use client";

import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  MessageCircle,
  Sparkles,
  Tag,
  UserCheck,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { DormantCustomerCandidate } from "@/lib/crm-radar";
import type { StoreCoupon } from "@/lib/store-features";

export function DormantCustomersCard() {
  const [inactiveDays, setInactiveDays] = useState<number>(21);
  const [candidates, setCandidates] = useState<DormantCustomerCandidate[]>([]);
  const [reactivatedAt, setReactivatedAt] = useState<Record<string, string>>({});
  const [coupons, setCoupons] = useState<StoreCoupon[]>([]);
  const [selectedCoupon, setSelectedCoupon] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    text: string;
    fallbackUrl?: string;
    isError?: boolean;
  } | null>(null);

  async function loadRadar(days = inactiveDays) {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const [radarRes, promoRes] = await Promise.all([
        fetch(`/api/crm/reactivate?inactiveDays=${days}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        fetch("/api/store/promotions", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
      ]);

      const radarData = await radarRes.json();
      if (radarRes.ok && radarData.ok) {
        setCandidates(radarData.dormantCustomers || []);
        setReactivatedAt(radarData.reactivatedAt || {});
      }

      const promoData = await promoRes.json().catch(() => null);
      if (promoRes.ok && promoData?.ok && Array.isArray(promoData.coupons)) {
        const active = promoData.coupons.filter((c: StoreCoupon) => c.active);
        setCoupons(active);
      }
    } catch {
      // ignora silenciosamente
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRadar(inactiveDays);
  }, [inactiveDays]);

  async function handleReactivate(customer: DormantCustomerCandidate) {
    setSendingId(customer.customerId);
    setFeedback(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch("/api/crm/reactivate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          customerId: customer.customerId,
          couponCode: selectedCoupon || null,
        }),
      });

      const data = await res.json();
      if (data.reactivatedAt) {
        setReactivatedAt((prev) => ({
          ...prev,
          [customer.customerId]: data.reactivatedAt,
        }));
      }

      if (data.ok && data.sent) {
        setFeedback({
          text: `Convite de retorno enviado no WhatsApp para ${customer.name}${
            selectedCoupon ? ` com o cupom ${selectedCoupon}` : ""
          }!`,
        });
      } else {
        setFeedback({
          text:
            data.error ||
            `WhatsApp central offline no momento. Clique ao lado para abrir a conversa pronta com ${customer.name}.`,
          fallbackUrl: data.fallbackUrl,
          isError: true,
        });
      }
    } catch (err: any) {
      setFeedback({
        text: err?.message || "Erro ao enviar mensagem de reativação.",
        isError: true,
      });
    } finally {
      setSendingId(null);
    }
  }

  return (
    <div className="bg-white rounded-[32px] p-5 sm:p-6 border border-slate-200/70 shadow-sm shadow-slate-200/40 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-extrabold text-base sm:text-lg text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Radar de Clientes Sumidos (CRM IA)
            </h2>
            {!loading && candidates.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                {candidates.length} para reativar
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Encontre quem já comprou com você e está sem pedir há alguns dias para trazer de volta com 1 toque no WhatsApp.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl">
            {[15, 21, 30, 45].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setInactiveDays(days)}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold transition ${
                  inactiveDays === days
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                +{days}d
              </button>
            ))}
          </div>

          {coupons.length > 0 && (
            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-2xl px-2.5 py-1.5">
              <Tag className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <select
                value={selectedCoupon}
                onChange={(e) => setSelectedCoupon(e.target.value)}
                aria-label="Cupom de retorno opcional"
                className="bg-transparent text-[11px] font-extrabold text-emerald-900 outline-none"
              >
                <option value="">Sem cupom extra</option>
                {coupons.map((c) => (
                  <option key={c.id} value={c.code}>
                    Cupom {c.code}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-bold flex flex-wrap items-center justify-between gap-2 ${
            feedback.isError
              ? "bg-amber-50 border-amber-200 text-amber-900"
              : "bg-emerald-50 border-emerald-200 text-emerald-900"
          }`}
        >
          <span>{feedback.text}</span>
          {feedback.fallbackUrl && (
            <a
              href={feedback.fallbackUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-extrabold text-[11px] hover:bg-emerald-700 transition"
            >
              <span>Abrir WhatsApp</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

      {loading ? (
        <div className="py-8 flex items-center justify-center gap-2 text-xs font-bold text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
          <span>Analisando histórico de compras...</span>
        </div>
      ) : candidates.length === 0 ? (
        <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 text-xs font-bold text-emerald-800 flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            Ótimo sinal! Nenhum cliente está sumido há mais de {inactiveDays} dias.
          </span>
        </div>
      ) : (
        <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
          {candidates.slice(0, 15).map((cust) => {
            const lastSentIso = reactivatedAt[cust.customerId];
            const sentRecently = Boolean(
              lastSentIso &&
                Date.now() - new Date(lastSentIso).getTime() < 7 * 24 * 60 * 60 * 1000
            );
            const isSending = sendingId === cust.customerId;

            return (
              <div
                key={cust.customerId}
                className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 border border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-extrabold text-sm text-slate-900 truncate">
                      {cust.name}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                      <Clock className="w-3 h-3" />
                      {cust.daysSinceLastPurchase}d sem pedir
                    </span>
                    {cust.isVipRecurrent && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Recorrente ({cust.totalOrders}x)
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium truncate">
                    Último pedido: <strong>{cust.lastOrderDescription}</strong> • Total na loja:{" "}
                    <strong className="text-slate-700">{cust.totalSpentFormatted}</strong>
                  </p>
                </div>

                <button
                  type="button"
                  disabled={isSending}
                  onClick={() => handleReactivate(cust)}
                  className={`inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-extrabold transition active:scale-[0.98] shrink-0 min-h-[42px] ${
                    sentRecently
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
                      : "bg-slate-900 hover:bg-slate-800 text-white shadow-sm"
                  }`}
                >
                  {isSending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : sentRecently ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  <span>
                    {isSending
                      ? "Enviando..."
                      : sentRecently
                      ? "Convidado (< 7d)"
                      : "Reativar no Zap"}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
