"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatBRL } from "@/lib/whatsapp";
import { uploadToCloudinary } from "@/lib/cloudinary";

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

  const [tab, setTab] = useState<"fiado" | "produtos" | "fatura">("fiado");
  const [copied, setCopied] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [uploadingImg, setUploadingImg] = useState(false);

  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [txModal, setTxModal] = useState<{
    customer: Customer;
    type: "compra" | "pagamento";
  } | null>(null);

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

    const { data: storeData } = await supabase
      .from("stores")
      .select("*")
      .eq("owner_id", user.id)
      .single();

    if (!storeData) {
      router.push("/login");
      return;
    }

    setStore(storeData);
    setPixKey(storeData.pix_key || "");
    setPixCity(storeData.pix_city || "BRASILIA");
    setLogoUrl(storeData.logo_url || "");
    setPrimaryColor(storeData.primary_color || "#059669");

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
  }

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
        alert(`Erro ao enviar: ${data.error || "verifique sua API Baileys"}`);
        return;
      }

      alert(`Cobrança enviada no WhatsApp de ${customer.name}!`);
    } catch {
      alert("Não foi possível conectar ao servidor de cobrança.");
    } finally {
      setSendingId(null);
    }
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
      setMpPix({ qrCodeBase64: data.qr_code_base64, qrCode: data.qr_code });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoadingMp(false);
    }
  };

  if (loading || !store) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] p-6 space-y-4">
        <div className="h-44 bg-gray-200 rounded-3xl animate-pulse" />
        <div className="h-28 bg-white rounded-3xl animate-pulse" />
        <div className="h-28 bg-white rounded-3xl animate-pulse" />
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
    <div className="min-h-screen bg-[#F7F8FA] text-gray-900 pb-28">
      <header className="bg-gradient-to-br from-gray-900 via-gray-900 to-emerald-950 text-white pt-6 pb-10 px-5 rounded-b-[2rem] shadow-lg">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-emerald-400 font-semibold uppercase tracking-wider">
                meufiadim • Painel
              </p>
              <h1 className="text-xl font-bold mt-0.5">{store.name}</h1>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={`/${store.slug}`}
                target="_blank"
                rel="noreferrer"
                className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition"
                title="Abrir vitrine"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
              <button
                onClick={handleLogout}
                className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition"
                title="Sair"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="bg-white/10 backdrop-blur rounded-2xl p-4">
              <p className="text-[11px] text-gray-300 font-medium">
                A receber (Fiado)
              </p>
              <p className="text-2xl font-extrabold mt-1 tracking-tight text-white">
                {formatBRL(totalReceivable)}
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur rounded-2xl p-4">
              <p className="text-[11px] text-gray-300 font-medium">
                Vendas registradas
              </p>
              <p className="text-2xl font-extrabold mt-1 tracking-tight text-emerald-400">
                {formatBRL(totalSales)}
              </p>
            </div>
          </div>

          <div className="mt-4 bg-black/30 rounded-2xl px-3.5 py-2.5 flex items-center justify-between gap-2">
            <span className="text-xs text-gray-300 truncate">
              meufiadim.com/<strong className="text-white">{store.slug}</strong>
            </span>
            <button
              onClick={handleCopyLink}
              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copiado!" : "Copiar link"}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 mt-6 space-y-4">
        {store.status === "blocked" && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl flex items-center gap-3 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>
              Sua vitrine está pausada por fatura em aberto. Regularize na aba{" "}
              <strong>Fatura</strong> para liberar.
            </span>
          </div>
        )}

        {tab === "fiado" && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-base text-gray-900">
                Caderninho ({customers.length})
              </h2>
              <button
                onClick={() => setShowNewCustomer(true)}
                className="bg-gray-900 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-gray-800"
              >
                <Plus className="w-4 h-4" /> Novo Cliente
              </button>
            </div>

            {customers.length === 0 ? (
              <div className="bg-white rounded-3xl p-10 text-center border border-gray-100">
                <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-gray-700">
                  Nenhum cliente no fiado ainda
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Cadastre seus clientes recorrentes para controlar limites e cobrar no Zap.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {customers.map((c) => {
                  const pct =
                    c.credit_limit > 0
                      ? Math.min(100, (c.balance / c.credit_limit) * 100)
                      : 0;

                  return (
                    <div
                      key={c.id}
                      className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-2xl bg-gray-100 text-gray-700 font-bold text-sm flex items-center justify-center shrink-0">
                            {c.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="font-bold text-sm text-gray-900">
                              {c.name}
                            </h3>
                            <p className="text-xs text-gray-400">{c.phone}</p>
                            {c.due_date && c.balance > 0 && (
                              <span
                                className={`inline-block mt-1 text-[11px] font-bold px-2 py-0.5 rounded-md ${
                                  new Date(`${c.due_date}T23:59:59`) < new Date()
                                    ? "bg-red-100 text-red-700"
                                    : "bg-amber-100 text-amber-800"
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

                        <div className="text-right">
                          <p
                            className={`text-lg font-extrabold tracking-tight ${
                              c.balance > 0 ? "text-red-600" : "text-emerald-600"
                            }`}
                          >
                            {formatBRL(c.balance)}
                          </p>
                          <p className="text-[11px] text-gray-400">
                            Limite: {formatBRL(c.credit_limit)}
                          </p>
                        </div>
                      </div>

                      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            pct >= 90 ? "bg-red-500" : "bg-emerald-500"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-1">
                        <button
                          onClick={() => setTxModal({ customer: c, type: "compra" })}
                          className="py-2 px-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition"
                        >
                          <ArrowUpRight className="w-3.5 h-3.5" /> Anotar
                        </button>
                        <button
                          onClick={() =>
                            setTxModal({ customer: c, type: "pagamento" })
                          }
                          className="py-2 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition"
                        >
                          <ArrowDownLeft className="w-3.5 h-3.5" /> Receber
                        </button>
                        <button
                          onClick={() => handleSendCharge(c)}
                          disabled={c.balance <= 0 || sendingId === c.id}
                          className="py-2 px-2 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          {sendingId === c.id ? "..." : "Cobrar"}
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
              <h2 className="font-bold text-base text-gray-900">
                Catálogo ({products.length})
              </h2>
              <button
                onClick={() => setShowNewProduct(true)}
                className="bg-gray-900 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-gray-800"
              >
                <Plus className="w-4 h-4" /> Novo Produto
              </button>
            </div>

            <div className="space-y-2.5">
              {products.map((p) => (
                <div
                  key={p.id}
                  className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-sm flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          alt={p.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Package className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">{p.name}</p>
                      <p className="text-xs text-gray-500">
                        {formatBRL(p.price)} • Estoque: {p.stock}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteProduct(p.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-xl shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === "fatura" && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                    Fatura atual ({store.billing_cycle === "weekly" ? "Semanal" : "Mensal"})
                  </span>
                  <p className="text-3xl font-extrabold text-gray-900 mt-1">
                    {formatBRL(totalCommissionDue)}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-gray-50 rounded-2xl p-3.5 flex justify-between text-xs text-gray-600">
                <span>Taxa combinada sobre vendas</span>
                <strong className="text-gray-900">{store.commission_rate}%</strong>
              </div>

              <button
                onClick={handlePayInvoice}
                disabled={totalCommissionDue <= 0 || loadingMp}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-200 disabled:text-gray-400 text-white py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition"
              >
                <QrCode className="w-5 h-5" />
                {loadingMp ? "Gerando Pix..." : "Pagar Fatura com Pix"}
              </button>
            </div>

            {/* Aparência da Vitrine (Logo via Cloudinary + Cor) */}
            <form
              onSubmit={handleSaveTheme}
              className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-4"
            >
              <h3 className="font-bold text-sm">Aparência da sua Vitrine</h3>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-500 block">
                  Logo da loja (envio direto da galeria)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, setLogoUrl)}
                  disabled={uploadingImg}
                  className="w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:font-bold file:bg-gray-900 file:text-white hover:file:bg-gray-800"
                />
                {uploadingImg && (
                  <p className="text-xs text-emerald-600 font-medium">
                    Enviando imagem...
                  </p>
                )}
                {logoUrl && (
                  <img
                    src={logoUrl}
                    alt="Logo atual"
                    className="w-16 h-16 object-cover rounded-2xl border"
                  />
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-500 block">
                  Cor principal da loja
                </label>
                <div className="flex flex-wrap items-center gap-2.5">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setPrimaryColor(color)}
                      style={{ backgroundColor: color }}
                      className={`w-8 h-8 rounded-full transition-transform ${
                        primaryColor === color
                          ? "ring-2 ring-offset-2 ring-gray-900 scale-110"
                          : ""
                      }`}
                    />
                  ))}
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-8 h-8 rounded-full cursor-pointer border-0 bg-transparent"
                    title="Escolher outra cor"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={savingTheme}
                className="w-full bg-gray-900 text-white py-3 rounded-2xl font-bold text-sm"
              >
                {savingTheme ? "Salvando..." : "Salvar aparência"}
              </button>
            </form>

            {/* Chave Pix do Lojista */}
            <form
              onSubmit={handleSavePix}
              className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-3"
            >
              <h3 className="font-bold text-sm">
                Sua Chave Pix (para receber dos clientes)
              </h3>
              <p className="text-xs text-gray-500">
                Usada automaticamente pelo robô do WhatsApp nas cobranças de fiado.
              </p>
              <input
                type="text"
                placeholder="CPF, CNPJ, E-mail, Celular ou Chave Aleatória"
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border rounded-2xl text-sm"
                required
              />
              <input
                type="text"
                placeholder="Sua cidade (ex: Belo Horizonte)"
                value={pixCity}
                onChange={(e) => setPixCity(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border rounded-2xl text-sm"
              />
              <button
                type="submit"
                disabled={savingPix}
                className="w-full bg-gray-900 text-white py-3 rounded-2xl font-bold text-sm"
              >
                {savingPix ? "Salvando..." : "Salvar minha Chave Pix"}
              </button>
            </form>

            <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
              <h3 className="font-bold text-sm mb-3">Histórico de Vendas</h3>
              {sales.length === 0 ? (
                <p className="text-xs text-gray-400">
                  Nenhuma venda registrada neste ciclo.
                </p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {sales.slice(0, 10).map((s) => (
                    <div
                      key={s.id}
                      className="py-2.5 flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-semibold text-gray-800">
                          Venda ({s.payment_method})
                        </p>
                        <p className="text-gray-400">
                          {new Date(s.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">
                          {formatBRL(s.total_amount)}
                        </p>
                        <p className="text-emerald-600 font-medium">
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

      <nav className="fixed bottom-0 inset-x-0 z-30 bg-white/90 backdrop-blur border-t border-gray-200 px-6 py-2">
        <div className="max-w-md mx-auto grid grid-cols-3 gap-2">
          <button
            onClick={() => setTab("fiado")}
            className={`py-2 rounded-2xl flex flex-col items-center gap-1 transition ${
              tab === "fiado" ? "text-emerald-600 font-bold" : "text-gray-400"
            }`}
          >
            <Users className="w-5 h-5" />
            <span className="text-[11px]">Fiado</span>
          </button>

          <button
            onClick={() => setTab("produtos")}
            className={`py-2 rounded-2xl flex flex-col items-center gap-1 transition ${
              tab === "produtos" ? "text-emerald-600 font-bold" : "text-gray-400"
            }`}
          >
            <Package className="w-5 h-5" />
            <span className="text-[11px]">Produtos</span>
          </button>

          <button
            onClick={() => setTab("fatura")}
            className={`py-2 rounded-2xl flex flex-col items-center gap-1 transition ${
              tab === "fatura" ? "text-emerald-600 font-bold" : "text-gray-400"
            }`}
          >
            <Receipt className="w-5 h-5" />
            <span className="text-[11px]">Fatura</span>
          </button>
        </div>
      </nav>

      {txModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <form
            onSubmit={handleTransaction}
            className="bg-white w-full sm:max-w-md rounded-t-[2rem] sm:rounded-3xl p-6 space-y-4"
          >
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg">
                {txModal.type === "compra"
                  ? `Anotar fiado — ${txModal.customer.name}`
                  : `Receber de ${txModal.customer.name}`}
              </h3>
              <button type="button" onClick={() => setTxModal(null)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <input
              type="number"
              step="0.01"
              placeholder="Valor (R$)"
              value={txAmount}
              onChange={(e) => setTxAmount(e.target.value)}
              className="w-full px-4 py-3.5 bg-gray-50 border rounded-2xl text-lg font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              autoFocus
              required
            />
            {txModal.type === "compra" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500">
                    Data de vencimento
                  </label>
                  <input
                    type="date"
                    value={txDueDate}
                    onChange={(e) => setTxDueDate(e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-50 border rounded-2xl text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500">
                    Avisar no Zap em
                  </label>
                  <input
                    type="date"
                    value={txNotifyDate}
                    onChange={(e) => setTxNotifyDate(e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-50 border rounded-2xl text-sm"
                  />
                </div>
              </div>
            )}
            <button
              type="submit"
              className={`w-full py-3.5 rounded-2xl font-bold text-white ${
                txModal.type === "compra"
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              Confirmar
            </button>
          </form>
        </div>
      )}

      {showNewCustomer && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <form
            onSubmit={handleAddCustomer}
            className="bg-white w-full sm:max-w-md rounded-t-[2rem] sm:rounded-3xl p-6 space-y-3"
          >
            <div className="flex justify-between items-center mb-1">
              <h3 className="font-bold text-lg">Novo Cliente no Fiado</h3>
              <button type="button" onClick={() => setShowNewCustomer(false)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <input
              type="text"
              placeholder="Nome completo *"
              value={cName}
              onChange={(e) => setCName(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border rounded-2xl text-sm"
              required
            />
            <input
              type="text"
              placeholder="WhatsApp com DDD *"
              value={cPhone}
              onChange={(e) => setCPhone(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border rounded-2xl text-sm"
              required
            />
            <input
              type="number"
              placeholder="Limite de crédito (R$)"
              value={cLimit}
              onChange={(e) => setCLimit(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border rounded-2xl text-sm"
            />
            <button
              type="submit"
              className="w-full bg-gray-900 text-white py-3.5 rounded-2xl font-bold text-sm"
            >
              Salvar Cliente
            </button>
          </form>
        </div>
      )}

      {showNewProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <form
            onSubmit={handleAddProduct}
            className="bg-white w-full sm:max-w-md rounded-t-[2rem] sm:rounded-3xl p-6 space-y-3"
          >
            <div className="flex justify-between items-center mb-1">
              <h3 className="font-bold text-lg">Cadastrar Produto</h3>
              <button type="button" onClick={() => setShowNewProduct(false)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <input
              type="text"
              placeholder="Nome do produto *"
              value={pName}
              onChange={(e) => setPName(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border rounded-2xl text-sm"
              required
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                step="0.01"
                placeholder="Preço (R$) *"
                value={pPrice}
                onChange={(e) => setPPrice(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border rounded-2xl text-sm"
                required
              />
              <input
                type="number"
                placeholder="Estoque"
                value={pStock}
                onChange={(e) => setPStock(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border rounded-2xl text-sm"
              />
            </div>
            <input
              type="text"
              placeholder="Categoria (ex: Roupas, Doces)"
              value={pCat}
              onChange={(e) => setPCat(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border rounded-2xl text-sm"
            />
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500 block">
                Foto do produto (Cloudinary)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, setPImg)}
                disabled={uploadingImg}
                className="w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:font-bold file:bg-gray-900 file:text-white hover:file:bg-gray-800"
              />
              {uploadingImg && (
                <p className="text-xs text-emerald-600 font-medium">
                  Enviando foto...
                </p>
              )}
              {pImg && (
                <img
                  src={pImg}
                  alt="Prévia"
                  className="w-20 h-20 object-cover rounded-xl border"
                />
              )}
            </div>
            <textarea
              placeholder="Descrição curta"
              value={pDesc}
              onChange={(e) => setPDesc(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 bg-gray-50 border rounded-2xl text-sm"
            />
            <button
              type="submit"
              disabled={uploadingImg}
              className="w-full bg-gray-900 text-white py-3.5 rounded-2xl font-bold text-sm disabled:opacity-50"
            >
              Salvar Produto
            </button>
          </form>
        </div>
      )}

      {mpPix && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 text-center space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-base">Pagar Fatura meufiadim</h3>
              <button onClick={() => setMpPix(null)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <img
              src={`data:image/png;base64,${mpPix.qrCodeBase64}`}
              alt="QR Code Pix"
              className="w-56 h-56 mx-auto rounded-2xl border p-2"
            />
            <p className="text-xs text-gray-500">
              Assim que o Pix cair, sua loja é liberada automaticamente.
            </p>
            <button
              onClick={() => {
                navigator.clipboard.writeText(mpPix.qrCode);
                alert("Código Pix copiado!");
              }}
              className="w-full bg-emerald-600 text-white py-3 rounded-2xl font-bold text-sm"
            >
              Copiar código Pix
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
