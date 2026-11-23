"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  ShoppingBag,
  Plus,
  Minus,
  MessageCircle,
  Package,
  X,
  Search,
  ShieldCheck,
  QrCode,
  Banknote,
  CreditCard,
  BookOpen,
  MapPin,
  Store as StoreIcon,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatBRL } from "@/lib/whatsapp";

interface Store {
  id: string;
  name: string;
  slug: string;
  whatsapp: string;
  status: "active" | "blocked";
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

const PAYMENT_OPTIONS = [
  { id: "Fiado", label: "Fiado", desc: "Pendurar na conta", icon: BookOpen, highlight: true },
  { id: "Pix", label: "Pix", desc: "Aprovação na hora", icon: QrCode },
  { id: "Cartão", label: "Cartão", desc: "Crédito ou débito", icon: CreditCard },
  { id: "Dinheiro", label: "Dinheiro", desc: "Pagar na entrega", icon: Banknote },
];

export default function TenantStorePage() {
  const { slug } = useParams<{ slug: string }>();
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [cart, setCart] = useState<{ product: Product; qty: number }[]>([]);
  const [cartOpen, setCartOpen] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [deliveryType, setDeliveryType] = useState<"entrega" | "retirada">("entrega");
  const [address, setAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Fiado");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    async function loadStore() {
      const { data: storeData } = await supabase
        .from("stores")
        .select("*")
        .eq("slug", slug)
        .single();

      if (storeData) {
        setStore(storeData);
        const { data: prodData } = await supabase
          .from("products")
          .select("*")
          .eq("store_id", storeData.id)
          .order("created_at", { ascending: false });
        setProducts(prodData || []);
      }
      setLoading(false);
    }
    if (slug) loadStore();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] pb-24">
        <div className="h-44 bg-gray-200 animate-pulse rounded-b-[2rem]" />
        <div className="max-w-3xl mx-auto px-4 -mt-6 space-y-4">
          <div className="h-12 bg-white rounded-2xl shadow-sm animate-pulse" />
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-60 bg-white rounded-3xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-gray-200 rounded-2xl flex items-center justify-center mb-4">
          <StoreIcon className="w-8 h-8 text-gray-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">Loja não encontrada</h1>
        <p className="text-sm text-gray-500 mt-1">
          Verifique o link com o vendedor e tente novamente.
        </p>
      </div>
    );
  }

  if (store.status === "blocked") {
    return (
      <div className="min-h-screen bg-[#F7F8FA] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mb-4">
          <StoreIcon className="w-8 h-8 text-red-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">{store.name}</h1>
        <p className="text-sm text-gray-500 mt-1">
          Esta vitrine está temporariamente pausada.
        </p>
      </div>
    );
  }

  const brandColor = store.primary_color || "#059669";

  const categories = [
    "Todos",
    ...Array.from(new Set(products.map((p) => p.category || "Geral"))),
  ];

  const filteredProducts = products.filter((p) => {
    const matchCat =
      selectedCategory === "Todos" || (p.category || "Geral") === selectedCategory;
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const getQty = (id: string) =>
    cart.find((i) => i.product.id === id)?.qty || 0;

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const exists = prev.find((i) => i.product.id === product.id);
      if (exists) {
        return prev.map((i) =>
          i.product.id === product.id
            ? { ...i, qty: Math.min(i.qty + 1, product.stock || 99) }
            : i
        );
      }
      return [...prev, { product, qty: 1 }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.product.id === id ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0)
    );
  };

  const totalItems = cart.reduce((acc, i) => acc + i.qty, 0);
  const totalPrice = cart.reduce((acc, i) => acc + i.product.price * i.qty, 0);

  const initials = store.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const handleWhatsAppCheckout = () => {
    if (!customerName.trim()) {
      alert("Informe seu nome para enviar o pedido.");
      return;
    }
    if (deliveryType === "entrega" && !address.trim()) {
      alert("Informe o endereço para entrega ou mude para Retirada.");
      return;
    }

    const itemsText = cart
      .map(
        (i) =>
          `• ${i.qty}x ${i.product.name} — ${formatBRL(i.product.price * i.qty)}`
      )
      .join("\n");

    const lines = [
      `🛍️ *Novo Pedido — ${store.name}*`,
      ``,
      `👤 *Cliente:* ${customerName.trim()}`,
      `📍 *Recebimento:* ${
        deliveryType === "retirada" ? "Retirada na loja" : address.trim()
      }`,
      `💳 *Pagamento:* ${paymentMethod}`,
      ``,
      `*Itens do pedido:*`,
      itemsText,
      ``,
      `💰 *Total: ${formatBRL(totalPrice)}*`,
    ];

    if (notes.trim()) {
      lines.push(``, `📝 *Obs:* ${notes.trim()}`);
    }

    const phone = store.whatsapp.startsWith("55")
      ? store.whatsapp
      : `55${store.whatsapp}`;

    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(lines.join("\n"))}`,
      "_blank"
    );
    setCart([]);
    setCartOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-32">
      {/* Header da Vitrine com degradê e avatar da loja */}
      <header
        style={{
          background: `linear-gradient(135deg, #090D16 0%, #0F172A 55%, ${brandColor} 145%)`,
        }}
        className="relative text-white pt-8 pb-14 px-5 sm:px-8 rounded-b-[2.5rem] shadow-xl overflow-hidden"
      >
        <div className="absolute top-0 right-10 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-3xl mx-auto flex items-center gap-4">
          <div
            style={{ backgroundColor: brandColor }}
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl text-white font-extrabold text-xl sm:text-2xl flex items-center justify-center shadow-xl shadow-black/20 shrink-0 overflow-hidden ring-2 ring-white/20"
          >
            {store.logo_url ? (
              <img
                src={store.logo_url}
                alt={store.name}
                className="w-full h-full object-cover"
              />
            ) : (
              initials
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight truncate text-white">
                {store.name}
              </h1>
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-1.5 text-xs bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-emerald-300 font-bold border border-white/10 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Aberto agora
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs bg-amber-400/20 text-amber-300 px-3 py-1 rounded-full font-bold border border-amber-400/30 shadow-xs">
                📒 Aceita Fiado
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Barra de Busca com Sombra Suave e Focus Ring */}
      <div className="max-w-3xl mx-auto px-4 -mt-6">
        <div className="relative bg-white rounded-2xl shadow-md shadow-slate-200/70 border border-slate-200/80 focus-within:ring-4 focus-within:ring-emerald-500/10 focus-within:border-emerald-500 transition-all">
          <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 stroke-[2]" />
          <input
            type="text"
            placeholder="O que você procura hoje?"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3.5 bg-transparent rounded-2xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Pílulas de Categoria com Microinteração */}
      <div className="max-w-3xl mx-auto px-4 mt-5">
        <div className="flex gap-2 overflow-x-auto pb-1.5 [&::-webkit-scrollbar]:hidden">
          {categories.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-2xl text-xs font-extrabold whitespace-nowrap transition-all duration-150 active:scale-95 ${
                  active
                    ? "bg-slate-900 text-white shadow-md shadow-slate-900/20"
                    : "bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50 hover:border-slate-300 shadow-xs"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid de Produtos com Cards Modernos */}
      <main className="max-w-3xl mx-auto px-4 mt-5">
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-[32px] p-12 text-center border border-slate-200/70 shadow-sm shadow-slate-200/40">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
              <Package className="w-7 h-7 stroke-[1.75]" />
            </div>
            <p className="text-sm font-extrabold text-slate-800">
              Nenhum produto encontrado.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Tente buscar com outro termo ou selecionar outra categoria.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 sm:gap-4">
            {filteredProducts.map((p) => {
              const qty = getQty(p.id);
              const outOfStock = p.stock <= 0;

              return (
                <div
                  key={p.id}
                  className="group bg-white rounded-[28px] border border-slate-200/70 shadow-sm shadow-slate-200/50 hover:shadow-xl hover:shadow-slate-300/40 hover:-translate-y-1 hover:border-emerald-200/80 transition-all duration-200 overflow-hidden flex flex-col"
                >
                  <div className="relative aspect-square bg-slate-50 flex items-center justify-center overflow-hidden">
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt={p.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <Package className="w-10 h-10 text-slate-300 stroke-[1.75]" />
                    )}

                    {outOfStock && (
                      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center">
                        <span className="bg-white text-slate-900 text-[11px] font-extrabold px-3 py-1 rounded-full shadow-md">
                          Esgotado
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <h2 className="font-extrabold text-sm text-slate-900 leading-snug line-clamp-2 group-hover:text-emerald-700 transition-colors">
                        {p.name}
                      </h2>
                      {p.description && (
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-1 font-medium">
                          {p.description}
                        </p>
                      )}
                    </div>

                    <div className="mt-3.5 flex items-center justify-between gap-2">
                      <span className="font-extrabold text-base sm:text-lg text-slate-900 tracking-tight">
                        {formatBRL(p.price)}
                      </span>

                      {qty === 0 ? (
                        <button
                          onClick={() => addToCart(p)}
                          disabled={outOfStock}
                          style={{
                            backgroundColor: outOfStock ? undefined : brandColor,
                          }}
                          className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl text-white flex items-center justify-center hover:opacity-95 hover:scale-105 active:scale-90 transition-all disabled:bg-slate-200 disabled:text-slate-400 shrink-0 shadow-md shadow-black/10"
                          aria-label="Adicionar"
                        >
                          <Plus className="w-5 h-5 stroke-[2.2]" />
                        </button>
                      ) : (
                        <div className="flex items-center bg-slate-900 text-white rounded-2xl p-1 gap-1 shadow-md">
                          <button
                            onClick={() => updateQty(p.id, -1)}
                            className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-white/20 active:scale-90 transition"
                          >
                            <Minus className="w-3.5 h-3.5 stroke-[2.2]" />
                          </button>
                          <span className="text-xs font-extrabold w-4 text-center">
                            {qty}
                          </span>
                          <button
                            onClick={() => addToCart(p)}
                            className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-white/20 active:scale-90 transition"
                          >
                            <Plus className="w-3.5 h-3.5 stroke-[2.2]" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Botão Flutuante de Sacola (Dock Island) */}
      {totalItems > 0 && (
        <div className="fixed bottom-4 inset-x-4 z-40 max-w-lg mx-auto">
          <button
            onClick={() => setCartOpen(true)}
            className="w-full bg-slate-900/95 hover:bg-slate-900 backdrop-blur-xl border border-slate-800 text-white px-5 py-4 rounded-[26px] shadow-2xl shadow-slate-900/30 flex items-center justify-between hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-150 ring-1 ring-black/10"
          >
            <div className="flex items-center gap-3.5">
              <div
                style={{ backgroundColor: brandColor }}
                className="relative text-white w-10 h-10 rounded-2xl flex items-center justify-center font-extrabold text-sm shadow-md"
              >
                {totalItems}
              </div>
              <div className="text-left">
                <p className="text-sm font-extrabold leading-none">Ver sacola</p>
                <p className="text-[11px] text-slate-400 mt-1 font-medium">
                  Finalizar no WhatsApp
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 font-extrabold text-base sm:text-lg">
              {formatBRL(totalPrice)}
              <ChevronRight className="w-5 h-5 text-white/80" />
            </div>
          </button>
        </div>
      )}

      {cartOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg max-h-[92vh] rounded-t-[36px] sm:rounded-[36px] flex flex-col overflow-hidden shadow-2xl border border-slate-100 ring-1 ring-black/5">
            <div className="pt-3 pb-1 flex justify-center sm:hidden">
              <div className="w-12 h-1 bg-slate-200 rounded-full" />
            </div>

            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  style={{ backgroundColor: `${brandColor}20`, color: brandColor }}
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                >
                  <ShoppingBag className="w-5 h-5 stroke-[2]" />
                </div>
                <div>
                  <h2 className="font-extrabold text-lg text-slate-900 leading-none">Sua Sacola</h2>
                  <p className="text-xs text-slate-400 font-medium mt-1">Revise seus itens e finalize</p>
                </div>
              </div>
              <button
                onClick={() => setCartOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 active:scale-95 rounded-full transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
              {/* Lista de Itens no Carrinho */}
              <div className="space-y-2.5">
                {cart.map(({ product, qty }) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between bg-slate-50 border border-slate-100 p-3.5 rounded-2xl shadow-xs"
                  >
                    <div className="min-w-0 pr-3">
                      <p className="font-extrabold text-sm text-slate-900 truncate">
                        {product.name}
                      </p>
                      <p
                        style={{ color: brandColor }}
                        className="text-xs font-extrabold mt-0.5"
                      >
                        {formatBRL(product.price * qty)}
                      </p>
                    </div>
                    <div className="flex items-center bg-white border border-slate-200/80 rounded-xl p-0.5 gap-1 shadow-xs">
                      <button
                        onClick={() => updateQty(product.id, -1)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-700 active:scale-90 transition"
                      >
                        <Minus className="w-3.5 h-3.5 stroke-[2]" />
                      </button>
                      <span className="text-xs font-extrabold w-5 text-center text-slate-900">
                        {qty}
                      </span>
                      <button
                        onClick={() => addToCart(product)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-700 active:scale-90 transition"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2]" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Dados do Cliente */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Seus dados
                </label>
                <input
                  type="text"
                  placeholder="Seu nome completo *"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 shadow-xs focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none transition-all"
                />
              </div>

              {/* Tipo de Entrega */}
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl">
                  <button
                    onClick={() => setDeliveryType("entrega")}
                    className={`py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all ${
                      deliveryType === "entrega"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <MapPin className="w-3.5 h-3.5" /> Entrega
                  </button>
                  <button
                    onClick={() => setDeliveryType("retirada")}
                    className={`py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all ${
                      deliveryType === "retirada"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <StoreIcon className="w-3.5 h-3.5" /> Retirar na loja
                  </button>
                </div>

                {deliveryType === "entrega" && (
                  <input
                    type="text"
                    placeholder="Rua, número e bairro *"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 shadow-xs focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none transition-all"
                  />
                )}
              </div>

              {/* Forma de Pagamento */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Como vai pagar?
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {PAYMENT_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const selected = paymentMethod === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => setPaymentMethod(opt.id)}
                        style={{
                          borderColor: selected ? brandColor : undefined,
                        }}
                        className={`p-3.5 rounded-2xl border-2 text-left transition-all duration-150 hover:-translate-y-0.5 active:scale-[0.98] ${
                          selected
                            ? "bg-slate-50 shadow-sm"
                            : "border-slate-100 bg-slate-50/70 hover:border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <Icon
                            style={{ color: selected ? brandColor : undefined }}
                            className={`w-5 h-5 stroke-[2] ${selected ? "" : "text-slate-400"}`}
                          />
                          {opt.highlight && (
                            <span className="text-[10px] font-extrabold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                              Popular
                            </span>
                          )}
                        </div>
                        <p className="font-extrabold text-sm text-slate-900 mt-2">{opt.label}</p>
                        <p className="text-[11px] text-slate-500 font-medium">{opt.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <textarea
                placeholder="Alguma observação? (tamanho, cor, troco...)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 shadow-xs focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none transition-all"
              />
            </div>

            <div className="p-5 sm:p-6 border-t border-slate-100 bg-white shadow-lg">
              <button
                onClick={handleWhatsAppCheckout}
                style={{ backgroundColor: brandColor }}
                className="w-full hover:opacity-95 hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98] text-white py-4 px-4 rounded-2xl font-extrabold text-sm sm:text-base shadow-lg shadow-black/15 flex items-center justify-center gap-2.5 transition-all duration-150"
              >
                <MessageCircle className="w-5 h-5 stroke-[2]" />
                <span>Enviar pedido no Zap • {formatBRL(totalPrice)}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rodapé com Mascote */}
      <footer className="py-10 text-center text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-center gap-2">
        <div className="flex items-center gap-2">
          <span>Tecnologia oficial</span>
          <img src="/logo.png" alt="meufiadim" className="h-6 w-auto inline-block" />
        </div>
        <span className="hidden sm:inline text-slate-300">•</span>
        <span>Compre Agora, Pague Depois!</span>
      </footer>
    </div>
  );
}
