"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CreditCard,
  Plus,
  Search,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  XCircle,
  MessageCircle,
  Download,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  FileText,
  Eye,
  X,
  Loader2,
  Receipt,
  Ban,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface StoreItem {
  id: string;
  name: string;
  slug: string;
  whatsapp: string;
  status: "active" | "blocked";
  admin_blocked?: boolean;
  financial_blocked?: boolean;
  regularized_at?: string | null;
}

interface MerchantCharge {
  id: string;
  merchant_id: string;
  description: string;
  reason?: string | null;
  admin_notes?: string | null;
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
  net_amount?: number | null;
  fee_amount?: number | null;
  receipt_url?: string | null;
  expires_at?: string | null;
  paid_at?: string | null;
  canceled_at?: string | null;
  created_at: string;
  stores?: StoreItem;
}

interface ChargeAttempt {
  id: string;
  charge_id: string;
  order_nsu: string;
  invoice_slug?: string | null;
  checkout_url?: string | null;
  status: string;
  expires_at?: string | null;
  created_at: string;
}

interface AuditEvent {
  id: string;
  charge_id?: string | null;
  event_type: string;
  order_nsu?: string | null;
  source: string;
  verified: boolean;
  created_at: string;
}

interface FinancialMetrics {
  totalReceivedCents: number;
  totalPaidByBuyersCents: number;
  totalFeeCents: number;
  totalPendingCents: number;
  totalRefundReviewCents: number;
  totalChargesCount: number;
  paidCount: number;
  pendingCount: number;
  canceledCount: number;
  blockedMerchantsCount: number;
  regularizedMerchantsCount: number;
}

interface SuperAdminChargesTabProps {
  stores: StoreItem[];
  onRefreshStores: () => void;
}

