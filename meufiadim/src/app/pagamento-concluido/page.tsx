"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  Loader2,
  Receipt,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

function PagamentoConcluidoContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const orderNsu = searchParams.get("order_nsu") || "";
  const slug = searchParams.get("slug") || searchParams.get("invoice_slug") || "";
  const transactionNsu = searchParams.get("transaction_nsu") || "";

  const [status, setStatus] = useState<"checking" | "paid" | "pending" | "error">("checking");
  const [message, setMessage] = useState("Consultando confirmação oficial na InfinitePay...");
  const [chargeData, setChargeData] = useState<any>(null);
  const [accessUnlocked, setAccessUnlocked] = useState<boolean>(false);
  const [attempts, setAttempts] = useState(0);

  const verifyOfficialPayment = async () => {
    setStatus((prev) => (prev === "paid" ? "paid" : "checking"));
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setStatus("error");
        setMessage(
          "Faça login no painel do lojista para validar e acompanhar o status oficial do seu pagamento."
        );
        return;
      }

      if (!orderNsu) {
        setStatus("error");
        setMessage("Identificador do pedido (order_nsu) não encontrado na URL de retorno.");
        return;
      }

      const res = await fetch("/api/merchant/charges", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: "check",
          orderNsu,
          slug: slug || undefined,
          transactionNsu: transactionNsu || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao consultar pagamento.");
      }

      setChargeData(data.charge || null);
      if (data.access?.allowed) {
        setAccessUnlocked(true);
      }

      if (data.paid) {
        setStatus("paid");
        setMessage(
          data.access?.allowed
            ? "Pagamento confirmado oficialmente! Seu acesso operacional ao MEU FIADIM já foi liberado automaticamente."
            : "Pagamento desta cobrança confirmado oficialmente! Verifique se há outras pendências no seu painel."
        );
      } else {
        setStatus("pending");
        setMessage(
          "Seu pagamento ainda está aguardando confirmação oficial da InfinitePay. Caso tenha acabado de pagar, aguarde alguns instantes e clique em Atualizar."
        );
      }
    } catch (err: any) {
      setStatus("error");
      setMessage(err.message || "Não foi possível consultar o status do pagamento agora.");
    }
  };

  useEffect(() => {
    verifyOfficialPayment();
  }, [orderNsu, slug, transactionNsu]);

  // Atualização automática enquanto estiver pendente (máx 6 ciclos de 5s)
  useEffect(() => {
    if (status !== "pending" || attempts >= 6) return;
    const timer = setTimeout(() => {
      setAttempts((a) => a + 1);
      verifyOfficialPayment();
    }, 5000);
    return () => clearTimeout(timer);
  }, [status, attempts]);

  const formatCents = (cents?: number) =>
    (Number(cents || 0) / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-[32px] border border-slate-200/80 shadow-xl p-6 sm:p-8 text-center space-y-5">
        {status === "checking" && (
          <div className="w-16 h-16 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mx-auto">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        )}

        {status === "paid" && (
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-9 h-9" />
          </div>
        )}

        {status === "pending" && (
          <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
            <Clock className="w-8 h-8" />
          </div>
        )}

        {status === "error" && (
          <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8" />
          </div>
        )}

        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-slate-100 text-slate-600">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Validação Oficial InfinitePay
          </span>
          <h1 className="text-xl font-black text-slate-900">
            {status === "paid"
              ? "Pagamento Confirmado!"
              : status === "pending"
              ? "Pagamento em Processamento"
              : status === "checking"
              ? "Verificando Pagamento..."
              : "Atenção na Conferência"}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
            {message}
          </p>
        </div>

        {chargeData && (
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-left space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Descrição:</span>
              <strong className="text-slate-900">{chargeData.description}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Valor:</span>
              <strong className="text-slate-900">{formatCents(chargeData.amount)}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Referência:</span>
              <strong className="text-slate-700">{chargeData.order_nsu}</strong>
            </div>
            {chargeData.receipt_url && (
              <div className="pt-2 border-t border-slate-200">
                <a
                  href={chargeData.receipt_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-emerald-600 font-extrabold hover:underline"
                >
                  <Receipt className="w-4 h-4" /> Abrir Comprovante Oficial
                </a>
              </div>
            )}
          </div>
        )}

        <div className="space-y-2.5 pt-1">
          {status !== "paid" && (
            <button
              onClick={verifyOfficialPayment}
              disabled={status === "checking"}
              className="w-full py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${status === "checking" ? "animate-spin" : ""}`} />
              <span>Atualizar Status Oficial</span>
            </button>
          )}

          <button
            onClick={() => router.push("/admin")}
            className={`w-full py-3 px-4 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition ${
              accessUnlocked || status === "paid"
                ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700"
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para o Painel do Lojista</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PagamentoConcluidoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      }
    >
      <PagamentoConcluidoContent />
    </Suspense>
  );
}
