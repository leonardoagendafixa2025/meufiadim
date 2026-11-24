"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Shield,
  Store,
  Users,
  Package,
  TrendingUp,
  Receipt,
  BadgePercent,
  MessageCircle,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Smartphone,
  ExternalLink,
  Trash2,
  Search,
  Filter,
  Check,
  LogOut,
  Send,
  Clock,
  ArrowUpRight,
  Lock,
  Unlock,
  Settings,
  QrCode,
  Sparkles,
  Zap,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatBRL } from "@/lib/whatsapp";

interface StoreMetrics {
  customersCount: number;
  productsCount: number;
  totalBalance: number;
  totalSales: number;
  totalCommission: number;
}

interface StoreItem {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  whatsapp: string;
  pix_key?: string | null;
  pix_city?: string | null;
  commission_rate: number;
  billing_cycle: "weekly" | "monthly";
  status: "active" | "blocked";
  created_at: string;
  metrics: StoreMetrics;
}

interface PlatformStats {
  totalStores: number;
  activeStores: number;
  blockedStores: number;
  totalCustomers: number;
  totalProducts: number;
  totalReceivable: number;
  totalSalesVolume: number;
  totalCommissionDue: number;
  totalCommissionPaid: number;
}

interface InvoiceItem {
  id: string;
  store_id: string;
  period_start: string;
  period_end: string;
  total_sales: number;
  commission_due: number;
  status: "open" | "pending_review" | "paid" | "overdue";
  pix_txid?: string | null;
  paid_at?: string | null;
  created_at: string;
  stores?: {
    name: string;
    slug: string;
  };
}