function formatCents(cents?: number | null) {
  return (Number(cents || 0) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
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

function formatDateOnly(iso?: string | null) {
  if (!iso) return "Sem vencimento";
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function SuperAdminChargesTab({
  stores,
  onRefreshStores,
}: SuperAdminChargesTabProps) {
  const [charges, setCharges] = useState<MerchantCharge[]>([]);
  const [attempts, setAttempts] = useState<ChargeAttempt[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [metrics, setMetrics] = useState<FinancialMetrics>({
    totalReceivedCents: 0,
    totalPaidByBuyersCents: 0,
    totalFeeCents: 0,
    totalPendingCents: 0,
    totalRefundReviewCents: 0,
    totalChargesCount: 0,
    paidCount: 0,
    pendingCount: 0,
    canceledCount: 0,
    blockedMerchantsCount: 0,
    regularizedMerchantsCount: 0,
  });

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Modal de Nova Cobrança + Confirmação
  const [createOpen, setCreateOpen] = useState(false);
  const [merchantSearch, setMerchantSearch] = useState("");
  const [selectedMerchantId, setSelectedMerchantId] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [descriptionInput, setDescriptionInput] = useState("");
  const [reasonInput, setReasonInput] = useState("");
  const [dueDateInput, setDueDateInput] = useState("");
  const [adminNotesInput, setAdminNotesInput] = useState("");
  const [confirmStep, setConfirmStep] = useState(false);
  const [creating, setCreating] = useState(false);

  // Modal de Detalhes / Auditoria
  const [selectedCharge, setSelectedCharge] = useState<MerchantCharge | null>(null);
  const [editingNotes, setEditingNotes] = useState("");

  // Filtros
  const [filterMerchant, setFilterMerchant] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterMethod, setFilterMethod] = useState("all");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterMinValue, setFilterMinValue] = useState("");

  const getToken = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token || "";
  };

  const loadCharges = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const token = await getToken();
      const res = await fetch("/api/superadmin/charges", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao carregar cobranças.");
      }
      setCharges(data.charges || []);
      setAttempts(data.attempts || []);
      setEvents(data.events || []);
      if (data.metrics) setMetrics(data.metrics);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCharges();
  }, []);

  const filteredStoresForSelect = useMemo(() => {
    const q = merchantSearch.toLowerCase().trim();
    if (!q) return stores;
    return stores.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.slug.toLowerCase().includes(q) ||
        (s.whatsapp || "").includes(q)
    );
  }, [stores, merchantSearch]);

  const filteredCharges = useMemo(() => {
    return charges.filter((c) => {
      if (filterMerchant !== "all" && c.merchant_id !== filterMerchant) return false;
      if (filterStatus !== "all" && c.status !== filterStatus) return false;
      if (filterMethod !== "all") {
        const pm = (c.payment_method || "").toLowerCase();
        if (!pm.includes(filterMethod.toLowerCase())) return false;
      }
      if (filterStartDate) {
        if (new Date(c.created_at) < new Date(`${filterStartDate}T00:00:00`)) return false;
      }
      if (filterEndDate) {
        if (new Date(c.created_at) > new Date(`${filterEndDate}T23:59:59`)) return false;
      }
      if (filterMinValue) {
        const minCents = Math.round(Number(filterMinValue.replace(",", ".")) * 100);
        if (Number.isFinite(minCents) && c.amount < minCents) return false;
      }
      return true;
    });
  }, [
    charges,
    filterMerchant,
    filterStatus,
    filterMethod,
    filterStartDate,
    filterEndDate,
    filterMinValue,
  ]);

  const selectedStoreObj = stores.find((s) => s.id === selectedMerchantId);

  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    const numVal = Number(amountInput.replace(",", "."));
    if (!selectedMerchantId) {
      alert("Selecione o lojista.");
      return;
    }
    if (!Number.isFinite(numVal) || numVal < 1) {
      alert("O valor mínimo da cobrança é R$ 1,00.");
      return;
    }
    if (!descriptionInput.trim() || descriptionInput.trim().length < 3) {
      alert("Informe a descrição da cobrança.");
      return;
    }
    setConfirmStep(true);
  };

  const handleConfirmCreateCharge = async () => {
    setCreating(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/superadmin/charges", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          merchantId: selectedMerchantId,
          amountReais: amountInput,
          description: descriptionInput.trim(),
          reason: reasonInput.trim(),
          dueDate: dueDateInput || null,
          adminNotes: adminNotesInput.trim(),
          generateCheckout: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao criar cobrança.");
      }

      if (data.checkoutError) {
        alert(
          `Cobrança criada e lojista bloqueado imediatamente!\nAviso ao gerar link InfinitePay: ${data.checkoutError}`
        );
      } else {
        alert(
          "Cobrança criada, link InfinitePay gerado e acesso operacional do lojista bloqueado automaticamente!"
        );
      }

      setCreateOpen(false);
      setConfirmStep(false);
      setSelectedMerchantId("");
      setAmountInput("");
      setDescriptionInput("");
      setReasonInput("");
      setDueDateInput("");
      setAdminNotesInput("");
      await loadCharges();
      onRefreshStores();
    } catch (err: any) {
      alert("Erro: " + err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleChargeAction = async (
    chargeId: string,
    action: string,
    extra: Record<string, any> = {}
  ) => {
    setActionLoadingId(chargeId);
    try {
      const token = await getToken();
      const res = await fetch(`/api/superadmin/charges/${chargeId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao executar ação.");
      }

      if (action === "check_payment") {
        alert(
          data.paid
            ? "✅ Pagamento confirmado oficialmente na InfinitePay! Lojista reavaliado."
            : "ℹ️ Pagamento ainda consta como pendente na InfinitePay."
        );
      } else if (action === "send_whatsapp") {
        alert("✅ Link de cobrança enviado no WhatsApp do lojista!");
      } else if (action === "cancel") {
        alert("Cobrança cancelada internamente e acesso do lojista reavaliado.");
      } else if (action === "confirm_refund") {
        alert("Estorno registrado e acesso do lojista reavaliado.");
      }

      await loadCharges();
      onRefreshStores();
    } catch (err: any) {
      alert("Atenção: " + err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCopy = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportCsv = () => {
    const headers = [
      "ID",
      "Lojista",
      "Descricao",
      "Motivo",
      "Status",
      "Valor Cobrado (R$)",
      "Valor Pago Cliente (R$)",
      "Taxas Parcelamento (R$)",
      "Valor Liquido (R$)",
      "Forma Pagamento",
      "Parcelas",
      "Order NSU",
      "Criado em",
      "Vencimento",
      "Pago em",
    ];
    const rows = filteredCharges.map((c) => {
      const charged = (Number(c.amount || 0) / 100).toFixed(2);
      const paid = c.status === "paid" ? (Number(c.paid_amount || c.amount) / 100).toFixed(2) : "0.00";
      const fee = c.status === "paid" ? (Number(c.fee_amount || 0) / 100).toFixed(2) : "0.00";
      const net = c.status === "paid" ? (Number(c.net_amount || c.amount) / 100).toFixed(2) : "0.00";
      return [
        c.id,
        `"${(c.stores?.name || "").replace(/"/g, '""')}"`,
        `"${(c.description || "").replace(/"/g, '""')}"`,
        `"${(c.reason || "").replace(/"/g, '""')}"`,
        c.status,
        charged,
        paid,
        fee,
        net,
        c.payment_method || "-",
        c.installments || 1,
        c.order_nsu,
        formatDateTime(c.created_at),
        formatDateOnly(c.due_date),
        formatDateTime(c.paid_at),
      ].join(";");
    });

    const csv = [headers.join(";"), ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cobrancas-infinitepay-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="w-3 h-3" /> Pago
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-800">
            <Clock className="w-3 h-3" /> Pendente
          </span>
        );
      case "expired":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-orange-100 text-orange-800">
            <AlertTriangle className="w-3 h-3" /> Link Expirado
          </span>
        );
      case "refunded_review":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-rose-100 text-rose-700">
            <ShieldAlert className="w-3 h-3" /> Análise de Estorno
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-slate-200 text-slate-700">
            <Ban className="w-3 h-3" /> Cancelado
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* CABEÇALHO FINANCEIRO -> COBRANÇAS DOS LOJISTAS */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700">
            <CreditCard className="w-3 h-3" /> Financeiro → Cobranças dos Lojistas (InfinitePay)
          </span>
          <h2 className="text-xl font-black text-slate-900 mt-1.5">
            Cobranças Avulsas Centralizadas
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Recebimento exclusivo na conta oficial InfinitePay do MEU FIADIM via Pix ou Cartão, com bloqueio e liberação automáticos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-extrabold flex items-center gap-1.5 transition"
          >
            <Download className="w-4 h-4" /> Exportar CSV
          </button>
          <button
            onClick={loadCharges}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-extrabold flex items-center gap-1.5 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </button>
          <button
            onClick={() => {
              setConfirmStep(false);
              setCreateOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-purple-600/20 active:scale-95 transition"
          >
            <Plus className="w-4 h-4" /> Nova Cobrança Avulsa
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* INDICADORES DO DASHBOARD FINANCEIRO (8 MÉTRICAS) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase">Total Recebido (Líquido)</span>
          <p className="text-xl font-black text-emerald-600 mt-1">
            {formatCents(metrics.totalReceivedCents)}
          </p>
          <span className="text-[10px] text-slate-400">
            Pago clientes: {formatCents(metrics.totalPaidByBuyersCents)} (Taxas: {formatCents(metrics.totalFeeCents)})
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase">Total Pendente</span>
          <p className="text-xl font-black text-amber-600 mt-1">
            {formatCents(metrics.totalPendingCents)}
          </p>
          <span className="text-[10px] text-slate-400">{metrics.pendingCount} em aberto</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase">Cobranças Criadas / Pagas</span>
          <p className="text-xl font-black text-slate-900 mt-1">
            {metrics.totalChargesCount}{" "}
            <span className="text-sm font-bold text-emerald-600">/ {metrics.paidCount} pagas</span>
          </p>
          <span className="text-[10px] text-slate-400">Canceladas: {metrics.canceledCount}</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase">Lojistas Bloq. / Regul.</span>
          <p className="text-xl font-black text-rose-600 mt-1">
            {metrics.blockedMerchantsCount}{" "}
            <span className="text-sm font-bold text-emerald-600">/ {metrics.regularizedMerchantsCount}</span>
          </p>
          <span className="text-[10px] text-slate-400">
            Análise estorno: {formatCents(metrics.totalRefundReviewCents)}
          </span>
        </div>
      </div>

      {/* FILTROS */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
        <select
          value={filterMerchant}
          onChange={(e) => setFilterMerchant(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-slate-50"
        >
          <option value="all">Todos os lojistas</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-slate-50"
        >
          <option value="all">Todos os status</option>
          <option value="pending">Pendente</option>
          <option value="paid">Pago</option>
          <option value="canceled">Cancelado</option>
          <option value="expired">Link Expirado</option>
          <option value="refunded_review">Análise de Estorno</option>
        </select>

        <select
          value={filterMethod}
          onChange={(e) => setFilterMethod(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-slate-50"
        >
          <option value="all">Todas as formas</option>
          <option value="pix">Pix</option>
          <option value="credit">Cartão de Crédito</option>
        </select>

        <input
          type="date"
          value={filterStartDate}
          onChange={(e) => setFilterStartDate(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-slate-50"
          title="Data inicial"
        />

        <input
          type="date"
          value={filterEndDate}
          onChange={(e) => setFilterEndDate(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-slate-50"
          title="Data final"
        />

        <input
          type="text"
          placeholder="Valor mín. (R$)"
          value={filterMinValue}
          onChange={(e) => setFilterMinValue(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-slate-50"
        />
      </div>

      {/* LISTAGEM DE COBRANÇAS */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs font-bold flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
            <span>Carregando cobranças InfinitePay...</span>
          </div>
        ) : filteredCharges.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs font-bold">
            Nenhuma cobrança encontrada com os filtros atuais.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredCharges.map((c) => {
              const isBusy = actionLoadingId === c.id;
              return (
                <div
                  key={c.id}
                  className="p-4 sm:p-5 hover:bg-slate-50/70 transition flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-black text-sm text-slate-900">
                        {c.stores?.name || "Lojista"}
                      </span>
                      {statusBadge(c.status)}
                      {c.stores?.financial_blocked && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                          Loja Bloqueada
                        </span>
                      )}
                      {c.payment_method && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 uppercase">
                          {c.payment_method} {c.installments && c.installments > 1 ? `${c.installments}x` : ""}
                        </span>
                      )}
                    </div>

                    <p className="text-xs font-bold text-slate-700">{c.description}</p>
                    {c.reason && (
                      <p className="text-[11px] text-slate-500">Motivo: {c.reason}</p>
                    )}

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400 pt-1">
                      <span>NSU: <strong className="text-slate-600">{c.order_nsu}</strong></span>
                      <span>Vencimento: <strong className="text-slate-600">{formatDateOnly(c.due_date)}</strong></span>
                      <span>Criada: {formatDateTime(c.created_at)}</span>
                      {c.paid_at && (
                        <span className="text-emerald-600 font-bold">
                          Pago em: {formatDateTime(c.paid_at)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="text-left sm:text-right mr-2">
                      <span className="text-lg font-black text-slate-900 block">
                        {formatCents(c.amount)}
                      </span>
                      {c.status === "paid" && c.paid_amount && c.paid_amount !== c.amount && (
                        <span className="text-[10px] text-slate-500 block">
                          Cliente pagou {formatCents(c.paid_amount)}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {(c.status === "pending" || c.status === "expired") && (
                        <>
                          {c.checkout_url ? (
                            <>
                              <button
                                onClick={() => handleCopy(c.id, c.checkout_url!)}
                                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center gap-1"
                              >
                                {copiedId === c.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                {copiedId === c.id ? "Copiado" : "Copiar Link"}
                              </button>
                              <button
                                disabled={isBusy}
                                onClick={() => handleChargeAction(c.id, "send_whatsapp")}
                                className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold flex items-center gap-1"
                              >
                                <MessageCircle className="w-3.5 h-3.5" /> Zap
                              </button>
                              <button
                                disabled={isBusy}
                                onClick={() => handleChargeAction(c.id, "regenerate_checkout")}
                                className="px-2.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-[11px] font-bold flex items-center gap-1"
                                title="Gerar nova tentativa de link InfinitePay"
                              >
                                <RefreshCw className="w-3.5 h-3.5" /> Novo Link
                              </button>
                            </>
                          ) : (
                            <button
                              disabled={isBusy}
                              onClick={() => handleChargeAction(c.id, "generate_checkout")}
                              className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold flex items-center gap-1"
                            >
                              <CreditCard className="w-3.5 h-3.5" /> Gerar Link
                            </button>
                          )}

                          <button
                            disabled={isBusy}
                            onClick={() => handleChargeAction(c.id, "check_payment")}
                            className="px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold flex items-center gap-1"
                          >
                            <Search className="w-3.5 h-3.5" /> Consultar
                          </button>

                          <button
                            disabled={isBusy}
                            onClick={() => {
                              if (confirm("Cancelar esta cobrança internamente? O acesso do lojista será reavaliado.")) {
                                handleChargeAction(c.id, "cancel");
                              }
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold flex items-center gap-1"
                          >
                            <XCircle className="w-3.5 h-3.5" /> Cancelar
                          </button>
                        </>
                      )}

                      {c.status === "refunded_review" && (
                        <button
                          disabled={isBusy}
                          onClick={() => {
                            if (confirm("Confirmar que o estorno foi realizado na InfinitePay e regularizar esta cobrança?")) {
                              handleChargeAction(c.id, "confirm_refund");
                            }
                          }}
                          className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Confirmar Estorno
                        </button>
                      )}

                      {c.receipt_url && (
                        <a
                          href={c.receipt_url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold flex items-center gap-1"
                        >
                          <Receipt className="w-3.5 h-3.5" /> Comprovante
                        </a>
                      )}

                      <button
                        onClick={() => {
                          setSelectedCharge(c);
                          setEditingNotes(c.admin_notes || "");
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" /> Detalhes
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL CRIAR COBRANÇA + CONFIRMAÇÃO OBRIGATÓRIA */}
      {createOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">
                {confirmStep ? "Confirmar Nova Cobrança" : "Nova Cobrança Avulsa (InfinitePay)"}
              </h3>
              <button
                onClick={() => setCreateOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!confirmStep ? (
              <form onSubmit={handleOpenConfirm} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-extrabold text-slate-600">
                    Pesquisar e Selecionar Lojista *
                  </label>
                  <input
                    type="text"
                    placeholder="Buscar lojista por nome, slug ou WhatsApp..."
                    value={merchantSearch}
                    onChange={(e) => setMerchantSearch(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold mb-1.5"
                  />
                  <select
                    required
                    value={selectedMerchantId}
                    onChange={(e) => setSelectedMerchantId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50"
                  >
                    <option value="">-- Selecione o lojista --</option>
                    {filteredStoresForSelect.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.slug}) {s.status === "blocked" ? "[BLOQUEADA]" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-extrabold text-slate-600">
                      Valor (R$) * (Mín. R$ 1,00)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: 49,90"
                      value={amountInput}
                      onChange={(e) => setAmountInput(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-extrabold text-slate-600">
                      Vencimento (Opcional)
                    </label>
                    <input
                      type="date"
                      value={dueDateInput}
                      onChange={(e) => setDueDateInput(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-extrabold text-slate-600">
                    Descrição da Cobrança *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Taxa operacional MEU FIADIM / Acerto avulso"
                    value={descriptionInput}
                    onChange={(e) => setDescriptionInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-extrabold text-slate-600">
                    Motivo da Cobrança
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Comissões acumuladas, taxa de suporte..."
                    value={reasonInput}
                    onChange={(e) => setReasonInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-extrabold text-slate-600">
                    Observações Administrativas (Interno)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Anotações visíveis apenas para o Super Admin..."
                    value={adminNotesInput}
                    onChange={(e) => setAdminNotesInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs shadow-md transition"
                >
                  Revisar e Confirmar Cobrança
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
                  <p className="font-black flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-amber-600" />
                    Atenção: Bloqueio Imediato do Lojista
                  </p>
                  <p>
                    Ao confirmar, o acesso operacional de <strong>{selectedStoreObj?.name}</strong> será bloqueado imediatamente até a confirmação oficial do pagamento na InfinitePay.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Lojista:</span>
                    <strong className="text-slate-900">{selectedStoreObj?.name}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Valor:</span>
                    <strong className="text-purple-700 text-sm">
                      R$ {Number(amountInput.replace(",", ".")).toFixed(2).replace(".", ",")}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Descrição:</span>
                    <strong className="text-slate-900">{descriptionInput}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Vencimento:</span>
                    <strong className="text-slate-900">
                      {dueDateInput ? new Date(`${dueDateInput}T12:00:00`).toLocaleDateString("pt-BR") : "Padrão (7 dias)"}
                    </strong>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={creating}
                    onClick={() => setConfirmStep(false)}
                    className="py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs"
                  >
                    Voltar e Editar
                  </button>
                  <button
                    type="button"
                    disabled={creating}
                    onClick={handleConfirmCreateCharge}
                    className="py-3 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs flex items-center justify-center gap-1.5"
                  >
                    {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {creating ? "Gerando..." : "Confirmar e Bloquear"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL DE DETALHES, TENTATIVAS E AUDITORIA */}
      {selectedCharge && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Detalhes da Cobrança — {selectedCharge.stores?.name}
                </h3>
                <p className="text-xs text-slate-400">NSU: {selectedCharge.order_nsu}</p>
              </div>
              <button
                onClick={() => setSelectedCharge(null)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-400 block">Valor Cobrado</span>
                <strong className="text-slate-900 text-sm">{formatCents(selectedCharge.amount)}</strong>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-400 block">Valor Pago</span>
                <strong className="text-emerald-700 text-sm">
                  {selectedCharge.status === "paid" ? formatCents(selectedCharge.paid_amount || selectedCharge.amount) : "-"}
                </strong>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-400 block">Slug InfinitePay</span>
                <strong className="text-slate-900 truncate block">{selectedCharge.invoice_slug || "-"}</strong>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-400 block">Transaction NSU</span>
                <strong className="text-slate-900 truncate block">{selectedCharge.transaction_nsu || "-"}</strong>
              </div>
            </div>

            {/* Observações Administrativas */}
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-600">
                Observações Administrativas
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editingNotes}
                  onChange={(e) => setEditingNotes(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                />
                <button
                  onClick={() =>
                    handleChargeAction(selectedCharge.id, "update_notes", {
                      adminNotes: editingNotes,
                    })
                  }
                  className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
                >
                  Salvar Nota
                </button>
              </div>
            </div>

            {/* Histórico de Tentativas */}
            <div className="space-y-2">
              <h4 className="text-xs font-black uppercase text-slate-500 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Tentativas de Checkout
              </h4>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {attempts
                  .filter((a) => a.charge_id === selectedCharge.id)
                  .map((a) => (
                    <div
                      key={a.id}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px] flex items-center justify-between"
                    >
                      <div>
                        <strong className="text-slate-800">{a.order_nsu}</strong>
                        <span className="text-slate-400 ml-2">{formatDateTime(a.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="uppercase font-bold text-slate-600">{a.status}</span>
                        {a.checkout_url && (
                          <a
                            href={a.checkout_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-purple-600 hover:underline flex items-center gap-0.5"
                          >
                            Link <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Auditoria de Eventos InfinitePay */}
            <div className="space-y-2">
              <h4 className="text-xs font-black uppercase text-slate-500">
                Auditoria de Eventos InfinitePay
              </h4>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {events
                  .filter((ev) => ev.charge_id === selectedCharge.id)
                  .map((ev) => (
                    <div
                      key={ev.id}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px] flex items-center justify-between"
                    >
                      <div>
                        <span className="font-black text-slate-800">{ev.event_type}</span>
                        <span className="text-slate-400 ml-2">({ev.source})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold ${
                            ev.verified ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {ev.verified ? "Verificado Oficial" : "Não Verificado"}
                        </span>
                        <span className="text-slate-400">{formatDateTime(ev.created_at)}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
