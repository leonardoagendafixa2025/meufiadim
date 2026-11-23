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
    <div className="min-h-screen bg-[#F7F8FA] text-gray-900 pb-28">
      <header
        style={{
          background: `linear-gradient(135deg, #111827 0%, #111827 55%, ${brandColor} 145%)`,
        }}
        className="text-white pt-8 pb-12 px-4 rounded-b-[2rem] shadow-lg"
      >
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <div
            style={{ backgroundColor: brandColor }}
            className="w-16 h-16 rounded-2xl text-white font-extrabold text-xl flex items-center justify-center shadow-lg shrink-0 overflow-hidden"
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
            <div className="flex items-center gap-1.5">
              <h1 className="text-xl font-bold truncate">{store.name}</h1>
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span className="inline-flex items-center gap-1.5 text-xs bg-white/10 backdrop-blur px-2.5 py-1 rounded-full text-emerald-300 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Aberto agora
              </span>
              <span className="inline-flex items-center gap-1 text-xs bg-amber-400/15 text-amber-300 px-2.5 py-1 rounded-full font-medium">
                📒 Aceita Fiado
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 -mt-6">
        <div className="relative bg-white rounded-2xl shadow-md shadow-gray-200/70">
          <Search className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="O que você procura hoje?"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3.5 bg-transparent rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 mt-5">
        <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
          {categories.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  active
                    ? "bg-gray-900 text-white shadow-sm"
                    : "bg-white text-gray-600 border border-gray-200/80 hover:bg-gray-100"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 mt-5">
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-gray-100">
            <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-600">
              Nenhum produto encontrado.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
            {filteredProducts.map((p) => {
              const qty = getQty(p.id);
              const outOfStock = p.stock <= 0;

              return (
                <div
                  key={p.id}
                  className="bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col"
                >
                  <div className="relative aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt={p.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package className="w-10 h-10 text-gray-300" />
                    )}

                    {outOfStock && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="bg-white text-gray-900 text-[11px] font-bold px-2.5 py-1 rounded-full">
                          Esgotado
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="p-3 flex-1 flex flex-col justify-between">
                    <div>
                      <h2 className="font-semibold text-sm text-gray-900 leading-snug line-clamp-2">
                        {p.name}
                      </h2>
                      {p.description && (
                        <p className="text-[11px] text-gray-400 mt-1 line-clamp-1">
                          {p.description}
                        </p>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="font-extrabold text-base text-gray-900 tracking-tight">
                        {formatBRL(p.price)}
                      </span>

                      {qty === 0 ? (
                        <button
                          onClick={() => addToCart(p)}
                          disabled={outOfStock}
                          style={{
                            backgroundColor: outOfStock ? undefined : brandColor,
                          }}
                          className="w-9 h-9 rounded-xl text-white flex items-center justify-center hover:opacity-90 active:scale-95 transition disabled:bg-gray-200 disabled:text-gray-400 shrink-0 shadow-sm"
                          aria-label="Adicionar"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      ) : (
                        <div className="flex items-center bg-gray-900 text-white rounded-xl p-0.5 gap-1">
                          <button
                            onClick={() => updateQty(p.id, -1)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs font-bold w-4 text-center">
                            {qty}
                          </span>
                          <button
                            onClick={() => addToCart(p)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10"
                          >
                            <Plus className="w-3.5 h-3.5" />
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

      {totalItems > 0 && (
        <div className="fixed bottom-4 inset-x-4 z-30 max-w-3xl mx-auto">
          <button
            onClick={() => setCartOpen(true)}
            className="w-full bg-gray-900 text-white px-5 py-4 rounded-2xl shadow-2xl shadow-gray-900/30 flex items-center justify-between active:scale-[0.99] transition"
          >
            <div className="flex items-center gap-3">
              <div
                style={{ backgroundColor: brandColor }}
                className="relative text-white w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm"
              >
                {totalItems}
              </div>
              <div className="text-left">
                <p className="text-sm font-bold leading-none">Ver sacola</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Finalizar no WhatsApp
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 font-extrabold text-base">
              {formatBRL(totalPrice)}
              <ChevronRight className="w-5 h-5 text-white/80" />
            </div>
          </button>
        </div>
      )}

      {cartOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:max-w-lg max-h-[90vh] rounded-t-[2rem] sm:rounded-3xl flex flex-col overflow-hidden">
            <div className="pt-3 pb-1 flex justify-center sm:hidden">
              <div className="w-10 h-1.5 bg-gray-200 rounded-full" />
            </div>

            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag style={{ color: brandColor }} className="w-5 h-5" />
                <h2 className="font-bold text-lg">Sua Sacola</h2>
              </div>
              <button
                onClick={() => setCartOpen(false)}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div className="space-y-3">
                {cart.map(({ product, qty }) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between bg-gray-50 p-3 rounded-2xl"
                  >
                    <div className="min-w-0 pr-3">
                      <p className="font-semibold text-sm truncate">
                        {product.name}
                      </p>
                      <p
                        style={{ color: brandColor }}
                        className="text-xs font-bold mt-0.5"
                      >
                        {formatBRL(product.price * qty)}
                      </p>
                    </div>
                    <div className="flex items-center bg-white border border-gray-200 rounded-xl p-0.5 gap-1">
                      <button
                        onClick={() => updateQty(product.id, -1)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs font-bold w-5 text-center">
                        {qty}
                      </span>
                      <button
                        onClick={() => addToCart(product)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Seus dados
                </label>
                <input
                  type="text"
                  placeholder="Seu nome completo *"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-2xl">
                  <button
                    onClick={() => setDeliveryType("entrega")}
                    className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                      deliveryType === "entrega"
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500"
                    }`}
                  >
                    <MapPin className="w-3.5 h-3.5" /> Entrega
                  </button>
                  <button
                    onClick={() => setDeliveryType("retirada")}
                    className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                      deliveryType === "retirada"
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500"
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
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400">
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
                        className={`p-3 rounded-2xl border-2 text-left transition-all ${
                          selected
                            ? "bg-gray-50"
                            : "border-gray-100 bg-gray-50 hover:border-gray-200"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <Icon
                            style={{ color: selected ? brandColor : undefined }}
                            className={`w-5 h-5 ${selected ? "" : "text-gray-500"}`}
                          />
                          {opt.highlight && (
                            <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-md">
                              Popular
                            </span>
                          )}
                        </div>
                        <p className="font-bold text-sm mt-2">{opt.label}</p>
                        <p className="text-[11px] text-gray-500">{opt.desc}</p>
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
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>

            <div className="p-5 border-t border-gray-100 bg-white">
              <button
                onClick={handleWhatsAppCheckout}
                style={{ backgroundColor: brandColor }}
                className="w-full hover:opacity-95 active:scale-[0.99] text-white py-4 rounded-2xl font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition"
              >
                <MessageCircle className="w-5 h-5" />
                Enviar pedido • {formatBRL(totalPrice)}
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="py-8 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
        <span>Tecnologia</span>
        <img src="/logo.png" alt="meufiadim" className="h-5 w-auto inline-block" />
      </footer>
    </div>
  );
}