export default function SuperAdminPage() {
  const router = useRouter();

  // Estados principais
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);

  // Dados da plataforma
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);

  // Abas
  const [activeTab, setActiveTab] = useState<
    "overview" | "stores" | "whatsapp" | "invoices"
  >("overview");

  // Filtros de Lojas
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "blocked">("all");

  // Ações em Lojas
  const [savingStoreId, setSavingStoreId] = useState<string | null>(null);
  const [deleteConfirmStore, setDeleteConfirmStore] = useState<StoreItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // WhatsApp Central (Baileys Hub)
  const [zapConnected, setZapConnected] = useState(false);
  const [zapQR, setZapQR] = useState<string | null>(null);
  const [zapLoading, setZapLoading] = useState(false);
  const [zapConfigured, setZapConfigured] = useState(true);
  const [zapError, setZapError] = useState<string | null>(null);
  const [disconnectingZap, setDisconnectingZap] = useState(false);

  // Teste de Disparo WhatsApp
  const [testPhone, setTestPhone] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    msg: string;
  } | null>(null);

  // Toast Notificação
  const [toastMsg, setToastMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    initDashboard();
  }, []);

  function showToast(text: string, type: "success" | "error" = "success") {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 3500);
  }

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token || null;
  }

  async function initDashboard() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      setCurrentEmail(user.email || null);

      const email = (user.email || "").toLowerCase().trim();
      const superAdmins = [
        "toyesterdayagencia@gmail.com",
        (process.env.NEXT_PUBLIC_SUPERADMIN_EMAIL || "").toLowerCase().trim(),
      ].filter(Boolean);

      if (!superAdmins.includes(email)) {
        setLoading(false);
        return;
      }

      setAuthorized(true);
      await Promise.all([loadPlatformData(), fetchZapStatus()]);
    } catch (err: any) {
      showToast(err.message || "Erro ao inicializar", "error");
    } finally {
      setLoading(false);
    }
  }

  async function loadPlatformData() {
    try {
      const token = await getAccessToken();
      if (!token) return;

      const res = await fetch("/api/superadmin/data", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erro ao carregar dados da plataforma.");
      }

      const data = await res.json();
      setStats(data.stats);
      setStores(data.stores);
      setInvoices(data.invoices);
    } catch (err: any) {
      showToast(err.message, "error");
    }
  }

  async function fetchZapStatus() {
    try {
      setZapLoading(true);
      setZapError(null);

      const res = await fetch("/api/zap/qr", { cache: "no-store" });
      const data = await res.json();

      if (!data.configured) {
        setZapConfigured(false);
        setZapConnected(false);
        setZapQR(null);
        return;
      }

      setZapConfigured(true);
      setZapConnected(!!data.connected);
      setZapQR(data.qrDataUrl || null);

      if (data.error && !data.connected) {
        setZapError(data.error);
      }
    } catch {
      setZapError("Servidor do WhatsApp indisponível no momento.");
    } finally {
      setZapLoading(false);
    }
  }

  async function handleDisconnectZap() {
    if (
      !confirm(
        "Atenção: Desconectar o WhatsApp central vai interromper os disparos de cobrança de todas as lojas até que você reconecte. Deseja continuar?"
      )
    ) {
      return;
    }

    try {
      setDisconnectingZap(true);
      const res = await fetch("/api/zap/disconnect", { method: "POST" });
      if (!res.ok) throw new Error("Falha ao desconectar.");

      setZapConnected(false);
      setZapQR(null);
      showToast("WhatsApp desconectado com sucesso!");
      setTimeout(fetchZapStatus, 1500);
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setDisconnectingZap(false);
    }
  }

  async function handleSendTestMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!testPhone.trim()) return;

    try {
      setSendingTest(true);
      setTestResult(null);

      const token = await getAccessToken();
      if (!token) return;

      const res = await fetch("/api/superadmin/zap/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ phone: testPhone.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao enviar teste.");
      }

      setTestResult({
        ok: true,
        msg: `Mensagem enviada com sucesso para ${testPhone}! Verifique seu WhatsApp.`,
      });
      showToast("Mensagem de teste entregue!");
      setTestPhone("");
    } catch (err: any) {
      setTestResult({
        ok: false,
        msg: err.message || "Falha no envio de teste.",
      });
      showToast(err.message, "error");
    } finally {
      setSendingTest(false);
    }
  }

  async function handleUpdateStore(id: string, patch: Partial<StoreItem>) {
    try {
      setSavingStoreId(id);
      const token = await getAccessToken();
      if (!token) throw new Error("Sessão expirada.");

      const res = await fetch("/api/superadmin/store", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ storeId: id, patch }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Falha ao atualizar loja.");
      }

      showToast("Loja atualizada com sucesso!");
      await loadPlatformData();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSavingStoreId(null);
    }
  }

  async function handleDeleteStore() {
    if (!deleteConfirmStore) return;

    try {
      setDeleting(true);
      const token = await getAccessToken();
      if (!token) throw new Error("Sessão expirada.");

      const res = await fetch("/api/superadmin/store", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ storeId: deleteConfirmStore.id }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Falha ao excluir loja.");
      }

      showToast(`Loja "${deleteConfirmStore.name}" excluída.`);
      setDeleteConfirmStore(null);
      await loadPlatformData();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setDeleting(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  // Filtragem de Lojas
  const filteredStores = useMemo(() => {
    return stores.filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.whatsapp || "").includes(searchQuery);

      const matchesStatus =
        statusFilter === "all" ? true : s.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [stores, searchQuery, statusFilter]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
        <div className="flex items-center gap-3 bg-white px-6 py-4 rounded-2xl shadow-sm border border-slate-200">
          <RefreshCw className="w-5 h-5 text-purple-600 animate-spin" />
          <p className="text-sm font-bold text-slate-700">
            Carregando painel do SuperAdmin...
          </p>
        </div>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200/80 max-w-md w-full space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6 stroke-[2]" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">Acesso Restrito</h2>
          <p className="text-sm text-slate-500">
            Esta área é exclusiva para a administração central da plataforma{" "}
            <strong>meufiadim</strong>.
          </p>

          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-sm transition"
          >
            Fazer Login como Administrador
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 selection:bg-purple-600 selection:text-white">
      {/* Toast Notificação */}
      {toastMsg && (
        <div
          className={`fixed top-6 right-6 z-50 flex items-center gap-2.5 text-xs font-extrabold px-4 py-3 rounded-2xl shadow-2xl transition-all duration-300 ${
            toastMsg.type === "success"
              ? "bg-slate-900 text-white border border-slate-700 shadow-slate-900/30"
              : "bg-rose-600 text-white shadow-rose-600/30"
          }`}
        >
          {toastMsg.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-white" />
          )}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Header Fixo do SuperAdmin */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200/70 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <img
              src="/logo.png"
              alt="meufiadim"
              className="h-10 sm:h-11 w-auto object-contain"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200/70">
                  <Shield className="w-3 h-3 inline" />
                  SuperAdmin
                </span>
                <span className="text-[11px] font-semibold text-slate-400 hidden sm:inline">
                  • Dono da Plataforma
                </span>
              </div>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                {currentEmail}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Status rápido do WhatsApp */}
            <button
              onClick={() => setActiveTab("whatsapp")}
              className={`hidden md:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold border transition ${
                zapConnected
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                  : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  zapConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                }`}
              />
              <span>{zapConnected ? "Robô Zap Online" : "Conectar Robô Zap"}</span>
            </button>

            <button
              onClick={handleLogout}
              className="p-2.5 sm:px-3.5 sm:py-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 rounded-xl text-xs font-bold flex items-center gap-2 transition active:scale-95 shadow-xs"
              title="Sair da plataforma"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Dock de Navegação Superior (4 Abas) */}
        <div className="bg-white p-1.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap gap-1">
          <button
            onClick={() => setActiveTab("overview")}
            className={`flex-1 min-w-[140px] py-2.5 px-4 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-all duration-150 ${
              activeTab === "overview"
                ? "bg-purple-600 text-white shadow-md shadow-purple-600/25"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Visão Geral</span>
          </button>

          <button
            onClick={() => setActiveTab("stores")}
            className={`flex-1 min-w-[140px] py-2.5 px-4 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-all duration-150 ${
              activeTab === "stores"
                ? "bg-purple-600 text-white shadow-md shadow-purple-600/25"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Store className="w-4 h-4" />
            <span>Lojas & Tenants ({stores.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("whatsapp")}
            className={`flex-1 min-w-[140px] py-2.5 px-4 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-all duration-150 ${
              activeTab === "whatsapp"
                ? "bg-purple-600 text-white shadow-md shadow-purple-600/25"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            <span className="flex items-center gap-1.5">
              WhatsApp Central
              {zapConnected ? (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-amber-400" />
              )}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("invoices")}
            className={`flex-1 min-w-[140px] py-2.5 px-4 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-all duration-150 ${
              activeTab === "invoices"
                ? "bg-purple-600 text-white shadow-md shadow-purple-600/25"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Faturas & Comissão ({invoices.length})</span>
          </button>
        </div>

        {/* ============================================================================== */}
        {/* ABA 1: VISÃO GERAL (OVERVIEW) */}
        {/* ============================================================================== */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Banner de Boas-Vindas Operacional */}
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-purple-900/30">
              <div className="relative z-10 max-w-2xl space-y-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-extrabold border border-purple-500/30">
                  <Sparkles className="w-3.5 h-3.5" />
                  Painel de Controle Central
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  Gestão Geral do MeuFiadim
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed font-medium">
                  Você é o administrador central da plataforma. Aqui você monitora o
                  volume transacionado em todas as lojas, altera comissões, gerencia
                  bloqueios e opera o robô oficial de WhatsApp.
                </p>
              </div>
            </div>

            {/* Grid de Métricas Principais (KPIs Globais) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Lojas */}
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/70 shadow-sm shadow-slate-200/50 hover:shadow-md transition-all space-y-2">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-extrabold uppercase tracking-wider">
                    Lojas Cadastradas
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                    <Store className="w-4 h-4 stroke-[2]" />
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  {stats?.totalStores ?? 0}
                </p>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                  <span className="text-emerald-700">{stats?.activeStores ?? 0} ativas</span>
                  <span>•</span>
                  <span className="text-rose-600">{stats?.blockedStores ?? 0} bloqueadas</span>
                </div>
              </div>

              {/* Card 2: Clientes */}
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/70 shadow-sm shadow-slate-200/50 hover:shadow-md transition-all space-y-2">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-extrabold uppercase tracking-wider">
                    Clientes de Fiado
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Users className="w-4 h-4 stroke-[2]" />
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  {stats?.totalCustomers ?? 0}
                </p>
                <p className="text-xs text-slate-500 font-medium">
                  {stats?.totalProducts ?? 0} produtos cadastrados
                </p>
              </div>

              {/* Card 3: Volume de Vendas */}
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/70 shadow-sm shadow-slate-200/50 hover:shadow-md transition-all space-y-2">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-extrabold uppercase tracking-wider">
                    Vendas Transacionadas
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 stroke-[2]" />
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl font-extrabold text-emerald-700 tracking-tight">
                  {formatBRL(stats?.totalSalesVolume ?? 0)}
                </p>
                <p className="text-xs text-slate-500 font-medium">
                  Volume registrado nas lojas
                </p>
              </div>

              {/* Card 4: Fiado Total em Aberto */}
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/70 shadow-sm shadow-slate-200/50 hover:shadow-md transition-all space-y-2">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-xs font-extrabold uppercase tracking-wider">
                    Fiado em Aberto
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Receipt className="w-4 h-4 stroke-[2]" />
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl font-extrabold text-amber-600 tracking-tight">
                  {formatBRL(stats?.totalReceivable ?? 0)}
                </p>
                <p className="text-xs text-slate-500 font-medium">
                  A ser cobrado com Pix Copia e Cola
                </p>
              </div>
            </div>

            {/* Destaque Robô Central + Ações Rápidas */}
            <div className="grid lg:grid-cols-3 gap-4">
              {/* Card WhatsApp Central Status */}
              <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200/70 shadow-sm shadow-slate-200/50 flex flex-col justify-between space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold ${
                          zapConnected
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : "bg-amber-50 text-amber-800 border border-amber-200"
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            zapConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                          }`}
                        />
                        {zapConnected
                          ? "Robô Central Conectado e Ativo"
                          : "Aguardando Conexão com WhatsApp"}
                      </span>
                    </div>
                    <h3 className="text-lg font-extrabold text-slate-900 mt-2">
                      Robô Central de Cobranças (Baileys)
                    </h3>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed">
                      Todas as lojas cadastradas na plataforma usam este número central
                      para disparar os lembretes educados de fiado às 09:00 e cobrar no
                      Pix.
                    </p>
                  </div>

                  <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
                    <MessageCircle className="w-6 h-6 stroke-[2]" />
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap gap-2.5">
                  <button
                    onClick={() => setActiveTab("whatsapp")}
                    className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 transition active:scale-95 shadow-md shadow-purple-600/20"
                  >
                    <QrCode className="w-4 h-4" />
                    Gerenciar WhatsApp Central
                  </button>

                  <button
                    onClick={fetchZapStatus}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Atualizar Status
                  </button>
                </div>
              </div>

              {/* Card Receita Estimada em Comissões */}
              <div className="bg-gradient-to-br from-purple-900 to-indigo-950 text-white rounded-3xl p-6 shadow-md flex flex-col justify-between space-y-4">
                <div>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-purple-200">
                    Receita da Plataforma
                  </span>
                  <p className="text-3xl font-extrabold mt-2 tracking-tight text-white">
                    {formatBRL(stats?.totalCommissionDue ?? 0)}
                  </p>
                  <p className="text-xs text-purple-200 font-medium mt-1">
                    Comissões acumuladas para faturamento
                  </p>
                </div>

                <div className="pt-2 border-t border-purple-800/60 flex items-center justify-between text-xs text-purple-200">
                  <span>Comissões já pagas:</span>
                  <span className="font-extrabold text-emerald-300">
                    {formatBRL(stats?.totalCommissionPaid ?? 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================================== */}
        {/* ABA 2: GESTÃO DE LOJAS (TENANTS) */}
        {/* ============================================================================== */}
        {activeTab === "stores" && (
          <div className="space-y-4">
            {/* Barra de Filtros e Busca */}
            <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/70 shadow-sm shadow-slate-200/50 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-96">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por nome da loja, slug ou WhatsApp..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition"
                />
              </div>

              <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                <button
                  onClick={() => setStatusFilter("all")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition ${
                    statusFilter === "all"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Todas ({stores.length})
                </button>
                <button
                  onClick={() => setStatusFilter("active")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition ${
                    statusFilter === "active"
                      ? "bg-emerald-600 text-white"
                      : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                  }`}
                >
                  Ativas ({stores.filter((s) => s.status === "active").length})
                </button>
                <button
                  onClick={() => setStatusFilter("blocked")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition ${
                    statusFilter === "blocked"
                      ? "bg-rose-600 text-white"
                      : "bg-rose-50 text-rose-800 hover:bg-rose-100"
                  }`}
                >
                  Bloqueadas ({stores.filter((s) => s.status === "blocked").length})
                </button>
              </div>
            </div>

            {/* Lista de Lojas */}
            <div className="space-y-3">
              {filteredStores.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/70 shadow-xs space-y-3">
                  <Store className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-sm font-extrabold text-slate-800">
                    Nenhuma loja encontrada
                  </p>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    {searchQuery
                      ? "Nenhuma loja corresponde ao termo pesquisado."
                      : "Nenhuma loja foi cadastrada ainda na plataforma."}
                  </p>
                </div>
              ) : (
                filteredStores.map((s) => (
                  <div
                    key={s.id}
                    className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/70 shadow-sm shadow-slate-200/50 hover:shadow-md transition-all space-y-4"
                  >
                    {/* Linha 1: Dados da Loja + Status */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h4 className="text-base sm:text-lg font-extrabold text-slate-900">
                            {s.name}
                          </h4>
                          <span
                            className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
                              s.status === "active"
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                : "bg-rose-50 text-rose-800 border border-rose-200"
                            }`}
                          >
                            {s.status === "active" ? "✓ Ativa" : "✕ Bloqueada"}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium mt-1">
                          <a
                            href={`/${s.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-purple-700 font-extrabold hover:underline"
                          >
                            <span>/{s.slug}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                          <span>•</span>
                          <span>WhatsApp: {s.whatsapp || "Não informado"}</span>
                          {s.pix_key && (
                            <>
                              <span>•</span>
                              <span className="font-mono text-slate-700 font-bold">
                                Pix: {s.pix_key}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Métricas Rápidas da Loja */}
                      <div className="flex items-center gap-4 text-xs bg-slate-50 p-2.5 px-4 rounded-2xl border border-slate-200/60">
                        <div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">
                            Clientes
                          </p>
                          <p className="font-extrabold text-slate-900">
                            {s.metrics?.customersCount ?? 0}
                          </p>
                        </div>
                        <div className="w-px h-6 bg-slate-200" />
                        <div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">
                            Fiado em Aberto
                          </p>
                          <p className="font-extrabold text-amber-600">
                            {formatBRL(s.metrics?.totalBalance ?? 0)}
                          </p>
                        </div>
                        <div className="w-px h-6 bg-slate-200" />
                        <div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">
                            Vendas
                          </p>
                          <p className="font-extrabold text-emerald-700">
                            {formatBRL(s.metrics?.totalSales ?? 0)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Linha 2: Controles de Comissão e Ações */}
                    <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/60">
                          Comissão (%):
                          <input
                            type="number"
                            step="0.5"
                            disabled={savingStoreId === s.id}
                            defaultValue={s.commission_rate}
                            onBlur={(e) => {
                              const val = Number(e.target.value);
                              if (val !== s.commission_rate) {
                                handleUpdateStore(s.id, { commission_rate: val });
                              }
                            }}
                            className="w-16 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </label>

                        <select
                          value={s.billing_cycle}
                          disabled={savingStoreId === s.id}
                          onChange={(e) =>
                            handleUpdateStore(s.id, {
                              billing_cycle: e.target.value as "weekly" | "monthly",
                            })
                          }
                          className="px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                          <option value="weekly">Ciclo Semanal</option>
                          <option value="monthly">Ciclo Mensal</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Bloquear / Desbloquear */}
                        <button
                          onClick={() =>
                            handleUpdateStore(s.id, {
                              status: s.status === "active" ? "blocked" : "active",
                            })
                          }
                          disabled={savingStoreId === s.id}
                          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition active:scale-95 shadow-xs flex items-center gap-1.5 ${
                            s.status === "active"
                              ? "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200"
                              : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200"
                          }`}
                        >
                          {s.status === "active" ? (
                            <>
                              <Lock className="w-3.5 h-3.5" />
                              Bloquear Loja
                            </>
                          ) : (
                            <>
                              <Unlock className="w-3.5 h-3.5" />
                              Liberar Loja
                            </>
                          )}
                        </button>

                        {/* Excluir Loja */}
                        <button
                          onClick={() => setDeleteConfirmStore(s)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                          title="Excluir loja permanentemente"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ============================================================================== */}
        {/* ABA 3: WHATSAPP CENTRAL (BAILEYS HUB) */}
        {/* ============================================================================== */}
        {activeTab === "whatsapp" && (
          <div className="space-y-6">
            {/* Header explicativo do WhatsApp Central */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/70 shadow-sm shadow-slate-200/50 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span
                    className={`inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase px-3 py-1 rounded-full border ${
                      zapConnected
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : "bg-amber-50 text-amber-800 border-amber-200"
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        zapConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                      }`}
                    />
                    {zapConnected
                      ? "Robô Central Conectado 24/7"
                      : "Aguardando Conexão do Aparelho"}
                  </span>
                  <h3 className="font-extrabold text-xl text-slate-900 mt-2 tracking-tight">
                    Robô Central de WhatsApp da Plataforma
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed max-w-2xl">
                    Este é o robô único do <strong>meufiadim</strong> hospedado no
                    Railway. Todos os lojistas contam com este número para disparar as
                    cobranças de fiado com o Pix Copia e Cola diretamente para os
                    clientes.
                  </p>
                </div>

                <div className="w-13 h-13 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
                  <Smartphone className="w-6 h-6 stroke-[2]" />
                </div>
              </div>

              {/* Status Conectado */}
              {zapConnected ? (
                <div className="p-6 bg-gradient-to-br from-emerald-50 via-emerald-50/60 to-teal-50 rounded-3xl border border-emerald-200/80 space-y-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/30">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-base text-emerald-950">
                        O Robô Central está 100% Online e Operante!
                      </h4>
                      <p className="text-xs text-emerald-700 font-medium">
                        Disparos manuais e automáticos agendados para às 09:00 estão
                        ativos para todas as lojas.
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-wrap gap-2.5">
                    <button
                      onClick={fetchZapStatus}
                      className="px-4 py-2.5 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition active:scale-95 shadow-xs"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Atualizar Status
                    </button>
                    <button
                      onClick={handleDisconnectZap}
                      disabled={disconnectingZap}
                      className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition active:scale-95"
                    >
                      {disconnectingZap ? "Desconectando..." : "Desconectar WhatsApp"}
                    </button>
                  </div>
                </div>
              ) : (
                /* Status Desconectado: Exibe QR Code */
                <div className="space-y-4">
                  {!zapConfigured && (
                    <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-1">
                      <p className="font-extrabold">⚠️ Variável de Servidor Pendente</p>
                      <p>
                        Adicione a variável <code>ZAP_API_URL</code> nas Environment
                        Variables da Vercel com a URL do seu Railway.
                      </p>
                    </div>
                  )}

                  <div className="bg-slate-50 rounded-3xl p-6 sm:p-8 border border-slate-200/80 text-center space-y-4">
                    {zapLoading && !zapQR ? (
                      <div className="py-12 space-y-3">
                        <RefreshCw className="w-8 h-8 text-purple-600 animate-spin mx-auto" />
                        <p className="text-sm font-extrabold text-slate-800">
                          Gerando QR Code de Conexão no Railway...
                        </p>
                        <p className="text-xs text-slate-400">
                          Isso leva apenas alguns instantes.
                        </p>
                      </div>
                    ) : zapQR ? (
                      <div className="space-y-4">
                        <div className="inline-block bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xl">
                          <img
                            src={zapQR}
                            alt="QR Code WhatsApp"
                            className="w-64 h-64 sm:w-72 sm:h-72 mx-auto rounded-2xl"
                          />
                        </div>
                        <div className="flex items-center justify-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                          <p className="text-xs font-extrabold text-slate-700">
                            QR Code Ativo • Aponte a câmera do WhatsApp no celular oficial
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="py-8 space-y-3">
                        <Smartphone className="w-10 h-10 text-slate-300 mx-auto" />
                        <p className="text-sm font-extrabold text-slate-700">
                          Aguardando início do Baileys
                        </p>
                        <button
                          onClick={fetchZapStatus}
                          className="px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-extrabold hover:bg-purple-700 transition"
                        >
                          Carregar QR Code
                        </button>
                      </div>
                    )}

                    {/* Instruções passo a passo */}
                    <div className="max-w-sm mx-auto text-left bg-white p-4 rounded-2xl border border-slate-200/60 shadow-xs space-y-2 text-xs text-slate-600">
                      <p className="font-extrabold text-slate-900 flex items-center gap-1.5">
                        <Smartphone className="w-4 h-4 text-purple-600" /> Como conectar:
                      </p>
                      <ol className="list-decimal list-inside space-y-1 font-medium text-slate-700">
                        <li>Abra o <strong>WhatsApp</strong> no celular oficial</li>
                        <li>Toque no menu (3 pontinhos ou Ajustes)</li>
                        <li>Selecione <strong>Aparelhos Conectados</strong></li>
                        <li>
                          Toque em <strong>Conectar Aparelho</strong> e aponte a câmera
                          para o QR Code acima
                        </li>
                      </ol>
                    </div>

                    <button
                      onClick={fetchZapStatus}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition active:scale-95"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Atualizar QR Code
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Ferramenta de Teste de Disparo em Tempo Real */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/70 shadow-sm shadow-slate-200/50 space-y-4">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">
                  Teste de Envio em Tempo Real
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  Envie uma mensagem de teste para o seu próprio celular para comprovar
                  que o robô central está entregando perfeitamente.
                </p>
              </div>

              <form onSubmit={handleSendTestMessage} className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="tel"
                    placeholder="DDD + Número (ex: 31988887777 ou 11999998888)"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    disabled={!zapConnected || sendingTest}
                    className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={!zapConnected || sendingTest || !testPhone.trim()}
                    className="px-5 py-3 rounded-2xl bg-purple-600 hover:bg-purple-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition active:scale-95 shadow-md shadow-purple-600/25 disabled:shadow-none"
                  >
                    <Send className="w-4 h-4" />
                    <span>
                      {sendingTest ? "Disparando..." : "Enviar Mensagem de Teste"}
                    </span>
                  </button>
                </div>

                {!zapConnected && (
                  <p className="text-xs text-amber-700 font-bold">
                    ⚠️ Conecte o WhatsApp no QR Code acima para liberar o teste.
                  </p>
                )}

                {testResult && (
                  <div
                    className={`p-3.5 rounded-2xl text-xs font-bold border ${
                      testResult.ok
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : "bg-rose-50 text-rose-800 border-rose-200"
                    }`}
                  >
                    {testResult.msg}
                  </div>
                )}
              </form>
            </div>
          </div>
        )}

        {/* ============================================================================== */}
        {/* ABA 4: FATURAS & COMISSÕES (RECEITA DA PLATAFORMA) */}
        {/* ============================================================================== */}
        {activeTab === "invoices" && (
          <div className="space-y-4">
            <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/70 shadow-sm shadow-slate-200/50 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">
                    Faturas de Comissão Emitidas
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Histórico de comissões cobradas dos lojistas sobre as vendas
                    registradas.
                  </p>
                </div>

                <div className="flex items-center gap-3 text-xs bg-purple-50 p-3 rounded-2xl border border-purple-200/60 text-purple-950 font-bold">
                  <span>Comissão Arrecadada:</span>
                  <span className="text-sm font-extrabold text-purple-700">
                    {formatBRL(stats?.totalCommissionPaid ?? 0)}
                  </span>
                </div>
              </div>

              {invoices.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Nenhuma fatura de comissão foi gerada ainda. As faturas são geradas ao
                  fechamento dos ciclos semanais ou mensais das lojas.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 overflow-hidden border border-slate-200/60 rounded-2xl">
                  {invoices.map((inv) => (
                    <div
                      key={inv.id}
                      className="p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50 transition"
                    >
                      <div>
                        <p className="text-sm font-extrabold text-slate-900">
                          {inv.stores?.name || "Loja"}
                        </p>
                        <p className="text-xs text-slate-400 font-medium">
                          Período: {inv.period_start} até {inv.period_end}
                        </p>
                      </div>

                      <div className="flex items-center gap-4 text-xs">
                        <div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">
                            Vendas da Loja
                          </p>
                          <p className="font-extrabold text-slate-800">
                            {formatBRL(inv.total_sales)}
                          </p>
                        </div>

                        <div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">
                            Comissão Devida
                          </p>
                          <p className="font-extrabold text-purple-700">
                            {formatBRL(inv.commission_due)}
                          </p>
                        </div>

                        <span
                          className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
                            inv.status === "paid"
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : "bg-amber-50 text-amber-800 border border-amber-200"
                          }`}
                        >
                          {inv.status === "paid" ? "Paga" : "Aberta"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Modal de Confirmação de Exclusão de Loja */}
      {deleteConfirmStore && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Trash2 className="w-6 h-6 stroke-[2]" />
            </div>

            <div>
              <h3 className="text-lg font-extrabold text-slate-900">
                Excluir Loja Permanentemente?
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Você tem certeza que deseja excluir a loja{" "}
                <strong className="text-slate-800">{deleteConfirmStore.name}</strong> (
                <em>/{deleteConfirmStore.slug}</em>)? Esta ação apagará todos os
                produtos, fiados e vendas vinculados a ela.
              </p>
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                onClick={() => setDeleteConfirmStore(null)}
                disabled={deleting}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteStore}
                disabled={deleting}
                className="flex-1 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs transition shadow-md shadow-rose-600/20 active:scale-95 disabled:opacity-50"
              >
                {deleting ? "Excluindo..." : "Sim, Excluir Loja"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
