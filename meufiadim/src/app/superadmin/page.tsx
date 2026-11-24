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
  Plus,
  Pencil,
  KeyRound,
  Copy,
  X,
  Mail,
  Eye,
  EyeOff,
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
  owner_email?: string;
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
  >("stores");

  // Filtros de Lojas
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "blocked">("all");

  // Ações em Lojas
  const [savingStoreId, setSavingStoreId] = useState<string | null>(null);
  const [deleteConfirmStore, setDeleteConfirmStore] = useState<StoreItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Modal: Cadastrar Nova Loja
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingStore, setCreatingStore] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createSlug, setCreateSlug] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createWhatsapp, setCreateWhatsapp] = useState("");
  const [createPixKey, setCreatePixKey] = useState("");
  const [createPixCity, setCreatePixCity] = useState("BRASILIA");
  const [createCommission, setCreateCommission] = useState("5.0");
  const [createCycle, setCreateCycle] = useState<"weekly" | "monthly">("weekly");
  const [showPassword, setShowPassword] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{
    storeName: string;
    email: string;
    password: string;
    slug: string;
    loginUrl: string;
  } | null>(null);
  const [copiedCredentials, setCopiedCredentials] = useState(false);

  // Modal: Editar Loja Completa
  const [editingStore, setEditingStore] = useState<StoreItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editWhatsapp, setEditWhatsapp] = useState("");
  const [editPixKey, setEditPixKey] = useState("");
  const [editPixCity, setEditPixCity] = useState("");
  const [editCommission, setEditCommission] = useState("");
  const [editCycle, setEditCycle] = useState<"weekly" | "monthly">("weekly");
  const [editStatus, setEditStatus] = useState<"active" | "blocked">("active");
  const [savingEdit, setSavingEdit] = useState(false);

  // Modal: Redefinir Senha do Lojista
  const [resetPasswordStore, setResetPasswordStore] = useState<StoreItem | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);
  const [passwordResetSuccess, setPasswordResetSuccess] = useState<string | null>(null);

  // WhatsApp Central (Serviço Oficial)
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

  // Configurações de Recebimento Pix do SuperAdmin
  const [adminPixKey, setAdminPixKey] = useState("");
  const [adminPixName, setAdminPixName] = useState("MeuFiadim Plataforma");
  const [adminPixCity, setAdminPixCity] = useState("BRASILIA");
  const [adminWhatsapp, setAdminWhatsapp] = useState("");
  const [savingAdminSettings, setSavingAdminSettings] = useState(false);

  useEffect(() => {
    initDashboard();
  }, []);

  // Polling automático e inteligente da conexão do WhatsApp
  useEffect(() => {
    if (!authorized || activeTab !== "whatsapp") return;

    // Se não tiver QR code e não estiver conectado, faz uma busca imediata
    if (!zapConnected && !zapQR) {
      fetchZapStatus(false);
    }

    // Intervalo de verificação: a cada 3.5s se aguardando conexão/QR, ou a cada 25s se já conectado
    const intervalTime = zapConnected ? 25000 : 3500;
    const timer = setInterval(() => {
      fetchZapStatus(false);
    }, intervalTime);

    return () => clearInterval(timer);
  }, [authorized, activeTab, zapConnected, zapQR]);

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
      if (data.settings) {
        setAdminPixKey(data.settings.pix_key || "");
        setAdminPixName(data.settings.pix_name || "MeuFiadim Plataforma");
        setAdminPixCity(data.settings.pix_city || "BRASILIA");
        setAdminWhatsapp(data.settings.whatsapp || "");
      }
    } catch (err: any) {
      showToast(err.message, "error");
    }
  }

  async function handleSaveAdminSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!adminPixKey.trim()) {
      showToast("Informe a sua Chave Pix oficial.", "error");
      return;
    }

    try {
      setSavingAdminSettings(true);
      const token = await getAccessToken();
      if (!token) throw new Error("Sessão expirada.");

      const res = await fetch("/api/superadmin/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          pix_key: adminPixKey.trim(),
          pix_name: adminPixName.trim() || "MeuFiadim Plataforma",
          pix_city: adminPixCity.trim() || "BRASILIA",
          whatsapp: adminWhatsapp.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar configurações Pix.");

      showToast("Chave Pix oficial da plataforma atualizada com sucesso!");
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSavingAdminSettings(false);
    }
  }

  async function fetchZapStatus(showLoading = true) {
    try {
      if (showLoading) setZapLoading(true);
      setZapError(null);

      let data: any = null;

      // 1. Tenta buscar pela API Route interna
      try {
        const res = await fetch("/api/zap/qr", { cache: "no-store" });
        if (res.ok) {
          data = await res.json();
        }
      } catch (proxyErr) {
        console.warn("Proxy interno falhou:", proxyErr);
      }

      // 2. Se a rota interna não trouxe QR nem conexão, consulta diretamente o robô em nuvem do navegador
      if (!data || (!data.qrDataUrl && !data.connected)) {
        try {
          const directRes = await fetch("https://meufiadim-production.up.railway.app/api/qr-json", {
            headers: { "x-api-key": "minha-chave-secreta-meufiadim" },
            cache: "no-store",
          });
          if (directRes.ok) {
            const directData = await directRes.json();
            if (directData.qrDataUrl || directData.connected) {
              data = {
                configured: true,
                connected: !!directData.connected,
                qrDataUrl: directData.qrDataUrl || null,
              };
            }
          }
        } catch (directErr) {
          console.warn("Consulta direta também falhou:", directErr);
        }
      }

      if (!data) {
        setZapError("Não foi possível alcançar o serviço de mensagens. O robô está inicializando.");
        return;
      }

      if (!data.configured) {
        setZapConfigured(false);
        setZapConnected(false);
        setZapQR(null);
        return;
      }

      setZapConfigured(true);
      const wasConnected = zapConnected;
      const nowConnected = !!data.connected;

      setZapConnected(nowConnected);
      setZapQR(data.qrDataUrl || null);

      if (!wasConnected && nowConnected) {
        showToast("WhatsApp conectado com sucesso! O robô já está ativo.");
      }

      if (data.error && !data.connected && !data.qrDataUrl) {
        setZapError(data.error);
      } else {
        setZapError(null);
      }
    } catch {
      setZapError("Serviço de WhatsApp temporariamente inacessível.");
    } finally {
      if (showLoading) setZapLoading(false);
    }
  }

  async function handleDisconnectZap() {
    if (
      !confirm(
        "Atenção: Desconectar o WhatsApp central vai interromper os disparos automáticos de cobrança de todas as lojas até que você reconecte. Deseja continuar?"
      )
    ) {
      return;
    }

    try {
      setDisconnectingZap(true);
      let res = await fetch("/api/zap/disconnect", { method: "POST" });
      if (!res.ok) {
        res = await fetch("https://meufiadim-production.up.railway.app/api/disconnect", {
          method: "POST",
          headers: { "x-api-key": "minha-chave-secreta-meufiadim" },
        });
      }
      setZapConnected(false);
      setZapQR(null);
      showToast("WhatsApp desconectado com sucesso!");
      setTimeout(() => fetchZapStatus(true), 2000);
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

  function generateRandomPassword() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    let pass = "";
    for (let i = 0; i < 8; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `Fiad@${pass}`;
  }

  function handleOpenCreateModal() {
    setCreateName("");
    setCreateSlug("");
    setCreateEmail("");
    setCreatePassword(generateRandomPassword());
    setCreateWhatsapp("");
    setCreatePixKey("");
    setCreatePixCity("BRASILIA");
    setCreateCommission("5.0");
    setCreateCycle("weekly");
    setCreatedCredentials(null);
    setCopiedCredentials(false);
    setShowCreateModal(true);
  }

  function handleNameChange(name: string) {
    setCreateName(name);
    const suggested = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    setCreateSlug(suggested);
  }

  async function handleCreateStoreSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!createName.trim() || !createSlug.trim() || !createEmail.trim() || !createPassword.trim()) {
      showToast("Preencha todos os campos obrigatórios.", "error");
      return;
    }

    try {
      setCreatingStore(true);
      const token = await getAccessToken();
      if (!token) throw new Error("Sessão expirada.");

      const res = await fetch("/api/superadmin/stores/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: createName.trim(),
          slug: createSlug.trim(),
          email: createEmail.trim(),
          password: createPassword.trim(),
          whatsapp: createWhatsapp.trim(),
          pix_key: createPixKey.trim() || null,
          pix_city: createPixCity.trim() || "BRASILIA",
          commission_rate: Number(createCommission) || 5.0,
          billing_cycle: createCycle,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Falha ao criar loja.");
      }

      setCreatedCredentials({
        storeName: data.store.name,
        email: data.credentials.email,
        password: data.credentials.password,
        slug: data.store.slug,
        loginUrl: `${window.location.origin}/login`,
      });

      showToast(`Loja "${data.store.name}" criada com sucesso!`);
      await loadPlatformData();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setCreatingStore(false);
    }
  }

  function handleCopyCredentials() {
    if (!createdCredentials) return;
    const text = `🎉 *Sua loja no MeuFiadim está pronta!*\n\n🏪 *Loja:* ${createdCredentials.storeName}\n🔗 *Vitrine Pública:* ${window.location.origin}/${createdCredentials.slug}\n\n🔐 *Acesso ao seu Painel de Vendas:*\n👉 Link: ${createdCredentials.loginUrl}\n📧 E-mail: ${createdCredentials.email}\n🔑 Senha: ${createdCredentials.password}\n\nEntre no link acima, anote seus clientes de fiado e configure sua Chave Pix para receber automático!`;
    navigator.clipboard.writeText(text);
    setCopiedCredentials(true);
    setTimeout(() => setCopiedCredentials(false), 3000);
  }

  function handleOpenEditModal(store: StoreItem) {
    setEditingStore(store);
    setEditName(store.name);
    setEditSlug(store.slug);
    setEditWhatsapp(store.whatsapp || "");
    setEditPixKey(store.pix_key || "");
    setEditPixCity(store.pix_city || "BRASILIA");
    setEditCommission(String(store.commission_rate));
    setEditCycle(store.billing_cycle);
    setEditStatus(store.status);
  }

  async function handleSaveEditStore(e: React.FormEvent) {
    e.preventDefault();
    if (!editingStore) return;

    try {
      setSavingEdit(true);
      const token = await getAccessToken();
      if (!token) throw new Error("Sessão expirada.");

      const res = await fetch("/api/superadmin/store", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          storeId: editingStore.id,
          patch: {
            name: editName.trim(),
            slug: editSlug.trim(),
            whatsapp: editWhatsapp.replace(/\D/g, ""),
            pix_key: editPixKey.trim() || null,
            pix_city: editPixCity.trim() || "BRASILIA",
            commission_rate: Number(editCommission) || 5.0,
            billing_cycle: editCycle,
            status: editStatus,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar alterações.");

      showToast("Dados da loja atualizados com sucesso!");
      setEditingStore(null);
      await loadPlatformData();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSavingEdit(false);
    }
  }

  function handleOpenResetPasswordModal(store: StoreItem) {
    setResetPasswordStore(store);
    setNewPassword(generateRandomPassword());
    setPasswordResetSuccess(null);
  }

  async function handleResetPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!resetPasswordStore || !newPassword.trim()) return;

    try {
      setResettingPassword(true);
      const token = await getAccessToken();
      if (!token) throw new Error("Sessão expirada.");

      const res = await fetch("/api/superadmin/stores/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ownerId: resetPasswordStore.owner_id,
          newPassword: newPassword.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao redefinir senha.");

      setPasswordResetSuccess(newPassword.trim());
      showToast("Senha redefinida com sucesso!");
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setResettingPassword(false);
    }
  }

  async function handleQuickToggleStatus(id: string, currentStatus: "active" | "blocked") {
    const newStatus = currentStatus === "active" ? "blocked" : "active";
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
        body: JSON.stringify({
          storeId: id,
          patch: { status: newStatus },
        }),
      });

      if (!res.ok) throw new Error("Falha ao alterar status.");

      showToast(newStatus === "active" ? "Loja ativada!" : "Loja bloqueada!");
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
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        s.name.toLowerCase().includes(q) ||
        s.slug.toLowerCase().includes(q) ||
        (s.whatsapp || "").includes(q) ||
        (s.owner_email || "").toLowerCase().includes(q);

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
            {/* Botão Principal: Nova Loja */}
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-extrabold shadow-md shadow-purple-600/25 hover:shadow-purple-600/40 hover:-translate-y-0.5 active:scale-[0.98] transition-all"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Nova Loja</span>
            </button>

            {/* Status rápido do WhatsApp */}
            <button
              onClick={() => setActiveTab("whatsapp")}
              className={`hidden md:inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition ${
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
            onClick={() => setActiveTab("overview")}
            className={`flex-1 min-w-[140px] py-2.5 px-4 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-all duration-150 ${
              activeTab === "overview"
                ? "bg-purple-600 text-white shadow-md shadow-purple-600/25"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Visão Geral & Métricas</span>
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
        {/* ABA: GESTÃO DE LOJAS (TENANTS) */}
        {/* ============================================================================== */}
        {activeTab === "stores" && (
          <div className="space-y-4">
            {/* Barra Superior: Busca, Filtros e Ação de Nova Loja */}
            <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/70 shadow-sm shadow-slate-200/50 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3.5">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por nome, slug, e-mail ou WhatsApp..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between md:justify-end gap-2.5">
                <div className="flex items-center gap-1.5">
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

                <button
                  onClick={handleOpenCreateModal}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-extrabold shadow-sm active:scale-95 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Cadastrar Loja
                </button>
              </div>
            </div>

            {/* Lista de Lojas */}
            <div className="space-y-3">
              {filteredStores.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/70 shadow-xs space-y-4">
                  <div className="w-14 h-14 rounded-3xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto shadow-xs">
                    <Store className="w-7 h-7 stroke-[1.75]" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      Nenhuma loja cadastrada na plataforma
                    </h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                      Você pode adicionar a primeira loja parceira agora mesmo com e-mail,
                      senha e dados de WhatsApp.
                    </p>
                  </div>
                  <button
                    onClick={handleOpenCreateModal}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs sm:text-sm font-extrabold shadow-lg shadow-purple-600/25 hover:shadow-purple-600/40 hover:-translate-y-0.5 active:scale-95 transition"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    Cadastrar Primeira Loja
                  </button>
                </div>
              ) : (
                filteredStores.map((s) => (
                  <div
                    key={s.id}
                    className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/70 shadow-sm shadow-slate-200/50 hover:shadow-md transition-all space-y-4"
                  >
                    {/* Linha 1: Dados da Loja + Status */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5">
                          <h4 className="text-base sm:text-lg font-extrabold text-slate-900">
                            {s.name}
                          </h4>
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
                              s.status === "active"
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                : "bg-rose-50 text-rose-800 border border-rose-200"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                s.status === "active" ? "bg-emerald-500" : "bg-rose-500"
                              }`}
                            />
                            {s.status === "active" ? "Ativa" : "Bloqueada"}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 font-medium">
                          <a
                            href={`/${s.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-purple-700 font-extrabold hover:underline"
                            title="Abrir vitrine pública"
                          >
                            <span>/{s.slug}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>

                          <span>•</span>
                          <span className="flex items-center gap-1 text-slate-700 font-semibold">
                            <Mail className="w-3 h-3 text-slate-400" />
                            {s.owner_email || "Sem e-mail"}
                          </span>

                          <span>•</span>
                          <span>WhatsApp: {s.whatsapp || "Não cadastrado"}</span>

                          {s.pix_key && (
                            <>
                              <span>•</span>
                              <span className="font-mono text-emerald-700 font-bold">
                                Pix: {s.pix_key}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Métricas Rápidas da Loja */}
                      <div className="flex items-center gap-3.5 text-xs bg-slate-50 p-2.5 px-4 rounded-2xl border border-slate-200/60 shrink-0">
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

                    {/* Linha 2: Ações & Gerenciamento Avançado */}
                    <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2.5 text-xs">
                        <span className="bg-purple-50 text-purple-900 font-bold px-3 py-1.5 rounded-xl border border-purple-200/60">
                          Comissão: <strong>{s.commission_rate}%</strong>
                        </span>
                        <span className="bg-slate-100 text-slate-700 font-semibold px-3 py-1.5 rounded-xl">
                          Ciclo: {s.billing_cycle === "weekly" ? "Semanal" : "Mensal"}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* Editar Loja */}
                        <button
                          onClick={() => handleOpenEditModal(s)}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold transition active:scale-95 flex items-center gap-1.5"
                          title="Editar dados da loja"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Editar
                        </button>

                        {/* Redefinir Senha */}
                        <button
                          onClick={() => handleOpenResetPasswordModal(s)}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-amber-50 hover:text-amber-800 text-slate-700 text-xs font-extrabold transition active:scale-95 flex items-center gap-1.5"
                          title="Redefinir senha de acesso do lojista"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          Senha
                        </button>

                        {/* Bloquear / Liberar */}
                        <button
                          onClick={() => handleQuickToggleStatus(s.id, s.status)}
                          disabled={savingStoreId === s.id}
                          className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition active:scale-95 shadow-xs flex items-center gap-1.5 ${
                            s.status === "active"
                              ? "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200"
                              : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200"
                          }`}
                        >
                          {s.status === "active" ? (
                            <>
                              <Lock className="w-3.5 h-3.5" />
                              Bloquear
                            </>
                          ) : (
                            <>
                              <Unlock className="w-3.5 h-3.5" />
                              Liberar
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
        {/* ABA: VISÃO GERAL (OVERVIEW) */}
        {/* ============================================================================== */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Banner de Boas-Vindas */}
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
                  volume financeiro, comissões acumuladas e opera o robô oficial de WhatsApp.
                </p>
              </div>
            </div>

            {/* Grid de Métricas Principais (KPIs Globais) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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

            {/* Destaque Robô Central + Receita */}
            <div className="grid lg:grid-cols-3 gap-4">
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
                      Robô Central de Cobranças
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
                    onClick={() => fetchZapStatus(true)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Atualizar Status
                  </button>
                </div>
              </div>

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
        {/* ABA: WHATSAPP CENTRAL */}
        {/* ============================================================================== */}
        {activeTab === "whatsapp" && (
          <div className="space-y-6">
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
                    Este é o robô único do <strong>meufiadim</strong>. Todos os lojistas contam com este número para disparar as
                    cobranças de fiado com o Pix Copia e Cola diretamente para os clientes.
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
                        Disparos manuais e automáticos agendados para às 09:00 estão ativos para todas as lojas.
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-wrap gap-2.5">
                    <button
                      onClick={() => fetchZapStatus(true)}
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
                        Variables com a URL do seu serviço de mensagens.
                      </p>
                    </div>
                  )}

                  <div className="bg-slate-50 rounded-3xl p-6 sm:p-8 border border-slate-200/80 text-center space-y-4">
                    {zapLoading && !zapQR ? (
                      <div className="py-12 space-y-3">
                        <RefreshCw className="w-8 h-8 text-purple-600 animate-spin mx-auto" />
                        <p className="text-sm font-extrabold text-slate-800">
                          Gerando QR Code de Conexão...
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
                        <div className="w-16 h-16 rounded-3xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto shadow-xs">
                          <Smartphone className="w-8 h-8 animate-pulse" />
                        </div>
                        <div>
                          <p className="text-sm font-extrabold text-slate-800">
                            Aguardando geração do QR Code...
                          </p>
                          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-0.5">
                            O robô oficial do WhatsApp está sendo consultado automaticamente.
                          </p>
                        </div>
                        {zapError && (
                          <div className="max-w-md mx-auto p-3 bg-rose-50 text-rose-700 border border-rose-200/80 rounded-2xl text-xs font-semibold text-center">
                            {zapError}
                          </div>
                        )}
                        <button
                          onClick={() => fetchZapStatus(true)}
                          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-extrabold shadow-md shadow-purple-600/25 active:scale-95 transition"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Gerar QR Code Agora
                        </button>
                      </div>
                    )}

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
                      onClick={() => fetchZapStatus(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition active:scale-95"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Atualizar QR Code
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Teste de Disparo em Tempo Real */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/70 shadow-sm shadow-slate-200/50 space-y-4">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">
                  Teste de Envio em Tempo Real
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  Envie uma mensagem de teste para o seu próprio celular para comprovar que o robô central está entregando perfeitamente.
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
        {/* ABA: FATURAS & COMISSÕES */}
        {/* ============================================================================== */}
        {activeTab === "invoices" && (
          <div className="space-y-6">
            {/* Card Principal: Configuração da Chave Pix do SuperAdmin */}
            <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/70 shadow-sm shadow-slate-200/50 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-purple-500/25">
                    <KeyRound className="w-6 h-6 stroke-[2]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-extrabold text-slate-900">
                        Chave Pix Oficial da Plataforma
                      </h3>
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Recebimento de Comissões
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Esta é a conta bancária para onde os lojistas farão o pagamento da comissão das vendas.
                    </p>
                  </div>
                </div>

                {adminPixKey ? (
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Pix Ativo para Cobrança</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span>Pendente de Configuração</span>
                  </div>
                )}
              </div>

              {/* Formulário de Configuração Pix */}
              <form onSubmit={handleSaveAdminSettings} className="space-y-4 pt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 block">
                      Sua Chave Pix (CPF, CNPJ, Celular, E-mail ou Aleatória) *
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 123.456.789-00 ou financeiro@meufiadim.com"
                      value={adminPixKey}
                      onChange={(e) => setAdminPixKey(e.target.value)}
                      required
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 block">
                      Nome do Titular da Conta (para conferência do lojista) *
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Leonardo Agência / MeuFiadim"
                      value={adminPixName}
                      onChange={(e) => setAdminPixName(e.target.value)}
                      required
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 block">
                      Cidade da Conta Bancária (padrão Bacen)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: BELO HORIZONTE ou BRASILIA"
                      value={adminPixCity}
                      onChange={(e) => setAdminPixCity(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 block">
                      WhatsApp para Receber Comprovantes
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 31988943288"
                      value={adminWhatsapp}
                      onChange={(e) => setAdminWhatsapp(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                  <p className="text-xs text-slate-500">
                    Ao salvar, o robô e o painel do lojista passarão a gerar automaticamente o QR Code e o Pix Copia e Cola para esta chave.
                  </p>
                  <button
                    type="submit"
                    disabled={savingAdminSettings}
                    className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-2xl text-xs sm:text-sm font-extrabold shadow-md shadow-purple-600/25 active:scale-95 transition shrink-0 disabled:opacity-60"
                  >
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>{savingAdminSettings ? "Salvando..." : "Salvar Chave Pix da Plataforma"}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Faturas de Comissão */}
            <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/70 shadow-sm shadow-slate-200/50 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">
                    Faturas de Comissão Emitidas
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Histórico de comissões cobradas dos lojistas sobre as vendas registradas.
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
                  Nenhuma fatura de comissão foi gerada ainda. As faturas são geradas ao fechamento dos ciclos semanais ou mensais das lojas.
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

      {/* ============================================================================== */}
      {/* MODAL 1: CADASTRAR NOVA LOJA */}
      {/* ============================================================================== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-[32px] p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 space-y-5 my-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center">
                  <Store className="w-5 h-5 stroke-[2]" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">
                    Cadastrar Nova Loja
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    Crie uma loja parceira e defina as credenciais de acesso do lojista
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createdCredentials ? (
              /* Sucesso: Exibe Credenciais Prontas para Enviar no WhatsApp */
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800 font-extrabold text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Loja criada com sucesso!
                  </div>
                  <p className="text-xs text-emerald-700 font-medium">
                    Copie a mensagem abaixo e envie diretamente no WhatsApp do comerciante para que ele possa entrar no painel.
                  </p>
                </div>

                <div className="bg-slate-900 text-white p-4 rounded-2xl space-y-2 font-mono text-xs">
                  <p className="text-slate-400 font-bold">CREDENCIAIS DE ACESSO:</p>
                  <p>🏪 Loja: <span className="text-purple-300">{createdCredentials.storeName}</span></p>
                  <p>🔗 Vitrine: <span className="text-emerald-400">meufiadim.com/{createdCredentials.slug}</span></p>
                  <p>📧 E-mail: <span className="text-white font-bold">{createdCredentials.email}</span></p>
                  <p>🔑 Senha: <span className="text-amber-300 font-bold">{createdCredentials.password}</span></p>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={handleCopyCredentials}
                    className="flex-1 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold text-xs flex items-center justify-center gap-2 transition shadow-md shadow-emerald-600/25"
                  >
                    {copiedCredentials ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedCredentials ? "Copiado para a Área de Transferência!" : "Copiar Dados de Acesso (WhatsApp)"}</span>
                  </button>

                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs transition"
                  >
                    Concluir
                  </button>
                </div>
              </div>
            ) : (
              /* Formulário de Cadastro */
              <form onSubmit={handleCreateStoreSubmit} className="space-y-4 text-xs">
                {/* Nome e Slug */}
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Nome da Loja *</label>
                    <input
                      type="text"
                      placeholder="Ex: Mercadinho do Bairro"
                      value={createName}
                      onChange={(e) => handleNameChange(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Link da Vitrine (Slug) *</label>
                    <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-purple-500 focus-within:bg-white">
                      <span className="pl-3 text-slate-400 font-bold">/</span>
                      <input
                        type="text"
                        placeholder="mercadinho-bairro"
                        value={createSlug}
                        onChange={(e) => setCreateSlug(e.target.value)}
                        required
                        className="w-full px-2 py-2.5 bg-transparent font-semibold text-slate-900 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* E-mail e Senha */}
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">E-mail do Lojista (Login) *</label>
                    <input
                      type="email"
                      placeholder="lojista@gmail.com"
                      value={createEmail}
                      onChange={(e) => setCreateEmail(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-700">Senha Inicial *</label>
                      <button
                        type="button"
                        onClick={() => setCreatePassword(generateRandomPassword())}
                        className="text-[10px] text-purple-600 font-extrabold hover:underline"
                      >
                        Gerar Automática
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={createPassword}
                        onChange={(e) => setCreatePassword(e.target.value)}
                        required
                        className="w-full pl-3.5 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* WhatsApp e Pix */}
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">WhatsApp da Loja</label>
                    <input
                      type="tel"
                      placeholder="DDD + Número (ex: 31988887777)"
                      value={createWhatsapp}
                      onChange={(e) => setCreateWhatsapp(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Chave Pix do Lojista</label>
                    <input
                      type="text"
                      placeholder="CPF, CNPJ, Telefone ou E-mail"
                      value={createPixKey}
                      onChange={(e) => setCreatePixKey(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition"
                    />
                  </div>
                </div>

                {/* Comissão e Ciclo */}
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Taxa de Comissão (%)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={createCommission}
                      onChange={(e) => setCreateCommission(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">Ciclo de Cobrança</label>
                    <select
                      value={createCycle}
                      onChange={(e) => setCreateCycle(e.target.value as "weekly" | "monthly")}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition"
                    >
                      <option value="weekly">Semanal</option>
                      <option value="monthly">Mensal</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={creatingStore}
                    className="flex-1 py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-95 disabled:bg-slate-300 text-white font-extrabold text-xs transition shadow-md shadow-purple-600/25"
                  >
                    {creatingStore ? "Criando Loja..." : "Cadastrar e Ativar Loja"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* MODAL 2: EDITAR LOJA COMPLETA */}
      {/* ============================================================================== */}
      {editingStore && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-[32px] p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 space-y-5 my-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center">
                  <Pencil className="w-5 h-5 stroke-[2]" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">
                    Editar Dados da Loja
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    {editingStore.name} ({editingStore.owner_email})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingStore(null)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditStore} className="space-y-4 text-xs">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Nome da Loja</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Link da Vitrine (Slug)</label>
                  <input
                    type="text"
                    value={editSlug}
                    onChange={(e) => setEditSlug(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">WhatsApp da Loja</label>
                  <input
                    type="tel"
                    value={editWhatsapp}
                    onChange={(e) => setEditWhatsapp(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Chave Pix</label>
                  <input
                    type="text"
                    value={editPixKey}
                    onChange={(e) => setEditPixKey(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Comissão (%)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={editCommission}
                    onChange={(e) => setEditCommission(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Ciclo</label>
                  <select
                    value={editCycle}
                    onChange={(e) => setEditCycle(e.target.value as "weekly" | "monthly")}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition"
                  >
                    <option value="weekly">Semanal</option>
                    <option value="monthly">Mensal</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as "active" | "blocked")}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition"
                  >
                    <option value="active">Ativa</option>
                    <option value="blocked">Bloqueada</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEditingStore(null)}
                  className="flex-1 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="flex-1 py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-95 disabled:bg-slate-300 text-white font-extrabold text-xs transition shadow-md shadow-purple-600/25"
                >
                  {savingEdit ? "Salvando..." : "Salvar Alterações"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* MODAL 3: REDEFINIR SENHA DO LOJISTA */}
      {/* ============================================================================== */}
      {resetPasswordStore && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center">
                <KeyRound className="w-5 h-5 stroke-[2]" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">
                  Redefinir Senha do Lojista
                </h3>
                <p className="text-xs text-slate-400 font-medium">
                  {resetPasswordStore.owner_email || resetPasswordStore.name}
                </p>
              </div>
            </div>

            {passwordResetSuccess ? (
              <div className="space-y-4 text-xs">
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-800 space-y-1">
                  <p className="font-extrabold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Nova senha aplicada com sucesso!
                  </p>
                  <p className="text-slate-600 font-mono pt-1 text-sm font-bold">
                    {passwordResetSuccess}
                  </p>
                </div>

                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `Olá! Sua nova senha de acesso ao painel do MeuFiadim é: ${passwordResetSuccess}\nLink: ${window.location.origin}/login`
                    );
                    showToast("Nova senha copiada para enviar no WhatsApp!");
                    setResetPasswordStore(null);
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs transition active:scale-95 flex items-center justify-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Copiar Senha para Enviar no WhatsApp
                </button>
              </div>
            ) : (
              <form onSubmit={handleResetPasswordSubmit} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-700">Nova Senha</label>
                    <button
                      type="button"
                      onClick={() => setNewPassword(generateRandomPassword())}
                      className="text-[10px] text-purple-600 font-extrabold hover:underline"
                    >
                      Gerar Nova Senha
                    </button>
                  </div>
                  <input
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition"
                  />
                  <p className="text-[11px] text-slate-400">
                    O lojista poderá entrar no painel imediatamente com esta nova senha.
                  </p>
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setResetPasswordStore(null)}
                    className="flex-1 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={resettingPassword || !newPassword.trim()}
                    className="flex-1 py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 disabled:bg-slate-300 text-white font-extrabold text-xs transition shadow-md shadow-amber-600/25"
                  >
                    {resettingPassword ? "Atualizando..." : "Aplicar Nova Senha"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* MODAL 4: CONFIRMAÇÃO DE EXCLUSÃO DE LOJA */}
      {/* ============================================================================== */}
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
                <em>/{deleteConfirmStore.slug}</em>)? Esta ação apagará todos os produtos, fiados e vendas vinculados a ela.
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
