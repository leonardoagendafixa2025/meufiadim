"use client";

import { useState } from "react";
import {
  CreditCard,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  ShieldAlert,
  Receipt,
  Ban,
  Loader2,
  MessageCircle,
  Lock,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

export interface MerchantChargeItem {
  id: string;
  merchant_id: string;
  description: string;
  reason?: string | null;
  amount: number;
  due_date?: string | null;
  status: "pending" | "paid" | "canceled" | "expired" | "refunded_review";
  order_nsu: string;
  invoice_slug?: string | null;
  transaction_nsu?: string | null;
  checkout_url?: string | null;
  payment_method?: string | null;
  installments?: number | null;
  paid_amount?: number | null;
  receipt_url?: string | null;
  expires_at?: string | null;
  paid_at?: string | null;
  canceled_at?: string | null;
  created_at: string;
}

interface MerchantChargesTabProps {
  charges: MerchantChargeItem[];
  isFinancialBlocked: boolean;
  blockedReason?: string | null;
  onRefresh: () => Promise<void> | void;
}

function formatCents(cents?: number | null) {
  return (Number(cents || 0) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(iso?: string | null) {
  if (!iso) return "Sem vencimento";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function formatDateTime(iso?: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MerchantChargesTab({
  charges,
  isFinancialBlocked,
  blockedReason,
  onRefresh,
}: MerchantChargesTabProps) {
  const [filter, setFilter] = useState<"all" | "pending" | "paid" | "canceled">("all");
  const [payingId, setPayingId] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);

  const pendingCharges = charges.filter(
    (c) => c.status === "pending" || c.status === "expired"
  );
  const paidCharges = charges.filter((c) => c.status === "paid");
  const canceledCharges = charges.filter(
    (c) => c.status === "canceled" || c.status === "refunded_review"
  );

  const visibleCharges =
    filter === "pending"
      ? pendingCharges
      : filter === "paid"
      ? paidCharges
      : filter === "canceled"
      ? canceledCharges
      : charges;

  const getToken = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token || "";
  };

  const handlePayNow = async (chargeId: string) => {
    setPayingId(chargeId);
    try {
      const token = await getToken();
      const res = await fetch("/api/merchant/charges", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: "pay", chargeId }),
      });

      const data = await res.json();
      if (!res.ok || !data.checkout_url) {
        throw new Error(data.error || "Não foi possível obter o link de pagamento.");
      }

      window.location.href = data.checkout_url;
    } catch (err: any) {
      alert("Atenção: " + err.message);
    } finally {
      setPayingId(null);
    }
  };

  const handleCheckStatus = async (chargeId: string) => {
    setCheckingId(chargeId);
    try {
      const token = await getToken();
      const res = await fetch("/api/merchant/charges", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: "check", chargeId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao consultar pagamento.");
      }

      if (data.paid) {
        alert("✅ Pagamento confirmado! Seu acesso está sendo atualizado.");
      } else {
        alert("ℹ️ Pagamento ainda não confirmado pela InfinitePay. Se você acabou de pagar via Pix ou Cartão, aguarde alguns segundos e tente novamente.");
      }
      await onRefresh();
    } catch (err: any) {
      alert("Erro: " + err.message);
    } finally {
      setCheckingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* BANNER OBRIGATÓRIO DE BLOQUEIO POR COBRANÇA PENDENTE */}
      {isFinancialBlocked && (
        <div className="bg-rose-50 border-2 border-rose-200 rounded-3xl p-5 sm:p-6 shadow-md shadow-rose-100 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-rose-900">
                Regularização Financeira Necessária
              </h2>
              <p className="text-xs sm:text-sm font-semibold text-rose-800 mt-1 leading-relaxed">
                {blockedReason ||
                  "Seu acesso está temporariamente bloqueado devido a uma cobrança pendente. Para voltar a utilizar o MEU FIADIM, realize o pagamento abaixo. Após a confirmação, seu acesso será liberado automaticamente."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* CABEÇALHO MINHAS COBRANÇAS */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/70 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-600" />
            Minhas Cobranças
          </h2>
          <p className="text-xs text-slate-500">
            Consulte suas cobranças administrativas, pague com Pix ou Cartão via InfinitePay e acompanhe o histórico.
          </p>
        </div>

        <button
          onClick={() => onRefresh()}
          className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold flex items-center gap-1.5 self-start sm:self-auto transition"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Atualizar Status
        </button>
      </div>

      {/* FILTRO POR SITUAÇÃO */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: "all", label: `Todas (${charges.length})` },
          { id: "pending", label: `Pendentes (${pendingCharges.length})` },
          { id: "paid", label: `Pagas (${paidCharges.length})` },
          { id: "canceled", label: `Canceladas (${canceledCharges.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id as any)}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition ${
              filter === tab.id
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* LISTAGEM */}
      {visibleCharges.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center border border-slate-200/70">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
          <p className="text-sm font-black text-slate-900">Nenhuma cobrança nesta categoria</p>
          <p className="text-xs text-slate-500 mt-1">
            Suas cobranças avulsas e comprovantes aparecerão aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleCharges.map((c) => {
            const isPending = c.status === "pending" || c.status === "expired";
            const isPaid = c.status === "paid";

            return (
              <div
                key={c.id}
                className={`bg-white rounded-3xl p-5 border shadow-xs space-y-3 ${
                  isPending ? "border-amber-200 ring-2 ring-amber-50" : "border-slate-200/80"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {isPaid ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-700">
                          <CheckCircle2 className="w-3 h-3" /> Pago
                        </span>
                      ) : isPending ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-100 text-amber-800">
                          <Clock className="w-3 h-3" /> Aguardando Pagamento
                        </span>
                      ) : c.status === "refunded_review" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-100 text-rose-700">
                          <ShieldAlert className="w-3 h-3" /> Em Análise de Estorno
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-slate-200 text-slate-700">
                          <Ban className="w-3 h-3" /> Cancelada
                        </span>
                      )}

                      {c.payment_method && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 uppercase">
                          {c.payment_method}
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-black text-slate-900">{c.description}</h3>
                    {c.reason && <p className="text-xs text-slate-500">{c.reason}</p>}

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400 pt-1">
                      <span>Vencimento: <strong className="text-slate-600">{formatDate(c.due_date)}</strong></span>
                      <span>Emitida em: {formatDateTime(c.created_at)}</span>
                      {c.paid_at && (
                        <span className="text-emerald-600 font-bold">
                          Pago em: {formatDateTime(c.paid_at)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="sm:text-right">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">
                      Valor
                    </span>
                    <span className="text-xl font-black text-slate-900">
                      {formatCents(c.amount)}
                    </span>
                  </div>
                </div>

                {/* AÇÕES PARA COBRANÇA PENDENTE */}
                {isPending && (
                  <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row gap-2.5">
                    <button
                      onClick={() => handlePayNow(c.id)}
                      disabled={payingId === c.id}
                      className="flex-1 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 active:scale-[0.98] transition disabled:opacity-60"
                    >
                      {payingId === c.id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Preparando Checkout Seguro...</span>
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-4 h-4" />
                          <span>PAGAR AGORA (Pix ou Cartão)</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleCheckStatus(c.id)}
                      disabled={checkingId === c.id}
                      className="py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs flex items-center justify-center gap-1.5 transition"
                    >
                      {checkingId === c.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      <span>Já Paguei / Verificar</span>
                    </button>
                  </div>
                )}

                {isPaid && c.receipt_url && (
                  <div className="pt-2 border-t border-slate-100">
                    <a
                      href={c.receipt_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-600 hover:underline"
                    >
                      <Receipt className="w-4 h-4" /> Ver Comprovante Oficial InfinitePay
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* SUPORTE */}
      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="text-xs text-slate-600">
          <strong className="text-slate-900 block">Dúvidas sobre alguma cobrança?</strong>
          Entre em contato com o suporte oficial do MEU FIADIM.
        </div>
        <a
          href="https://wa.me/5531973149306?text=Ol%C3%A1!%20Preciso%20de%20ajuda%20sobre%20uma%20cobran%C3%A7a%20no%20MEU%20FIADIM."
          target="_blank"
          rel="noreferrer"
          className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 font-extrabold text-xs inline-flex items-center gap-1.5 self-start sm:self-auto"
        >
          <MessageCircle className="w-4 h-4 text-emerald-600" /> Suporte MEU FIADIM
        </a>
      </div>
    </div>
  );
}
