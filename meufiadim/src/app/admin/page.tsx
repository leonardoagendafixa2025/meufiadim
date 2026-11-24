"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Users,
  Package,
  Receipt,
  Plus,
  MessageCircle,
  Copy,
  Check,
  LogOut,
  TrendingUp,
  ArrowUpRight,
  ArrowDownLeft,
  Trash2,
  X,
  QrCode,
  ExternalLink,
  AlertCircle,
  RefreshCw,
  Smartphone,
  CheckCircle2,
  ShieldCheck,
  Shield,
  Zap,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatBRL } from "@/lib/whatsapp";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { generatePixCopiaECola } from "@/lib/pix";

interface Store {
  id: string;
  name: string;
  slug: string;
  whatsapp: string;
  commission_rate: number;
  billing_cycle: "weekly" | "monthly";
  status: "active" | "blocked";
  pix_key?: string | null;
  pix_city?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  stock: number;
  image_url?: string;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  credit_limit: number;
  balance: number;
  due_date?: string | null;
  notify_date?: string | null;
}

interface Sale {
  id: string;
  total_amount: number;
  commission_amount: number;
  payment_method: string;
  created_at: string;
}

const PRESET_COLORS = [
  "#059669",
  "#2563EB",
  "#7C3AED",
  "#DB2777",
  "#DC2626",
  "#EA580C",
  "#111827",
];

export default function AdminDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);

  const [tab, setTab] = useState<"fiado" | "produtos" | "whatsapp" | "fatura">("fiado");
  const [copied, setCopied] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [uploadingImg, setUploadingImg] = useState(false);

  // Status de Expediente da Loja (Aberta / Fechada)
  const [isOpen, setIsOpen] = useState(true);
  const [togglingOpen, setTogglingOpen] = useState(false);

  // WhatsApp Baileys State (QR Code dentro do Admin)
  const [zapConnected, setZapConnected] = useState(false);
  const [zapQR, setZapQR] = useState<string | null>(null);
  const [zapLoading, setZapLoading] = useState(false);
  const [zapConfigured, setZapConfigured] = useState(true);
  const [zapError, setZapError] = useState<string | null>(null);
  const [disconnectingZap, setDisconnectingZap] = useState(false);

  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [txModal, setTxModal] = useState<{
    customer: Customer;
    type: "compra" | "pagamento";
  } | null>(null);
  const [chargeModal, setChargeModal] = useState<Customer | null>(null);
  const [copiedPixCode, setCopiedPixCode] = useState(false);

  // Forms
  const [cName, setCName] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [cLimit, setCLimit] = useState("200");

  const [txAmount, setTxAmount] = useState("");
  const [txDueDate, setTxDueDate] = useState("");
  const [txNotifyDate, setTxNotifyDate] = useState("");

  const [pName, setPName] = useState("");
  const [pDesc, setPDesc] = useState("");
  const [pPrice, setPPrice] = useState("");
  const [pCat, setPCat] = useState("Geral");
  const [pStock, setPStock] = useState("10");
  const [pImg, setPImg] = useState("");

  // Pix do lojista
  const [pixKey, setPixKey] = useState("");
  const [pixCity, setPixCity] = useState("BRASILIA");
  const [savingPix, setSavingPix] = useState(false);

  // Aparência (Logo + Cor)
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#059669");
  const [savingTheme, setSavingTheme] = useState(false);

  // Mercado Pago (Fatura)
  const [mpPix, setMpPix] = useState<{
    qrCodeBase64: string;
    qrCode: string;
    adminPixKey?: string;
    adminPixName?: string;
    adminWhatsapp?: string;
  } | null>(null);
  const [loadingMp, setLoadingMp] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const email = (user.email || "").toLowerCase().trim();
    const superAdmins = [
      "toyesterdayagencia@gmail.com",
      (process.env.NEXT_PUBLIC_SUPERADMIN_EMAIL || "").toLowerCase().trim(),
    ].filter(Boolean);

    if (superAdmins.includes(email)) {
      router.replace("/superadmin");
      return;
    }

    const { data: storeData } = await supabase
      .from("stores")
      .select("*")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!storeData) {
      router.push("/login");
      return;
    }

    setStore(storeData);
    setPixKey(storeData.pix_key || "");
    setPixCity(storeData.pix_city || "BRASILIA");
    setLogoUrl(storeData.logo_url || "");
    setPrimaryColor(storeData.primary_color || "#059669");

    const openState = user.user_metadata?.is_open;
    setIsOpen(openState !== undefined ? Boolean(openState) : true);

    const [prodRes, custRes, salesRes] = await Promise.all([
      supabase
        .from("products")
        .select("*")
        .eq("store_id", storeData.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("customers")
        .select("*")
        .eq("store_id", storeData.id)
        .order("balance", { ascending: false }),
      supabase
        .from("sales")
        .select("*")
        .eq("store_id", storeData.id)
        .order("created_at", { ascending: false }),
    ]);

    setProducts(prodRes.data || []);
    setCustomers(custRes.data || []);
    setSales(salesRes.data || []);
    setLoading(false);
    fetchZapStatus();
  }

  const fetchZapStatus = async () => {
    try {
      setZapLoading(true);
      const res = await fetch("/api/zap/qr", { cache: "no-store" });
      const data = await res.json();
      setZapConfigured(data.configured !== false);
      setZapConnected(!!data.connected);
      setZapQR(data.qrDataUrl || null);
      setZapError(data.error || null);
    } catch {
      setZapError("Não foi possível verificar status do WhatsApp.");
    } finally {
      setZapLoading(false);
    }
  };

  useEffect(() => {
    let interval: any;
    if (tab === "whatsapp" && !zapConnected) {
      interval = setInterval(fetchZapStatus, 4000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [tab, zapConnected]);

  const handleDisconnectZap = async () => {
    if (!confirm("Deseja desconectar o WhatsApp do robô de cobrança?")) return;
    setDisconnectingZap(true);
    try {
      const res = await fetch("/api/zap/disconnect", { method: "POST" });
      if (!res.ok) throw new Error("Falha ao desconectar");
      setZapConnected(false);
      setZapQR(null);
      await fetchZapStatus();
      alert("WhatsApp desconectado com sucesso.");
    } catch (err: any) {
      alert(err.message || "Erro ao desconectar WhatsApp.");
    } finally {
      setDisconnectingZap(false);
    }
  };

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    onSuccess: (url: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImg(true);
    try {
      const url = await uploadToCloudinary(file);
      onSuccess(url);
    } catch (err: any) {
      alert(err.message || "Falha ao subir imagem.");
    } finally {
      setUploadingImg(false);
    }
  };

  const handleCopyLink = () => {
    if (!store) return;
    const url = `${window.location.origin}/${store.slug}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store || !cName.trim() || !cPhone.trim()) return;

    await supabase.from("customers").insert({
      store_id: store.id,
      name: cName.trim(),
      phone: cPhone.replace(/\D/g, ""),
      credit_limit: Number(cLimit) || 0,
      balance: 0,
    });

    setCName("");
    setCPhone("");
    setCLimit("200");
    setShowNewCustomer(false);
    loadDashboard();
  };

  const handleTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store || !txModal || !txAmount) return;

    const amount = Number(txAmount.replace(",", "."));
    if (amount <= 0) return;

    const { customer, type } = txModal;
    const nextBalance =
      type === "compra"
        ? Number((customer.balance + amount).toFixed(2))
        : Math.max(0, Number((customer.balance - amount).toFixed(2)));

    await supabase
      .from("customers")
      .update({
        balance: nextBalance,
        due_date:
          type === "compra"
            ? txDueDate || customer.due_date || null
            : nextBalance === 0
            ? null
            : customer.due_date,
        notify_date:
          type === "compra"
            ? txNotifyDate || txDueDate || customer.notify_date || null
            : nextBalance === 0
            ? null
            : customer.notify_date,
      })
      .eq("id", customer.id);

    if (type === "compra") {
      const commission = Number(
        ((amount * store.commission_rate) / 100).toFixed(2)
      );
      await supabase.from("sales").insert({
        store_id: store.id,
        customer_id: customer.id,
        total_amount: amount,
        commission_amount: commission,
        payment_method: "Fiado",
      });
    }

    setTxAmount("");
    setTxDueDate("");
    setTxNotifyDate("");
    setTxModal(null);
    loadDashboard();
  };

  const handleSendCharge = async (customer: Customer) => {
    setSendingId(customer.id);
    try {
      const res = await fetch("/api/cobrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: customer.name,
          phone: customer.phone,
          balance: customer.balance,
          dueDate: customer.due_date,
          storeName: store?.name,
          pixKey: store?.pix_key,
          pixCity: store?.pix_city,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(`Erro ao enviar: ${data.error || "serviço de mensagens indisponível"}`);
        return;
      }

      alert(`Cobrança enviada no WhatsApp de ${customer.name}!`);
    } catch {
      alert("Não foi possível conectar ao servidor de cobrança.");
    } finally {
      setSendingId(null);
    }
  };

  const handleOpenMyWhatsApp = (customer: Customer) => {
    if (!customer.phone) return;
    const cleanPhone = customer.phone.replace(/\D/g, "");
    const formattedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
    const formattedBalance = formatBRL(customer.balance);
    const formattedDate = customer.due_date
      ? new Date(`${customer.due_date}T12:00:00`).toLocaleDateString("pt-BR")
      : null;

    let pixCode = "";
    if (store?.pix_key) {
      try {
        pixCode = generatePixCopiaECola({
          pixKey: store.pix_key,
          merchantName: store.name || "MEUFIADIM",
          merchantCity: store.pix_city || "BRASIL",
          amount: Number(customer.balance),
        });
      } catch (e) {
        console.warn("Erro ao gerar Pix:", e);
      }
    }

    const lines = [
      `Olá, ${customer.name}! Tudo bem?`,
      `Passando para lembrar do seu fiado em aberto na *${store?.name || "nossa loja"}*:`,
      ``,
      `💰 *Valor em aberto:* ${formattedBalance}`,
    ];

    if (formattedDate) {
      lines.push(`📅 *Data final de pagamento:* ${formattedDate}`);
    }

    if (pixCode) {
      lines.push(
        ``,
        `🔑 *Chave Pix:* ${store?.pix_key}`,
        ``,
        `*Pix Copia e Cola:*`,
        pixCode
      );
    } else if (store?.pix_key) {
      lines.push(``, `🔑 *Chave Pix:* ${store.pix_key}`);
    } else {
      lines.push(``, `Quando puder fazer o acerto, é só me responder por aqui. Obrigado!`);
    }

    const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(lines.join("\n"))}`;
    window.open(url, "_blank");
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store || !pName.trim() || !pPrice) return;

    await supabase.from("products").insert({
      store_id: store.id,
      name: pName.trim(),
      description: pDesc.trim(),
      price: Number(pPrice.replace(",", ".")),
      category: pCat.trim() || "Geral",
      stock: Number(pStock) || 0,
      image_url: pImg.trim() || null,
    });

    setPName("");
    setPDesc("");
    setPPrice("");
    setPImg("");
    setShowNewProduct(false);
    loadDashboard();
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm("Excluir este produto?")) return;
    await supabase.from("products").delete().eq("id", id);
    loadDashboard();
  };

  const handleSavePix = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store) return;
    setSavingPix(true);
    await supabase
      .from("stores")
      .update({ pix_key: pixKey.trim(), pix_city: pixCity.trim() || "BRASILIA" })
      .eq("id", store.id);
    setSavingPix(false);
    alert("Chave Pix salva! Suas cobranças no Zap já vão com o botão Copiar Pix.");
    loadDashboard();
  };

  const handleSaveTheme = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store) return;
    setSavingTheme(true);
    await supabase
      .from("stores")
      .update({
        logo_url: logoUrl.trim() || null,
        primary_color: primaryColor,
      })
      .eq("id", store.id);
    setSavingTheme(false);
    alert("Visual da vitrine atualizado!");
    loadDashboard();
  };

  const handleToggleOpen = async () => {
    if (!store) return;
    setTogglingOpen(true);
    try {
      const nextState = !isOpen;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      const res = await fetch("/api/store/status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_open: nextState }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao atualizar status da loja");

      setIsOpen(nextState);
      alert(
        nextState
          ? "🟢 Loja ABERTA com sucesso! Seus clientes já podem enviar pedidos na vitrine."
          : "🔴 Loja FECHADA com sucesso! A vitrine agora exibe o aviso de fechamento."
      );
    } catch (err: any) {
      alert(err.message);
    } finally {
      setTogglingOpen(false);
    }
  };

  const handlePayInvoice = async () => {
    if (!store || totalCommissionDue <= 0) return;
    setLoadingMp(true);
    try {
      const res = await fetch("/api/mercadopago/pix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: store.id,
          storeName: store.name,
          amount: totalCommissionDue,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao gerar Pix");
      setMpPix({
        qrCodeBase64: data.qr_code_base64,
        qrCode: data.qr_code,
        adminPixKey: data.admin_pix_key,
        adminPixName: data.admin_pix_name,
        adminWhatsapp: data.admin_whatsapp,
      });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoadingMp(false);
    }
  };

  if (loading || !store) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] p-6 space-y-4 max-w-3xl mx-auto">
        <div className="h-48 bg-slate-200/70 rounded-[32px] animate-pulse" />
        <div className="h-28 bg-white rounded-3xl border border-slate-100 shadow-sm animate-pulse" />
        <div className="h-28 bg-white rounded-3xl border border-slate-100 shadow-sm animate-pulse" />
      </div>
    );
  }

  const totalReceivable = customers.reduce((acc, c) => acc + Number(c.balance), 0);
  const totalSales = sales.reduce((acc, s) => acc + Number(s.total_amount), 0);
  const totalCommissionDue = sales.reduce(
    (acc, s) => acc + Number(s.commission_amount),
    0
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-32">
      {/* Top Header com Glassmorphism e Mesh Gradient */}
      <header className="relative bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white pt-7 pb-11 px-5 sm:px-8 rounded-b-[2.5rem] shadow-xl overflow-hidden">
        {/* Glow de fundo */}
        <div className="absolute top-0 right-1/4 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-10 w-60 h-60 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-3xl mx-auto">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="relative">
                <img
                  src="/logo.png"
                  alt="meufiadim"
                  className="h-11 w-auto object-contain bg-white/10 backdrop-blur-md rounded-2xl p-1.5 border border-white/15 shadow-md"
                />
              </div>
              <div>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Painel do Lojista
                </span>
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight mt-0.5 truncate text-white">
                  {store.name}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={`/${store.slug}`}
                target="_blank"
                rel="noreferrer"
                className="p-2.5 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-2xl border border-white/10 transition-all duration-150 shadow-xs flex items-center justify-center"
                title="Abrir vitrine da loja"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
              <button
                onClick={handleLogout}
                className="p-2.5 bg-white/10 hover:bg-rose-500/20 hover:text-rose-300 active:scale-95 text-white/90 rounded-2xl border border-white/10 transition-all duration-150 shadow-xs flex items-center justify-center"
                title="Sair"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Cards de Métricas Principais */}
          <div className="mt-6 grid grid-cols-2 gap-3.5">
            <div className="group bg-white/[0.08] hover:bg-white/[0.12] backdrop-blur-md rounded-3xl p-4 sm:p-5 border border-white/10 shadow-lg shadow-black/10 transition-all duration-200">
              <p className="text-[11px] text-slate-300 font-semibold tracking-wide">
                A receber (Fiado)
              </p>
              <p className="text-2xl sm:text-3xl font-extrabold mt-1 tracking-tight text-white group-hover:scale-[1.02] transition-transform">
                {formatBRL(totalReceivable)}
              </p>
            </div>

            <div className="group bg-white/[0.08] hover:bg-white/[0.12] backdrop-blur-md rounded-3xl p-4 sm:p-5 border border-white/10 shadow-lg shadow-black/10 transition-all duration-200">
              <p className="text-[11px] text-emerald-300 font-semibold tracking-wide">
                Vendas registradas
              </p>
              <p className="text-2xl sm:text-3xl font-extrabold mt-1 tracking-tight text-emerald-400 group-hover:scale-[1.02] transition-transform">
                {formatBRL(totalSales)}
              </p>
            </div>
          </div>

          {/* Barra do Link da Vitrine */}
          <div className="mt-4 bg-black/40 backdrop-blur-md rounded-2xl p-2 pl-4 border border-white/10 flex items-center justify-between gap-3 shadow-inner">
            <span className="text-xs text-slate-300 truncate">
              meufiadim.com/<strong className="text-white font-extrabold">{store.slug}</strong>
            </span>
            <button
              onClick={handleCopyLink}
              className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 active:scale-[0.97] text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shrink-0 shadow-md shadow-emerald-500/25 transition-all duration-150"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copiado!" : "Copiar link"}
            </button>
          </div>

          {/* Status de Expediente: Loja Aberta ou Fechada */}
          <div className="mt-3 bg-white/10 backdrop-blur-md rounded-2xl p-3 px-4 border border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner">
            <div className="flex items-center gap-2.5">
              <span
                className={`w-3 h-3 rounded-full shrink-0 ${
                  isOpen
                    ? "bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50"
                    : "bg-rose-500"
                }`}
              />
              <div>
                <span className="text-xs font-extrabold text-white block">
                  {isOpen ? "Vitrine ABERTA para Pedidos" : "Vitrine FECHADA no Momento"}
                </span>
                <span className="text-[10px] text-slate-300 block">
                  {isOpen
                    ? "Seus clientes podem adicionar itens e enviar pedidos no WhatsApp."
                    : "A vitrine avisa que você está fechado e pausa novos pedidos."}
                </span>
              </div>
            </div>

            <button
              onClick={handleToggleOpen}
              disabled={togglingOpen}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all active:scale-95 shrink-0 shadow-md ${
                isOpen
                  ? "bg-rose-500/25 hover:bg-rose-500/35 text-rose-200 border border-rose-400/30"
                  : "bg-emerald-500 hover:bg-emerald-400 text-white shadow-emerald-500/30"
              }`}
            >
              {togglingOpen
                ? "Atualizando..."
                : isOpen
                ? "Fechar Loja Agora"
                : "Abrir Loja Agora"}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 mt-6 space-y-5">
        {store.status === "blocked" && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-3xl flex items-center gap-3.5 text-sm shadow-sm shadow-rose-100">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="font-medium">
              Sua vitrine está pausada por fatura em aberto. Regularize na aba{" "}
              <strong className="font-bold underline">Fatura</strong> para liberar suas vendas.
            </span>
          </div>
        )}

        {tab === "fiado" && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-extrabold text-lg text-slate-900 tracking-tight">
                  Caderninho de Fiado
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  {customers.length} cliente{customers.length === 1 ? "" : "s"} cadastrado{customers.length === 1 ? "" : "s"}
                </p>
              </div>
              <button
                onClick={() => setShowNewCustomer(true)}
                className="group inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs shadow-md shadow-slate-900/20 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-150"
              >
                <Plus className="w-4 h-4 text-emerald-400 group-hover:rotate-90 transition-transform duration-200" />
                <span>Novo Cliente</span>
              </button>
            </div>

            {customers.length === 0 ? (
              <div className="bg-white rounded-[32px] p-10 sm:p-12 text-center border border-slate-200/70 shadow-sm shadow-slate-200/40">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto mb-3 text-emerald-600 shadow-xs">
                  <Users className="w-7 h-7 stroke-[1.75]" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Nenhum cliente no fiado ainda
                </h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1 leading-relaxed">
                  Cadastre seus clientes para controlar saldos, limites e cobrar automaticamente no WhatsApp com chave Pix.
                </p>
                <button
                  onClick={() => setShowNewCustomer(true)}
                  className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md shadow-emerald-600/20 hover:-translate-y-0.5 active:scale-[0.98] transition-all"
                >
                  <Plus className="w-4 h-4" /> Cadastrar primeiro cliente
                </button>
              </div>
            ) : (
              <div className="space-y-3.5">
                {customers.map((c) => {
                  const pct =
                    c.credit_limit > 0
                      ? Math.min(100, (c.balance / c.credit_limit) * 100)
                      : 0;

                  return (
                    <div
                      key={c.id}
                      className="group bg-white rounded-3xl p-5 border border-slate-200/70 shadow-sm shadow-slate-200/50 hover:shadow-xl hover:shadow-slate-300/40 hover:-translate-y-0.5 hover:border-emerald-200/80 transition-all duration-200 space-y-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-slate-100 to-slate-200/80 border border-slate-200/60 text-slate-700 font-extrabold text-sm flex items-center justify-center shrink-0 shadow-xs">
                            {c.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-extrabold text-base text-slate-900 truncate">
                              {c.name}
                            </h3>
                            <p className="text-xs text-slate-500 font-medium">{c.phone}</p>
                            {c.due_date && c.balance > 0 && (
                              <span
                                className={`inline-flex items-center gap-1 mt-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                                  new Date(`${c.due_date}T23:59:59`) < new Date()
                                    ? "bg-rose-50 text-rose-700 border-rose-200/70"
                                    : "bg-amber-50 text-amber-800 border-amber-200/70"
                                }`}
                              >
                                Vence em{" "}
                                {new Date(`${c.due_date}T12:00:00`).toLocaleDateString(
                                  "pt-BR"
                                )}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <p
                            className={`text-xl font-extrabold tracking-tight ${
                              c.balance > 0 ? "text-rose-600" : "text-emerald-600"
                            }`}
                          >
                            {formatBRL(c.balance)}
                          </p>
                          <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                            Limite: {formatBRL(c.credit_limit)}
                          </p>
                        </div>
                      </div>

                      {/* Barra de progresso do limite */}
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden p-0.5">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            pct >= 90 ? "bg-rose-500" : "bg-emerald-500"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      {/* Botões de Ação com Microinterações */}
                      <div className="grid grid-cols-3 gap-2 sm:gap-2.5 pt-1">
                        <button
                          onClick={() => setTxModal({ customer: c, type: "compra" })}
                          className="py-2.5 px-2.5 bg-rose-50 hover:bg-rose-100/80 text-rose-700 border border-rose-200/60 rounded-2xl text-xs font-extrabold flex items-center justify-center gap-1.5 hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-150 shadow-xs"
                        >
                          <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.2]" />
                          <span>Anotar</span>
                        </button>
                        <button
                          onClick={() =>
                            setTxModal({ customer: c, type: "pagamento" })
                          }
                          className="py-2.5 px-2.5 bg-emerald-50 hover:bg-emerald-100/80 text-emerald-700 border border-emerald-200/60 rounded-2xl text-xs font-extrabold flex items-center justify-center gap-1.5 hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-150 shadow-xs"
                        >
                          <ArrowDownLeft className="w-3.5 h-3.5 stroke-[2.2]" />
                          <span>Receber</span>
                        </button>
                        <button
                          onClick={() => setChargeModal(c)}
                          disabled={c.balance <= 0}
                          className="py-2.5 px-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 text-white rounded-2xl text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/25 hover:shadow-emerald-600/40 hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-150 disabled:shadow-none disabled:pointer-events-none"
                        >
                          <MessageCircle className="w-3.5 h-3.5 stroke-[2]" />
                          <span>Cobrar</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {tab === "produtos" && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-extrabold text-lg text-slate-900 tracking-tight">
                  Catálogo de Produtos
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  {products.length} ite{products.length === 1 ? "m" : "ns"} ativo{products.length === 1 ? "" : "s"} na vitrine
                </p>
              </div>
              <button
                onClick={() => setShowNewProduct(true)}
                className="group inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs shadow-md shadow-slate-900/20 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-150"
              >
                <Plus className="w-4 h-4 text-emerald-400 group-hover:rotate-90 transition-transform duration-200" />
                <span>Novo Produto</span>
              </button>
            </div>

            {products.length === 0 ? (
              <div className="bg-white rounded-[32px] p-10 sm:p-12 text-center border border-slate-200/70 shadow-sm shadow-slate-200/40">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto mb-3 text-emerald-600 shadow-xs">
                  <Package className="w-7 h-7 stroke-[1.75]" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Sua vitrine ainda não tem produtos
                </h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1 leading-relaxed">
                  Cadastre seus produtos com foto e preço para receber pedidos no WhatsApp e fiado.
                </p>
                <button
                  onClick={() => setShowNewProduct(true)}
                  className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md shadow-emerald-600/20 hover:-translate-y-0.5 active:scale-[0.98] transition-all"
                >
                  <Plus className="w-4 h-4" /> Cadastrar primeiro produto
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {products.map((p) => (
                  <div
                    key={p.id}
                    className="group bg-white rounded-3xl p-4 border border-slate-200/70 shadow-sm shadow-slate-200/50 hover:shadow-md hover:border-slate-300 transition-all flex items-center justify-between gap-3.5"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200/60 flex items-center justify-center overflow-hidden shrink-0">
                        {p.image_url ? (
                          <img
                            src={p.image_url}
                            alt={p.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                        ) : (
                          <Package className="w-6 h-6 text-slate-400 stroke-[1.75]" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-extrabold text-sm text-slate-900 truncate">{p.name}</p>
                        <p className="text-xs text-slate-500 font-semibold mt-0.5">
                          <span className="text-emerald-700 font-extrabold">{formatBRL(p.price)}</span> • Estoque: {p.stock} un
                        </p>
                        <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                          {p.category}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteProduct(p.id)}
                      className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 active:scale-95 rounded-2xl transition-all duration-150 shrink-0"
                      title="Excluir produto"
                    >
                      <Trash2 className="w-4 h-4 stroke-[1.75]" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "whatsapp" && (
          <div className="space-y-4">
            {/* Visão do Lojista: Explicação amigável, sem QR Code */}
            <div className="bg-white rounded-[32px] p-6 sm:p-7 border border-slate-200/70 shadow-sm shadow-slate-200/50 space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Robô Central Conectado 24/7
                  </span>
                  <h3 className="font-extrabold text-xl text-slate-900 mt-2 tracking-tight">
                    Cobranças Automáticas no WhatsApp
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">
                    Sua loja está 100% conectada ao robô oficial do <strong>meufiadim</strong>. Você não precisa ler QR Code nem deixar seu telefone ligado: nosso sistema cuida de tudo!
                  </p>
                </div>
                <div className="w-13 h-13 rounded-2xl bg-emerald-50 border border-emerald-100/80 text-emerald-600 flex items-center justify-center shrink-0 shadow-xs">
                  <MessageCircle className="w-6 h-6 stroke-[2]" />
                </div>
              </div>

              {/* Cards de Como Funciona */}
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60 space-y-1.5">
                  <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-extrabold text-xs">
                    1
                  </div>
                  <p className="text-xs font-extrabold text-slate-800">Você Anota o Fiado</p>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    Cadastre seu cliente e o valor com a data combinada de vencimento na aba <strong>Fiado</strong>.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60 space-y-1.5">
                  <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-extrabold text-xs">
                    2
                  </div>
                  <p className="text-xs font-extrabold text-slate-800">Lembrete Automático</p>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    Às 09h do dia combinado, o robô dispara a mensagem educada com a fatura e o botão Pix.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60 space-y-1.5">
                  <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-extrabold text-xs">
                    3
                  </div>
                  <p className="text-xs font-extrabold text-slate-800">Pix Direto na sua Conta</p>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    O cliente copia o código Pix e paga. O dinheiro cai direto na sua conta bancária sem intermediários!
                  </p>
                </div>
              </div>

              {/* Status da Chave Pix */}
              <div className="p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <p className="font-extrabold text-emerald-950 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Chave Pix vinculada para recebimento:
                  </p>
                  <p className="text-emerald-800 font-mono font-bold mt-0.5">
                    {store.pix_key ? store.pix_key : "⚠️ Nenhuma chave cadastrada! Cadastre na aba Fatura para receber."}
                  </p>
                </div>
                <button
                  onClick={() => setTab("fatura")}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-extrabold text-xs shrink-0 transition"
                >
                  {store.pix_key ? "Configurar Pix" : "Cadastrar Chave Pix"}
                </button>
              </div>

              {/* Prévia da Mensagem que o cliente recebe */}
              <div className="bg-slate-900 text-white p-5 rounded-2xl space-y-3 shadow-lg shadow-slate-900/10">
                <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2.5">
                  <span className="font-extrabold text-slate-300 flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                    Prévia da Mensagem Enviada ao seu Cliente:
                  </span>
                  <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                    Disparo Automático
                  </span>
                </div>
                <div className="bg-[#0b141a] p-4 rounded-xl text-xs font-mono text-slate-200 leading-relaxed border border-slate-800/80 space-y-1">
                  <p className="text-emerald-400 font-bold">Olá, João! Tudo bem?</p>
                  <p>Passando para lembrar do seu fiado em aberto na *{store.name}*:</p>
                  <p className="text-amber-300 font-bold pt-1">💰 *Valor em aberto:* R$ 120,00</p>
                  <p className="text-slate-400">📅 *Data final de pagamento:* 25/11/2026</p>
                  <p className="text-slate-300 pt-1">Para pagar agora, toque em *"Copiar código Pix"* na mensagem abaixo 👇</p>
                  <div className="mt-2.5 bg-[#1f2c34] p-2.5 rounded-lg text-emerald-400 text-[11px] font-sans flex items-center justify-between">
                    <span className="truncate pr-2">00020126...{store.pix_key || "sua-chave-pix"}...5802BR59...</span>
                    <span className="font-bold uppercase text-[10px] bg-emerald-500 text-slate-950 px-2 py-0.5 rounded shrink-0">Copiar</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "fatura" && (
          <div className="space-y-4">
            {/* Card Fatura Atual */}
            <div className="bg-white rounded-[32px] p-6 sm:p-7 border border-slate-200/70 shadow-sm shadow-slate-200/50 hover:shadow-md transition-all space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/60">
                    Ciclo {store.billing_cycle === "weekly" ? "Semanal" : "Mensal"}
                  </span>
                  <p className="text-3xl font-extrabold text-slate-900 mt-2 tracking-tight">
                    {formatBRL(totalCommissionDue)}
                  </p>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">
                    Valor total de comissão acumulada
                  </p>
                </div>
                <div className="w-13 h-13 rounded-2xl bg-emerald-50 border border-emerald-100/80 text-emerald-600 flex items-center justify-center shrink-0 shadow-xs">
                  <TrendingUp className="w-6 h-6 stroke-[2]" />
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5 flex justify-between items-center text-xs text-slate-600">
                <span className="font-semibold">Taxa da plataforma sobre vendas</span>
                <span className="text-slate-900 font-extrabold text-sm">{store.commission_rate}%</span>
              </div>

              <button
                onClick={handlePayInvoice}
                disabled={totalCommissionDue <= 0 || loadingMp}
                className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 text-white py-4 px-4 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-600/25 hover:shadow-emerald-600/40 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-150 disabled:shadow-none disabled:pointer-events-none"
              >
                <QrCode className="w-5 h-5 stroke-[2]" />
                <span>{loadingMp ? "Gerando Pix..." : "Pagar Fatura com Pix"}</span>
              </button>
            </div>

            {/* Status de Atendimento (Aberta / Fechada) */}
            <div className="bg-white rounded-[32px] p-6 sm:p-7 border border-slate-200/70 shadow-sm shadow-slate-200/50 space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">
                    Horário & Status da Vitrine
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium">
                    Defina se a sua vitrine online está aberta ou fechada para receber pedidos
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-extrabold border ${
                    isOpen
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-rose-50 text-rose-700 border-rose-200"
                  }`}
                >
                  {isOpen ? "🟢 Aberta" : "🔴 Fechada"}
                </span>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <span className="text-slate-600 font-medium">
                  {isOpen
                    ? "Sua loja está ABERTA. Clientes conseguem montar o carrinho e enviar pedidos no WhatsApp."
                    : "Sua loja está FECHADA. Clientes podem ver os preços, mas o botão de fazer pedido fica desativado."}
                </span>
                <button
                  type="button"
                  onClick={handleToggleOpen}
                  disabled={togglingOpen}
                  className={`px-4 py-2.5 rounded-xl font-extrabold text-xs transition active:scale-95 shrink-0 ${
                    isOpen
                      ? "bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-600/20"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20"
                  }`}
                >
                  {togglingOpen
                    ? "Salvando..."
                    : isOpen
                    ? "Pausar e Fechar Loja"
                    : "Abrir Loja Agora"}
                </button>
              </div>
            </div>

            {/* Aparência da Vitrine (Logo via Cloudinary + Cor) */}
            <form
              onSubmit={handleSaveTheme}
              className="bg-white rounded-[32px] p-6 sm:p-7 border border-slate-200/70 shadow-sm shadow-slate-200/50 hover:shadow-md transition-all space-y-4"
            >
              <div>
                <h3 className="font-extrabold text-base text-slate-900">
                  Aparência da sua Vitrine
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  Personalize o logo e a cor que seus clientes veem ao comprar
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">
                  Logotipo da loja
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, setLogoUrl)}
                  disabled={uploadingImg}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:font-extrabold file:bg-slate-900 file:text-white hover:file:bg-slate-800 file:cursor-pointer transition"
                />
                {uploadingImg && (
                  <p className="text-xs text-emerald-600 font-bold animate-pulse">
                    Otimizando e enviando imagem...
                  </p>
                )}
                {logoUrl && (
                  <div className="mt-2 flex items-center gap-3 p-2 bg-slate-50 rounded-2xl border border-slate-200/70 w-fit">
                    <img
                      src={logoUrl}
                      alt="Logo atual"
                      className="w-14 h-14 object-cover rounded-xl border border-slate-200 shadow-xs"
                    />
                    <span className="text-xs text-slate-600 font-semibold pr-2">Logo carregada</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">
                  Cor principal da sua vitrine
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setPrimaryColor(color)}
                      style={{ backgroundColor: color }}
                      className={`w-9 h-9 rounded-2xl transition-all shadow-xs ${
                        primaryColor === color
                          ? "ring-3 ring-offset-2 ring-slate-900 scale-110 shadow-md"
                          : "hover:scale-105"
                      }`}
                    />
                  ))}
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-9 h-9 rounded-2xl cursor-pointer border-0 bg-transparent p-0"
                    title="Escolher cor personalizada"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={savingTheme}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3.5 px-4 rounded-2xl font-extrabold text-sm shadow-md shadow-slate-900/15 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-150 disabled:opacity-50"
              >
                {savingTheme ? "Salvando..." : "Salvar aparência"}
              </button>
            </form>

            {/* Chave Pix do Lojista */}
            <form
              onSubmit={handleSavePix}
              className="bg-white rounded-[32px] p-6 sm:p-7 border border-slate-200/70 shadow-sm shadow-slate-200/50 hover:shadow-md transition-all space-y-3.5"
            >
              <div>
                <h3 className="font-extrabold text-base text-slate-900">
                  Sua Chave Pix (para receber dos clientes)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  Usada automaticamente pelo robô do WhatsApp ao enviar o botão Copiar Pix
                </p>
              </div>

              <input
                type="text"
                placeholder="CPF, CNPJ, E-mail, Celular ou Chave Aleatória"
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 shadow-xs focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none transition-all"
                required
              />
              <input
                type="text"
                placeholder="Sua cidade (ex: Belo Horizonte)"
                value={pixCity}
                onChange={(e) => setPixCity(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 shadow-xs focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none transition-all"
              />
              <button
                type="submit"
                disabled={savingPix}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3.5 px-4 rounded-2xl font-extrabold text-sm shadow-md shadow-slate-900/15 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-150 disabled:opacity-50"
              >
                {savingPix ? "Salvando..." : "Salvar minha Chave Pix"}
              </button>
            </form>

            {/* Histórico de Vendas */}
            <div className="bg-white rounded-[32px] p-6 sm:p-7 border border-slate-200/70 shadow-sm shadow-slate-200/50 space-y-3">
              <h3 className="font-extrabold text-base text-slate-900">Histórico de Vendas Recentes</h3>
              {sales.length === 0 ? (
                <p className="text-xs text-slate-400 font-medium py-2">
                  Nenhuma venda registrada neste ciclo ainda.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {sales.slice(0, 10).map((s) => (
                    <div
                      key={s.id}
                      className="py-3 flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-bold text-slate-900">
                          Venda ({s.payment_method})
                        </p>
                        <p className="text-slate-400 font-medium">
                          {new Date(s.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-extrabold text-sm text-slate-900">
                          {formatBRL(s.total_amount)}
                        </p>
                        <p className="text-emerald-700 font-bold">
                          Taxa: {formatBRL(s.commission_amount)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Floating Bottom Island Dock */}
      <nav className="fixed bottom-4 inset-x-4 z-40 max-w-md mx-auto bg-white/95 backdrop-blur-xl border border-slate-200/80 rounded-[28px] p-2 shadow-2xl shadow-slate-900/10 ring-1 ring-black/5">
        <div className="grid grid-cols-4 gap-1">
          <button
            onClick={() => setTab("fiado")}
            className={`py-2 px-1.5 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all duration-200 ${
              tab === "fiado"
                ? "bg-emerald-50 text-emerald-700 font-extrabold shadow-xs"
                : "text-slate-400 hover:text-slate-600 hover:bg-slate-50 font-semibold"
            }`}
          >
            <Users className="w-5 h-5 stroke-[2]" />
            <span className="text-[10px] sm:text-[11px]">Fiado</span>
          </button>

          <button
            onClick={() => setTab("produtos")}
            className={`py-2 px-1.5 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all duration-200 ${
              tab === "produtos"
                ? "bg-emerald-50 text-emerald-700 font-extrabold shadow-xs"
                : "text-slate-400 hover:text-slate-600 hover:bg-slate-50 font-semibold"
            }`}
          >
            <Package className="w-5 h-5 stroke-[2]" />
            <span className="text-[10px] sm:text-[11px]">Produtos</span>
          </button>

          <button
            onClick={() => {
              setTab("whatsapp");
              fetchZapStatus();
            }}
            className={`relative py-2 px-1.5 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all duration-200 ${
              tab === "whatsapp"
                ? "bg-emerald-50 text-emerald-700 font-extrabold shadow-xs"
                : "text-slate-400 hover:text-slate-600 hover:bg-slate-50 font-semibold"
            }`}
          >
            <div className="relative">
              <MessageCircle className="w-5 h-5 stroke-[2]" />
              <span
                className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ring-2 ring-white ${
                  zapConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-400"
                }`}
              />
            </div>
            <span className="text-[10px] sm:text-[11px] truncate">WhatsApp</span>
          </button>

          <button
            onClick={() => setTab("fatura")}
            className={`py-2 px-1.5 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all duration-200 ${
              tab === "fatura"
                ? "bg-emerald-50 text-emerald-700 font-extrabold shadow-xs"
                : "text-slate-400 hover:text-slate-600 hover:bg-slate-50 font-semibold"
            }`}
          >
            <Receipt className="w-5 h-5 stroke-[2]" />
            <span className="text-[10px] sm:text-[11px]">Fatura</span>
          </button>
        </div>
      </nav>

      {/* Modais de Transação, Cliente, Produto e MP */}
      {txModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <form
            onSubmit={handleTransaction}
            className="bg-white w-full sm:max-w-md rounded-t-[32px] sm:rounded-[32px] p-6 sm:p-7 shadow-2xl border border-slate-100 ring-1 ring-black/5 space-y-4"
          >
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto sm:hidden mb-2" />
            <div className="flex justify-between items-center">
              <div>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                  {txModal.type === "compra" ? "Nova Dívida" : "Abater Dívida"}
                </span>
                <h3 className="font-extrabold text-lg text-slate-900 mt-1">
                  {txModal.type === "compra"
                    ? `Anotar fiado — ${txModal.customer.name}`
                    : `Receber de ${txModal.customer.name}`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTxModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              type="number"
              step="0.01"
              placeholder="Valor (R$)"
              value={txAmount}
              onChange={(e) => setTxAmount(e.target.value)}
              className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xl font-extrabold text-slate-900 placeholder:text-slate-400 shadow-xs focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none transition-all"
              autoFocus
              required
            />
            {txModal.type === "compra" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">
                    Data de vencimento
                  </label>
                  <input
                    type="date"
                    value={txDueDate}
                    onChange={(e) => setTxDueDate(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">
                    Avisar no Zap em
                  </label>
                  <input
                    type="date"
                    value={txNotifyDate}
                    onChange={(e) => setTxNotifyDate(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            )}
            <button
              type="submit"
              className={`w-full py-4 rounded-2xl font-extrabold text-white text-sm shadow-lg hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-150 ${
                txModal.type === "compra"
                  ? "bg-rose-600 hover:bg-rose-700 shadow-rose-600/25 hover:shadow-rose-600/40"
                  : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/25 hover:shadow-emerald-600/40"
              }`}
            >
              Confirmar Operação
            </button>
          </form>
        </div>
      )}

      {showNewCustomer && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <form
            onSubmit={handleAddCustomer}
            className="bg-white w-full sm:max-w-md rounded-t-[32px] sm:rounded-[32px] p-6 sm:p-7 shadow-2xl border border-slate-100 ring-1 ring-black/5 space-y-3.5"
          >
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto sm:hidden mb-2" />
            <div className="flex justify-between items-center mb-1">
              <div>
                <h3 className="font-extrabold text-lg text-slate-900">Novo Cliente no Fiado</h3>
                <p className="text-xs text-slate-500 font-medium">Controle dívidas e receba pelo WhatsApp</p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewCustomer(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              type="text"
              placeholder="Nome completo *"
              value={cName}
              onChange={(e) => setCName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 shadow-xs focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none transition-all"
              required
            />
            <input
              type="text"
              placeholder="WhatsApp com DDD *"
              value={cPhone}
              onChange={(e) => setCPhone(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 shadow-xs focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none transition-all"
              required
            />
            <input
              type="number"
              placeholder="Limite de crédito (R$)"
              value={cLimit}
              onChange={(e) => setCLimit(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 shadow-xs focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none transition-all"
            />
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white py-4 rounded-2xl font-extrabold text-sm shadow-lg shadow-emerald-600/25 hover:shadow-emerald-600/40 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-150"
            >
              Salvar Cliente
            </button>
          </form>
        </div>
      )}

      {showNewProduct && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <form
            onSubmit={handleAddProduct}
            className="bg-white w-full sm:max-w-md rounded-t-[32px] sm:rounded-[32px] p-6 sm:p-7 shadow-2xl border border-slate-100 ring-1 ring-black/5 space-y-3.5 max-h-[90vh] overflow-y-auto"
          >
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto sm:hidden mb-2" />
            <div className="flex justify-between items-center mb-1">
              <div>
                <h3 className="font-extrabold text-lg text-slate-900">Cadastrar Produto</h3>
                <p className="text-xs text-slate-500 font-medium">Adicione itens para sua vitrine digital</p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewProduct(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              type="text"
              placeholder="Nome do produto *"
              value={pName}
              onChange={(e) => setPName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 shadow-xs focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none transition-all"
              required
            />
            <div className="grid grid-cols-2 gap-2.5">
              <input
                type="number"
                step="0.01"
                placeholder="Preço (R$) *"
                value={pPrice}
                onChange={(e) => setPPrice(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 shadow-xs focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none transition-all"
                required
              />
              <input
                type="number"
                placeholder="Estoque"
                value={pStock}
                onChange={(e) => setPStock(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 shadow-xs focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none transition-all"
              />
            </div>
            <input
              type="text"
              placeholder="Categoria (ex: Roupas, Doces)"
              value={pCat}
              onChange={(e) => setPCat(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 shadow-xs focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none transition-all"
            />
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">
                Foto do produto
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, setPImg)}
                disabled={uploadingImg}
                className="w-full text-xs text-slate-500 file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:font-extrabold file:bg-slate-900 file:text-white hover:file:bg-slate-800 file:cursor-pointer transition"
              />
              {uploadingImg && (
                <p className="text-xs text-emerald-600 font-bold animate-pulse">
                  Otimizando e enviando foto...
                </p>
              )}
              {pImg && (
                <img
                  src={pImg}
                  alt="Prévia"
                  className="w-20 h-20 object-cover rounded-2xl border border-slate-200 shadow-xs"
                />
              )}
            </div>
            <textarea
              placeholder="Descrição curta do produto"
              value={pDesc}
              onChange={(e) => setPDesc(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 shadow-xs focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none transition-all"
            />
            <button
              type="submit"
              disabled={uploadingImg}
              className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 disabled:opacity-50 text-white py-4 rounded-2xl font-extrabold text-sm shadow-lg shadow-emerald-600/25 hover:shadow-emerald-600/40 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-150"
            >
              Salvar Produto
            </button>
          </form>
        </div>
      )}

      {/* Modal: Opções de Cobrança do Cliente (Robô Oficial ou WhatsApp Próprio) */}
      {chargeModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="bg-white w-full sm:max-w-md rounded-t-[32px] sm:rounded-[32px] p-6 sm:p-7 shadow-2xl border border-slate-100 ring-1 ring-black/5 space-y-5 animate-in zoom-in-95">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                  Cobrar Fiado
                </span>
                <h3 className="font-extrabold text-lg text-slate-900 mt-1">
                  {chargeModal.name}
                </h3>
                <p className="text-xs text-slate-500 font-medium">{chargeModal.phone}</p>
              </div>
              <button
                onClick={() => setChargeModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Resumo da Dívida */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/70 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Valor em aberto:</span>
                <span className="text-xl font-extrabold text-emerald-600">
                  {formatBRL(chargeModal.balance)}
                </span>
              </div>
              {chargeModal.due_date && (
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
                  <span className="text-slate-500 font-medium">Vencimento:</span>
                  <span className="font-bold text-slate-800">
                    {new Date(`${chargeModal.due_date}T12:00:00`).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              )}
              {store.pix_key && (
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
                  <span className="text-slate-500 font-medium">Sua Chave Pix:</span>
                  <span className="font-mono font-bold text-slate-800 truncate max-w-[180px]">
                    {store.pix_key}
                  </span>
                </div>
              )}
            </div>

            {/* Opções de Envio */}
            <div className="space-y-2.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block">
                Escolha como deseja cobrar:
              </span>

              {/* Opção 1: Robô Central 24/7 */}
              <button
                type="button"
                onClick={async () => {
                  const cust = chargeModal;
                  setChargeModal(null);
                  await handleSendCharge(cust);
                }}
                disabled={sendingId === chargeModal.id}
                className="w-full p-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white text-left transition-all shadow-md shadow-emerald-600/20 active:scale-[0.98] flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <strong className="block text-sm font-extrabold text-white">
                      Disparo Automático (Robô Oficial)
                    </strong>
                    <span className="text-[11px] text-emerald-100 block">
                      Envia em 2º plano sem você precisar abrir o celular
                    </span>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-emerald-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </button>

              {/* Opção 2: Meu WhatsApp Próprio */}
              <button
                type="button"
                onClick={() => {
                  handleOpenMyWhatsApp(chargeModal);
                  setChargeModal(null);
                }}
                className="w-full p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-all active:scale-[0.98] flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <strong className="block text-sm font-extrabold text-slate-900">
                      Cobrar pelo Meu WhatsApp Próprio
                    </strong>
                    <span className="text-[11px] text-slate-500 block">
                      Abre a conversa no seu aparelho com a mensagem pronta
                    </span>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
              </button>

              {/* Opção 3: Copiar Código Pix Copia e Cola */}
              {store.pix_key && (
                <button
                  type="button"
                  onClick={() => {
                    try {
                      const code = generatePixCopiaECola({
                        pixKey: store.pix_key!,
                        merchantName: store.name || "MEUFIADIM",
                        merchantCity: store.pix_city || "BRASIL",
                        amount: Number(chargeModal.balance),
                      });
                      navigator.clipboard.writeText(code);
                      setCopiedPixCode(true);
                      setTimeout(() => setCopiedPixCode(false), 3000);
                    } catch (e: any) {
                      alert("Erro ao gerar Pix Copia e Cola.");
                    }
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center justify-center gap-2"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>
                    {copiedPixCode
                      ? "Código Pix Copiado com Sucesso!"
                      : "Copiar Pix Copia e Cola deste Cliente"}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {mpPix && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[32px] p-6 sm:p-7 text-center space-y-4 shadow-2xl border border-slate-100 ring-1 ring-black/5">
            <div className="flex justify-between items-center">
              <div className="text-left">
                <h3 className="font-extrabold text-base text-slate-900">Pagar Comissão da Loja</h3>
                <p className="text-xs text-slate-400 font-medium">Pix oficial da plataforma meufiadim</p>
              </div>
              <button
                onClick={() => setMpPix(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <img
              src={`data:image/png;base64,${mpPix.qrCodeBase64}`}
              alt="QR Code Pix"
              className="w-52 h-52 mx-auto rounded-3xl border border-slate-200/80 p-2 shadow-xs"
            />

            {mpPix.adminPixName && (
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 text-xs text-slate-600 space-y-1 text-left">
                <p className="font-bold text-slate-800">
                  Favorecido: <span className="font-extrabold text-purple-700">{mpPix.adminPixName}</span>
                </p>
                {mpPix.adminPixKey && (
                  <p className="font-medium text-slate-600 truncate">
                    Chave Pix: <span className="font-bold text-slate-900">{mpPix.adminPixKey}</span>
                  </p>
                )}
              </div>
            )}

            <button
              onClick={() => {
                navigator.clipboard.writeText(mpPix.qrCode);
                alert("Código Pix Copia e Cola copiado!");
              }}
              className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white py-3.5 px-4 rounded-2xl font-extrabold text-sm shadow-lg shadow-emerald-600/25 hover:shadow-emerald-600/40 hover:-translate-y-0.5 active:scale-[0.98] transition-all"
            >
              Copiar código Pix (Copia e Cola)
            </button>

            {mpPix.adminWhatsapp && (
              <a
                href={`https://wa.me/55${mpPix.adminWhatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
                  `Olá! Acabei de realizar o pagamento da comissão da loja *${store.name}* no valor de *${formatBRL(
                    totalCommissionDue
                  )}* via Pix. Segue o comprovante!`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 py-2.5 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition"
              >
                <span>Enviar Comprovante no WhatsApp</span>
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
