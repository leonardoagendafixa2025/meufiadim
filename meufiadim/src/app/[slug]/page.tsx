"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  Sun,
  Moon,
  User,
  Bike,
  Calendar,
  Flame,
  Star,
  Beer,
  CupSoda,
  Wine,
  Utensils,
  Cake,
  Package,
  Search,
  Plus,
  Minus,
  ShoppingBag,
  X,
  Store as StoreIcon,
  ChevronRight,
  MapPin,
  MessageCircle,
  ShieldCheck,
  QrCode,
  Banknote,
  CreditCard,
  BookOpen,
  Sparkles,
  Check,
  AlertCircle,
  Truck,
  Lock,
  Loader2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatBRL } from "@/lib/whatsapp";
import {
  formatCep,
  cleanCep,
  fetchViaCep,
  calculateDeliveryFee,
  type FreightCalculationResult,
} from "@/lib/viacep";
import {
  StoreCustomerAuthModal,
  type CustomerUser,
} from "@/components/store/StoreCustomerAuthModal";
import { StoreCustomerOrdersModal } from "@/components/store/StoreCustomerOrdersModal";
import { formatPhoneBR } from "@/lib/customer-auth";

interface Store {
  id: string;
  name: string;
  slug: string;
  whatsapp: string;
  status: "active" | "blocked";
  logo_url?: string | null;
  primary_color?: string | null;
  delivery_time?: string | null;
  min_order?: number | null;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  stock: number;
  image_url?: string;
  is_featured?: boolean;
}

interface Neighborhood {
  id: string;
  name: string;
  fee: number;
  min_order?: number;
  estimate?: string;
  active: boolean;
}

interface CepRange {
  id: string;
  start_cep: string;
  end_cep: string;
  fee: number;
  estimate?: string;
  active: boolean;
}

const PAYMENT_OPTIONS = [
  { id: "Fiado", label: "Fiado", desc: "Pendurar na conta", icon: BookOpen, highlight: true },
  { id: "Pix", label: "Pix", desc: "Aprovação na hora", icon: QrCode },
  { id: "Cartão", label: "Cartão", desc: "Crédito ou débito", icon: CreditCard },
  { id: "Dinheiro", label: "Dinheiro", desc: "Pagar na entrega", icon: Banknote },
];

// Mapeamento dinâmico e inteligente de ícones para categorias populares
function getCategoryIcon(categoryName: string, iconKey?: string) {
  const norm = (iconKey || categoryName).toLowerCase().trim();
  if (norm.includes("cervej") || norm.includes("chopp") || norm.includes("beer")) {
    return { icon: Beer, color: "text-amber-500", bg: "bg-amber-50", emoji: "🍺" };
  }
  if (norm.includes("refri") || norm.includes("refrigerante") || norm.includes("suco") || norm.includes("soda") || norm.includes("água") || norm.includes("agua")) {
    return { icon: CupSoda, color: "text-rose-500", bg: "bg-rose-50", emoji: "🥤" };
  }
  if (norm.includes("drink") || norm.includes("coquetel") || norm.includes("vinho") || norm.includes("dose") || norm.includes("destilad")) {
    return { icon: Wine, color: "text-purple-500", bg: "bg-purple-50", emoji: "🍸" };
  }
  if (norm.includes("prato") || norm.includes("refei") || norm.includes("tira") || norm.includes("gosto") || norm.includes("porç") || norm.includes("porc") || norm.includes("lanche") || norm.includes("burger") || norm.includes("pizza") || norm.includes("petisco")) {
    return { icon: Utensils, color: "text-emerald-500", bg: "bg-emerald-50", emoji: "🍽️" };
  }
  if (norm.includes("doce") || norm.includes("sobremesa") || norm.includes("pudim") || norm.includes("açaí") || norm.includes("sorvete") || norm.includes("cake")) {
    return { icon: Cake, color: "text-pink-500", bg: "bg-pink-50", emoji: "🍮" };
  }
  return { icon: Package, color: "text-blue-500", bg: "bg-blue-50", emoji: "📦" };
}

export default function TenantStorePage() {
  const router = useRouter();
  const { slug } = useParams<{ slug: string }>();

  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Tema Claro / Escuro
  const [isDark, setIsDark] = useState(false);

  // Status e Entrega
  const [isOpen, setIsOpen] = useState(true);
  const [deliveryType, setDeliveryType] = useState<"entrega" | "retirada">("entrega");
  const [deliveryTime, setDeliveryTime] = useState("30min");
  const [minOrder, setMinOrder] = useState(25.0);
  const [startingDeliveryFee, setStartingDeliveryFee] = useState<number | null>(5.0);

  // Regras de frete cadastradas
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  const [cepRanges, setCepRanges] = useState<CepRange[]>([]);
  const [categoryIconsMap, setCategoryIconsMap] = useState<Record<string, string>>({});
  const [featuredProductIds, setFeaturedProductIds] = useState<string[]>([]);

  // Busca e Categoria ativa (Scroll Spy)
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("Todos");

  // Carrinho e Checkout
  const [cart, setCart] = useState<{ product: Product; qty: number }[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>("");
  const [cepInput, setCepInput] = useState("");
  const [addressStreet, setAddressStreet] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [addressComp, setAddressComp] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Fiado");
  const [notes, setNotes] = useState("");
  const [calculatedFreight, setCalculatedFreight] = useState<number>(5.0);

  // Autenticação do Cliente & Histórico de Compras na Vitrine
  const [customerUser, setCustomerUser] = useState<CustomerUser | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"login" | "register">("login");
  const [authPromptMessage, setAuthPromptMessage] = useState<string | undefined>(undefined);
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);

  // Modal de Detalhes do Produto
  const [selectedProductDetails, setSelectedProductDetails] = useState<Product | null>(null);
  const [modalQty, setModalQty] = useState(1);

  // Modal de Consulta de Frete por CEP no Cabeçalho
  const [freightModalOpen, setFreightModalOpen] = useState(false);
  const [modalCepInput, setModalCepInput] = useState("");
  const [modalFreightResult, setModalFreightResult] = useState<FreightCalculationResult | null>(null);
  const [loadingFreight, setLoadingFreight] = useState(false);

  // Consulta de Frete por CEP no Checkout
  const [checkoutFreightResult, setCheckoutFreightResult] = useState<FreightCalculationResult | null>(null);
  const [loadingCheckoutCep, setLoadingCheckoutCep] = useState(false);
  const [freightError, setFreightError] = useState<string | null>(null);

  // Notificação Toast rápida
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2200);
  };

  const handleLookupCep = async (cepToTest: string, isFromModal = false) => {
    const digits = cleanCep(cepToTest);
    if (digits.length !== 8) {
      if (isFromModal) alert("Digite um CEP válido com 8 dígitos.");
      return;
    }

    if (isFromModal) {
      setLoadingFreight(true);
      setModalFreightResult(null);
    } else {
      setLoadingCheckoutCep(true);
      setFreightError(null);
    }

    const viaCep = await fetchViaCep(digits);
    if (!viaCep) {
      if (isFromModal) {
        setModalFreightResult({
          found: false,
          fee: 0,
          message: "CEP não encontrado ou inválido.",
        });
        setLoadingFreight(false);
      } else {
        setFreightError("CEP não encontrado. Verifique os números digitados.");
        setLoadingCheckoutCep(false);
      }
      return;
    }

    if (!isFromModal) {
      if (viaCep.logradouro) setAddressStreet(viaCep.logradouro);
      if (viaCep.bairro) setSelectedNeighborhood(viaCep.bairro);
    }

    // Calcula de acordo com a regra de prioridade: 1º Bairro -> 2º Faixa de CEP
    const result = calculateDeliveryFee({
      neighborhoodName: viaCep.bairro,
      cep: digits,
      neighborhoods,
      cepRanges,
    });

    if (isFromModal) {
      setModalFreightResult({
        ...result,
        matchedName: result.matchedName || viaCep.bairro || `${viaCep.localidade} - ${viaCep.uf}`,
      });
      setLoadingFreight(false);
    } else {
      setCheckoutFreightResult(result);
      setLoadingCheckoutCep(false);
      if (result.found) {
        setCalculatedFreight(result.fee);
        setFreightError(null);
      } else {
        setFreightError(result.message || "Não entregamos nesse endereço ou região.");
      }
    }
  };

  useEffect(() => {
    async function loadStore() {
      if (!slug) return;
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

        // Busca status de expediente e configurações de entrega
        try {
          const res = await fetch(`/api/store/status?slug=${slug}`);
          const data = await res.json();
          if (data && typeof data.is_open === "boolean") {
            setIsOpen(data.is_open);
          }
        } catch {
          // ignore
        }

        try {
          const resDeliv = await fetch(`/api/store/delivery?slug=${slug}`);
          const dataDeliv = await resDeliv.json();
          if (dataDeliv?.ok) {
            if (dataDeliv.neighborhoods) setNeighborhoods(dataDeliv.neighborhoods);
            if (dataDeliv.cep_ranges) setCepRanges(dataDeliv.cep_ranges);
            if (dataDeliv.category_icons) setCategoryIconsMap(dataDeliv.category_icons);
            if (dataDeliv.featured_ids) setFeaturedProductIds(dataDeliv.featured_ids);
            if (dataDeliv.delivery_time) setDeliveryTime(dataDeliv.delivery_time);
            if (dataDeliv.min_order !== undefined) setMinOrder(dataDeliv.min_order);

            // Calcula menor frete ativo
            const activeFees = (dataDeliv.neighborhoods || [])
              .filter((n: Neighborhood) => n.active)
              .map((n: Neighborhood) => Number(n.fee));

            if (activeFees.length > 0) {
              setStartingDeliveryFee(Math.min(...activeFees));
            }
          }
        } catch {
          // fallback padrão
        }
      }
      setLoading(false);
    }

    loadStore();
  }, [slug]);

  // Restaurar e sincronizar sessão do cliente para esta loja
  useEffect(() => {
    if (!store?.id) return;
    try {
      const saved = localStorage.getItem(`meufiadim_customer_${store.id}`);
      if (saved) {
        const parsed = JSON.parse(saved) as CustomerUser;
        if (parsed && parsed.id) {
          setCustomerUser(parsed);
          setCustomerName(parsed.name || "");
          setCustomerPhone(parsed.phone || "");

          // Validar e atualizar saldo/dados em background
          fetch("/api/store/customer/auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "session",
              storeId: store.id,
              customerId: parsed.id,
              phone: parsed.phone,
            }),
          })
            .then((res) => res.json())
            .then((data) => {
              if (data.success && data.customer) {
                setCustomerUser(data.customer);
                try {
                  localStorage.setItem(
                    `meufiadim_customer_${store.id}`,
                    JSON.stringify(data.customer)
                  );
                } catch {}
              }
            })
            .catch(() => {});
        }
      }
    } catch (e) {
      console.error("Erro ao carregar sessão local do cliente:", e);
    }
  }, [store?.id]);

  // Lista de categorias únicas derivadas dos produtos e categorias configuradas
  const categories = useMemo(() => {
    const fromProds = products.map((p) => p.category?.trim() || "Geral");
    const fromIcons = Object.keys(categoryIconsMap).filter(Boolean);
    const list = Array.from(new Set([...fromProds, ...fromIcons]));
    return list.filter(Boolean);
  }, [products, categoryIconsMap]);

  // Produtos destacados
  const featuredProducts = useMemo(() => {
    return products.filter((p) => {
      if (featuredProductIds.includes(p.id)) return true;
      if (p.is_featured) return true;
      return false;
    });
  }, [products, featuredProductIds]);

  // Produtos filtrados por busca e categoria
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        search.trim() === "" ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(search.toLowerCase()));
      return matchSearch;
    });
  }, [products, search]);

  // Agrupamento por categoria
  const groupedProducts = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const cat of categories) {
      map.set(cat, []);
    }
    for (const p of filteredProducts) {
      const c = p.category?.trim() || "Geral";
      if (!map.has(c)) {
        map.set(c, []);
      }
      map.get(c)!.push(p);
    }
    return map;
  }, [categories, filteredProducts]);

  // Quantidade no carrinho
  const getQty = (id: string) => cart.find((i) => i.product.id === id)?.qty || 0;

  const addToCart = (product: Product, quantityToAdd: number = 1) => {
    if (!isOpen) {
      showToast("Esta loja está fechada no momento para novos pedidos.");
      return;
    }
    setCart((prev) => {
      const exists = prev.find((i) => i.product.id === product.id);
      if (exists) {
        return prev.map((i) =>
          i.product.id === product.id
            ? { ...i, qty: Math.min(i.qty + quantityToAdd, product.stock || 99) }
            : i
        );
      }
      return [...prev, { product, qty: Math.min(quantityToAdd, product.stock || 99) }];
    });
    showToast(`"${product.name}" adicionado à sacola!`);
  };

  const updateQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.product.id === id ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0)
    );
  };

  const totalItems = cart.reduce((acc, i) => acc + i.qty, 0);
  const subtotalPrice = cart.reduce((acc, i) => acc + i.product.price * i.qty, 0);
  const deliveryCost = deliveryType === "retirada" ? 0 : calculatedFreight;
  const finalTotalPrice = subtotalPrice + deliveryCost;

  const brandColor = store?.primary_color || "#059669";

  const initials = store?.name
    ? store.name
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
    : "LF";

  // Rolar suavemente até a categoria clicada
  const scrollToCategory = (categoryName: string) => {
    setActiveCategory(categoryName);
    const element = document.getElementById(`cat-section-${categoryName}`);
    if (element) {
      const offset = 90;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    }
  };

  // Enviar pedido no WhatsApp com gravação no banco e verificação obrigatória de login
  const handleWhatsAppCheckout = async () => {
    if (!isOpen) {
      alert("Esta loja está fechada no momento e não está aceitando novos pedidos.");
      return;
    }

    // REGRA FUNDAMENTAL: SÓ CONSEGUE COMPRAR SE ESTIVER LOGADO!
    if (!customerUser) {
      setAuthPromptMessage(
        "Para finalizar o seu pedido e acompanhar suas compras, entre com seu celular e senha ou crie sua conta em 10 segundos!"
      );
      setAuthModalMode("login");
      setShowAuthModal(true);
      return;
    }

    if (cart.length === 0) {
      alert("Sua sacola está vazia!");
      return;
    }

    if (deliveryType === "entrega") {
      if (freightError) {
        alert(
          "Atenção: Não atendemos este endereço para entrega. Por favor, ajuste o CEP/bairro ou selecione a opção Retirada na Loja."
        );
        return;
      }
      if (!selectedNeighborhood && !addressStreet) {
        alert("Por favor, informe seu CEP, selecione seu bairro ou digite o endereço de entrega.");
        return;
      }
    }
    if (deliveryType === "entrega" && minOrder && subtotalPrice < minOrder) {
      alert(`O pedido mínimo para entrega é de ${formatBRL(minOrder)}.`);
      return;
    }

    setSubmittingOrder(true);

    const itemsText = cart
      .map(
        (i) =>
          `• ${i.qty}x ${i.product.name} — ${formatBRL(i.product.price * i.qty)}`
      )
      .join("\n");

    const destinationAddress =
      deliveryType === "retirada"
        ? "🏬 Retirada no balcão da loja"
        : `📍 Entrega: ${addressStreet || "Endereço"} ${addressNumber ? "nº " + addressNumber : ""} ${addressComp ? "(" + addressComp + ")" : ""} - Bairro: ${selectedNeighborhood || "Informado"} ${cepInput ? "(CEP " + cepInput + ")" : ""}`;

    try {
      // 1. Gravar venda no banco de dados vinculada ao cliente autenticado
      const res = await fetch("/api/store/customer/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId: store?.id,
          customerId: customerUser.id,
          totalAmount: finalTotalPrice,
          paymentMethod,
          deliveryType,
          freightFee: deliveryCost,
          address: destinationAddress,
          notes: notes.trim(),
          description: cart.map((i) => `${i.qty}x ${i.product.name}`).join(" • "),
          items: cart.map((i) => ({
            id: i.product.id,
            name: i.product.name,
            price: i.product.price,
            qty: i.qty,
          })),
        }),
      });

      const orderData = await res.json();
      if (!res.ok) {
        throw new Error(orderData.error || "Não foi possível registrar o pedido no sistema.");
      }

      // Se pagou no Fiado, atualiza o saldo localmente do cliente
      if (paymentMethod === "Fiado") {
        setCustomerUser((prev) =>
          prev
            ? {
                ...prev,
                balance: Number(((prev.balance || 0) + finalTotalPrice).toFixed(2)),
              }
            : null
        );
      }

      // 2. Gerar mensagem para o WhatsApp com identificação do cliente
      const lines = [
        `🛍️ *NOVO PEDIDO — ${store?.name || "Cardápio"}*`,
        ``,
        `👤 *Cliente:* ${customerUser.name} (${formatPhoneBR(customerUser.phone)})`,
        `🛵 *Modalidade:* ${deliveryType === "retirada" ? "RETIRADA NA LOJA" : "ENTREGA EM DOMICÍLIO"}`,
        destinationAddress,
        `💳 *Forma de Pagamento:* ${paymentMethod}`,
        ``,
        `📋 *ITENS:*`,
        itemsText,
        ``,
        `Subtotal: ${formatBRL(subtotalPrice)}`,
        deliveryType === "entrega" ? `Taxa de Entrega: ${formatBRL(deliveryCost)}` : `Frete: Grátis (Retirada)`,
        `💰 *VALOR TOTAL: ${formatBRL(finalTotalPrice)}*`,
      ];

      if (notes.trim()) {
        lines.push(``, `📝 *Observações:* ${notes.trim()}`);
      }

      const phone = (store?.whatsapp || "").replace(/\D/g, "");
      const formattedPhone = phone.startsWith("55") ? phone : `55${phone}`;

      window.open(
        `https://wa.me/${formattedPhone}?text=${encodeURIComponent(lines.join("\n"))}`,
        "_blank"
      );

      setCart([]);
      setCartOpen(false);
      showToast("Pedido gerado e salvo com sucesso! Redirecionando para o WhatsApp...");
    } catch (err: any) {
      alert("Atenção: " + (err.message || "Não foi possível salvar seu pedido. Tente novamente."));
    } finally {
      setSubmittingOrder(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] pb-24">
        <div className="h-44 bg-slate-200 animate-pulse rounded-b-[2.5rem]" />
        <div className="max-w-2xl mx-auto px-4 -mt-10 space-y-4">
          <div className="h-40 bg-white rounded-3xl shadow-sm animate-pulse" />
          <div className="h-12 bg-white rounded-2xl shadow-sm animate-pulse" />
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-40 bg-white rounded-3xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4 text-slate-400">
          <StoreIcon className="w-8 h-8 stroke-[1.75]" />
        </div>
        <h1 className="text-xl font-black text-slate-900">Loja não encontrada</h1>
        <p className="text-sm text-slate-500 mt-1">
          Verifique o link ou entre em contato com o comerciante.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen transition-colors duration-200 ${
        isDark ? "bg-[#0B0F19] text-slate-100" : "bg-[#F8FAFC] text-slate-900"
      } pb-36 font-sans`}
    >
      {/* Toast flutuante de confirmação */}
      {toastMessage && (
        <div className="fixed top-5 inset-x-4 z-50 flex justify-center pointer-events-none">
          <div className="bg-slate-900 text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-2 border border-slate-700/80 animate-in fade-in slide-in-from-top-4 duration-200 pointer-events-auto">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* 1. BARRA SUPERIOR (Botões Circulares) */}
      <header className="sticky top-0 z-30 pt-3 pb-2 px-4 sm:px-6 backdrop-blur-md bg-white/70 dark:bg-slate-950/70 border-b border-slate-100 dark:border-slate-800 transition-colors">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
          {/* Botão circular de voltar à esquerda */}
          <button
            onClick={() => {
              if (window.history.length > 1) {
                router.back();
              } else {
                router.push("/");
              }
            }}
            aria-label="Voltar"
            className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition-all"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2]" />
          </button>

          {/* Ações à direita: Tema e Perfil */}
          <div className="flex items-center gap-2">
            {/* Alternador de tema Claro / Escuro */}
            <button
              onClick={() => setIsDark((prev) => !prev)}
              aria-label="Alternar tema"
              className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition-all"
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-amber-400 stroke-[2]" />
              ) : (
                <Moon className="w-4 h-4 text-slate-600 stroke-[2]" />
              )}
            </button>

            {/* Botão de Perfil / Minha Conta & Histórico de Compras */}
            {customerUser ? (
              <button
                onClick={() => setShowOrdersModal(true)}
                aria-label="Minha Conta e Histórico"
                title={`Conectado como ${customerUser.name} - Ver Histórico`}
                className="h-10 px-3 rounded-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition-all"
              >
                <div
                  style={{ backgroundColor: `${brandColor}20`, color: brandColor }}
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0"
                >
                  {customerUser.name.slice(0, 1).toUpperCase()}
                </div>
                <span className="max-w-[70px] sm:max-w-[110px] truncate text-slate-900 dark:text-white font-extrabold">
                  {customerUser.name.split(" ")[0]}
                </span>
              </button>
            ) : (
              <button
                onClick={() => {
                  setAuthPromptMessage(undefined);
                  setAuthModalMode("login");
                  setShowAuthModal(true);
                }}
                aria-label="Entrar ou Cadastrar"
                title="Entrar ou Criar Conta"
                className="h-10 px-3.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-1.5 text-xs font-black text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition-all"
              >
                <User className="w-4 h-4 stroke-[2.2]" />
                <span className="hidden sm:inline">Entrar</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 2. CARD DE CABEÇALHO DA LOJA */}
      <section className="max-w-2xl mx-auto px-4 mt-10">
        <div className="bg-white dark:bg-slate-900 rounded-[28px] p-5 sm:p-6 shadow-md shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 relative">
          {/* Logo quadrada arredondada sobreposta ao canto superior esquerdo */}
          <div
            style={{ borderColor: brandColor }}
            className="absolute -top-7 left-5 sm:left-6 w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white dark:bg-slate-900 shadow-lg border-2 flex items-center justify-center overflow-hidden ring-4 ring-white dark:ring-slate-900"
          >
            {store.logo_url ? (
              <img
                src={store.logo_url}
                alt={store.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span
                style={{ color: brandColor }}
                className="font-black text-2xl tracking-tighter"
              >
                {initials}
              </span>
            )}
          </div>

          {/* Indicador de Status Aberto / Fechado (Alinhado à direita no topo) */}
          <div className="flex justify-end items-center mb-3">
            {isOpen ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-full border border-emerald-200/60 dark:border-emerald-800/50">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Aberto Agora
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-widest text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-2.5 py-1 rounded-full border border-rose-200/60 dark:border-rose-800/50">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                Fechado
              </span>
            )}
          </div>

          {/* Nome da Loja em destaque */}
          <div className="mt-4">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase">
              {store.name}
            </h1>
          </div>

          {/* Linha de Chips Informativos */}
          <div className="flex flex-wrap items-center gap-2 mt-3 text-xs font-semibold text-slate-600 dark:text-slate-300">
            {/* Tempo */}
            <div className="inline-flex items-center gap-1 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-200/70 dark:border-slate-700/60">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{deliveryTime}</span>
            </div>

            {/* Taxa a partir de & Botão Calcular Frete */}
            <button
              type="button"
              onClick={() => {
                setFreightModalOpen(true);
                setModalFreightResult(null);
                setModalCepInput("");
              }}
              className="inline-flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700/80 px-2.5 py-1 rounded-full border border-slate-200/70 dark:border-slate-700/60 active:scale-95 transition"
              title="Clique para calcular o frete para seu CEP"
            >
              <Bike className="w-3.5 h-3.5 text-slate-400" />
              <span>
                {startingDeliveryFee !== null
                  ? `A partir de ${formatBRL(startingDeliveryFee)}`
                  : "Frete a calcular"}
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-black underline">
                Calcular
              </span>
            </button>

            {/* Pedido mínimo */}
            {minOrder > 0 && (
              <div className="inline-flex items-center gap-1 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-200/70 dark:border-slate-700/60">
                <span>Mín {formatBRL(minOrder)}</span>
              </div>
            )}
          </div>

          {/* Seletor Segmentado: ENTREGA x RETIRADA */}
          <div className="w-full bg-slate-100 dark:bg-slate-800/90 p-1.5 rounded-2xl flex gap-1.5 mt-5">
            <button
              onClick={() => setDeliveryType("entrega")}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-150 ${
                deliveryType === "entrega"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm shadow-slate-300/40"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <Bike className="w-4 h-4 stroke-[2]" />
              <span>Entrega</span>
            </button>

            <button
              onClick={() => setDeliveryType("retirada")}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-150 ${
                deliveryType === "retirada"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm shadow-slate-300/40"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <StoreIcon className="w-4 h-4 stroke-[2]" />
              <span>Retirada</span>
            </button>
          </div>
        </div>
      </section>

      {/* 3. BARRA DE BUSCA */}
      <section className="max-w-2xl mx-auto px-4 mt-5">
        <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-sm shadow-slate-200/50 dark:shadow-none border border-slate-200/80 dark:border-slate-800 focus-within:ring-4 focus-within:ring-emerald-500/10 focus-within:border-emerald-500 transition-all flex items-center">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 pointer-events-none stroke-[2]" />
          <input
            type="text"
            placeholder="Você está com fome de quê?"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-10 py-3.5 bg-transparent rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 p-1 rounded-full text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </section>

      {/* 4. "EXPLORE O CARDÁPIO" (Carrossel Horizontal de Categorias) */}
      {categories.length > 0 && (
        <section className="max-w-2xl mx-auto px-4 mt-6">
          <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider mb-3">
            Explore o cardápio
          </h2>

          <div className="flex gap-2.5 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none snap-x">
            {categories.map((cat) => {
              const iconInfo = getCategoryIcon(cat, categoryIconsMap[cat]);
              const IconComponent = iconInfo.icon;
              const isSelected = activeCategory === cat;

              return (
                <button
                  key={cat}
                  onClick={() => scrollToCategory(cat)}
                  className={`snap-start min-w-[82px] max-w-[96px] bg-white dark:bg-slate-900 rounded-2xl p-2.5 flex flex-col items-center justify-center border transition-all duration-150 active:scale-95 shadow-xs ${
                    isSelected
                      ? "border-emerald-500 ring-2 ring-emerald-500/20 shadow-md"
                      : "border-slate-200/70 dark:border-slate-800 hover:border-slate-300 hover:shadow-xs"
                  }`}
                >
                  <div
                    className={`w-11 h-11 rounded-xl ${iconInfo.bg} dark:bg-slate-800 flex items-center justify-center mb-1.5 shadow-xs`}
                  >
                    <IconComponent className={`w-5 h-5 ${iconInfo.color} stroke-[2]`} />
                  </div>
                  <span className="text-[10px] font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-tight truncate w-full text-center">
                    {cat}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* 5. SEÇÃO "DESTAQUES" (Selo EM ALTA com ícone de fogo) */}
      {featuredProducts.length > 0 && (
        <section className="max-w-2xl mx-auto px-4 mt-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-200/80 dark:border-amber-800/60 mb-1">
                <Flame className="w-3 h-3 text-amber-500 fill-amber-500" />
                Em Alta
              </span>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-1.5">
                <span>Destaques</span>
                <Flame className="w-4 h-4 text-amber-500 fill-amber-500" />
              </h2>
            </div>
            <span className="text-xs font-bold text-slate-400">
              {featuredProducts.length} {featuredProducts.length === 1 ? "item" : "itens"}
            </span>
          </div>

          {/* Carrossel de Destaques */}
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none snap-x">
            {featuredProducts.map((p) => {
              return (
                <div
                  key={`feat-${p.id}`}
                  onClick={() => {
                    setSelectedProductDetails(p);
                    setModalQty(1);
                  }}
                  className="snap-start min-w-[220px] sm:min-w-[240px] bg-white dark:bg-slate-900 rounded-3xl p-3.5 border border-slate-200/80 dark:border-slate-800 shadow-sm shadow-slate-200/50 dark:shadow-none hover:shadow-md transition-all cursor-pointer relative group flex flex-col justify-between"
                >
                  {/* Selo TOP com Estrela */}
                  <div className="absolute top-4 right-4 z-10">
                    <span className="inline-flex items-center gap-1 bg-amber-400 text-slate-900 text-[10px] font-black uppercase px-2 py-0.5 rounded-full shadow-xs">
                      <Star className="w-3 h-3 fill-slate-900" />
                      TOP
                    </span>
                  </div>

                  {/* Foto do Destaque */}
                  <div className="w-full aspect-[4/3] rounded-2xl bg-slate-100 dark:bg-slate-800 overflow-hidden relative mb-3">
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt={p.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-slate-50 dark:bg-slate-800">
                        <Package className="w-8 h-8 text-slate-300 stroke-[1.5] mb-1" />
                        <span className="text-[10px] font-bold text-slate-400 line-clamp-1">
                          {p.name}
                        </span>
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-white line-clamp-1 group-hover:text-emerald-600 transition-colors">
                      {p.name}
                    </h3>
                    <div className="flex items-center justify-between mt-2">
                      <span className="font-black text-base text-slate-900 dark:text-white">
                        {formatBRL(p.price)}
                      </span>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          addToCart(p);
                        }}
                        style={{ backgroundColor: brandColor }}
                        className="w-8 h-8 rounded-full text-white flex items-center justify-center shadow-md active:scale-90 hover:scale-105 transition-transform"
                        aria-label="Adicionar destaque"
                      >
                        <Plus className="w-4 h-4 stroke-[2.5]" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 6. LISTAS DE PRODUTOS POR CATEGORIA (Grade de 2 Colunas) */}
      <main className="max-w-2xl mx-auto px-4 mt-8 space-y-8">
        {filteredProducts.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-[28px] p-10 text-center border border-slate-200/70 dark:border-slate-800 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-400">
              <Package className="w-7 h-7 stroke-[1.75]" />
            </div>
            <p className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
              Nenhum produto encontrado.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Verifique o termo buscado ou limpe os filtros.
            </p>
          </div>
        ) : (
          categories.map((categoryName) => {
            const categoryItems = groupedProducts.get(categoryName) || [];
            if (categoryItems.length === 0) return null;

            const catIcon = getCategoryIcon(categoryName, categoryIconsMap[categoryName]);
            const CategoryIconComponent = catIcon.icon;

            return (
              <section
                key={categoryName}
                id={`cat-section-${categoryName}`}
                className="scroll-mt-24"
              >
                {/* Cabeçalho da categoria com ícone, nome e contador à direita */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-800 mb-3.5">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{catIcon.emoji}</span>
                    <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      {categoryName}
                    </h2>
                  </div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {categoryItems.length}{" "}
                    {categoryItems.length === 1 ? "ITEM" : "ITENS"}
                  </span>
                </div>

                {/* Grade de 2 colunas no celular e tablet */}
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  {categoryItems.map((p) => {
                    const outOfStock = p.stock <= 0;

                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          setSelectedProductDetails(p);
                          setModalQty(1);
                        }}
                        className="group bg-white dark:bg-slate-900 rounded-3xl p-3 sm:p-3.5 border border-slate-200/80 dark:border-slate-800 shadow-sm shadow-slate-200/50 dark:shadow-none hover:shadow-md transition-all duration-200 flex flex-col justify-between cursor-pointer relative"
                      >
                        {/* Topo do Card: Nome do Produto */}
                        <div className="min-h-[38px] mb-2 pr-1">
                          <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-slate-100 line-clamp-2 leading-tight uppercase group-hover:text-emerald-600 transition-colors">
                            {p.name}
                          </h3>
                        </div>

                        {/* Base do Card: Preço à esquerda e Foto quadrada com botão '+' à direita */}
                        <div className="flex items-end justify-between gap-2 mt-auto">
                          {/* Preço */}
                          <div className="min-w-0 pb-1">
                            <span className="font-black text-xs sm:text-sm text-slate-900 dark:text-white tracking-tight block">
                              {formatBRL(p.price)}
                            </span>
                          </div>

                          {/* Foto quadrada arredondada com botão circular '+' sobreposto */}
                          <div className="relative shrink-0">
                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-slate-50 dark:bg-slate-800 overflow-hidden flex items-center justify-center border border-slate-100 dark:border-slate-800/80">
                              {p.image_url ? (
                                <img
                                  src={p.image_url}
                                  alt={p.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                              ) : (
                                <div className="p-2 text-center flex flex-col items-center justify-center">
                                  <span className="text-[11px] font-black uppercase text-slate-400 line-clamp-2 leading-none">
                                    {p.name}
                                  </span>
                                </div>
                              )}

                              {outOfStock && (
                                <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center">
                                  <span className="bg-white text-slate-900 text-[9px] font-black px-1.5 py-0.5 rounded-full">
                                    Esgotado
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Botão circular '+' sobreposto ao canto inferior direito da foto */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!outOfStock) addToCart(p);
                              }}
                              disabled={outOfStock}
                              style={{
                                backgroundColor: outOfStock ? "#CBD5E1" : brandColor,
                              }}
                              className="absolute -bottom-1 -right-1 w-7 h-7 sm:w-8 sm:h-8 rounded-full text-white flex items-center justify-center shadow-md active:scale-90 hover:scale-110 transition-transform disabled:cursor-not-allowed"
                              aria-label={`Adicionar ${p.name}`}
                            >
                              <Plus className="w-4 h-4 stroke-[2.5]" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}
      </main>

      {/* 7. BOTÃO FLUTUANTE DE SACOLA (Dock Island) */}
      {totalItems > 0 && (
        <div className="fixed bottom-4 inset-x-4 z-40 max-w-lg mx-auto animate-in slide-in-from-bottom-4 duration-200">
          <button
            onClick={() => setCartOpen(true)}
            className="w-full bg-slate-900/95 dark:bg-slate-800/95 hover:bg-slate-900 backdrop-blur-xl border border-slate-800 text-white px-5 py-4 rounded-[26px] shadow-2xl shadow-slate-900/30 flex items-center justify-between hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-150 ring-1 ring-white/10"
          >
            <div className="flex items-center gap-3.5">
              <div
                style={{ backgroundColor: brandColor }}
                className="relative text-white w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm shadow-md"
              >
                {totalItems}
              </div>
              <div className="text-left">
                <p className="text-sm font-black leading-none">Ver sacola</p>
                <p className="text-[11px] text-slate-400 mt-1 font-medium">
                  {deliveryType === "retirada" ? "Retirada no balcão" : "Entrega em domicílio"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 font-black text-base sm:text-lg">
              {formatBRL(finalTotalPrice)}
              <ChevronRight className="w-5 h-5 text-white/80" />
            </div>
          </button>
        </div>
      )}

      {/* 8. MODAL DE DETALHES DO PRODUTO */}
      {selectedProductDetails && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 w-full sm:max-w-md rounded-t-[32px] sm:rounded-[32px] overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800 ring-1 ring-black/10 flex flex-col max-h-[90vh]">
            {/* Foto grande do Produto */}
            <div className="relative aspect-[16/10] bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
              {selectedProductDetails.image_url ? (
                <img
                  src={selectedProductDetails.image_url}
                  alt={selectedProductDetails.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400 p-6">
                  <Package className="w-12 h-12 stroke-[1.5] mb-2" />
                  <span className="text-xs font-bold uppercase">{selectedProductDetails.name}</span>
                </div>
              )}

              <button
                onClick={() => setSelectedProductDetails(null)}
                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 sm:p-6 flex-1 overflow-y-auto space-y-4">
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  {selectedProductDetails.category || "Geral"}
                </span>
                <h3 className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                  {selectedProductDetails.name}
                </h3>
                <p className="text-lg font-black text-slate-900 dark:text-emerald-400 mt-1">
                  {formatBRL(selectedProductDetails.price)}
                </p>
              </div>

              {selectedProductDetails.description && (
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                  {selectedProductDetails.description}
                </p>
              )}

              {/* Seletor de Quantidade */}
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Quantidade
                </span>
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-2xl p-1 gap-2">
                  <button
                    onClick={() => setModalQty((q) => Math.max(1, q - 1))}
                    className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 active:scale-95 shadow-xs"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="font-black text-sm w-6 text-center text-slate-900 dark:text-white">
                    {modalQty}
                  </span>
                  <button
                    onClick={() => setModalQty((q) => Math.min(selectedProductDetails.stock || 99, q + 1))}
                    className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 active:scale-95 shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
              <button
                onClick={() => {
                  addToCart(selectedProductDetails, modalQty);
                  setSelectedProductDetails(null);
                }}
                disabled={selectedProductDetails.stock <= 0}
                style={{
                  backgroundColor:
                    selectedProductDetails.stock <= 0 ? "#CBD5E1" : brandColor,
                }}
                className="w-full text-white py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-black/15 active:scale-[0.98] transition-all"
              >
                <Plus className="w-5 h-5 stroke-[2.5]" />
                <span>
                  Adicionar • {formatBRL(selectedProductDetails.price * modalQty)}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CÁLCULO DE FRETE POR CEP NO CABEÇALHO */}
      {freightModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[28px] p-6 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-emerald-600" />
                <h3 className="font-black text-lg text-slate-900 dark:text-white">
                  Calcular Frete
                </h3>
              </div>
              <button
                onClick={() => setFreightModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
              Informe seu CEP para calcular a taxa de entrega e o prazo estimado para o seu endereço:
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="00000-000"
                value={modalCepInput}
                maxLength={9}
                onChange={(e) => setModalCepInput(formatCep(e.target.value))}
                className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-2xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={() => handleLookupCep(modalCepInput, true)}
                disabled={loadingFreight}
                style={{ backgroundColor: brandColor }}
                className="px-4 py-3 text-white rounded-2xl font-black text-xs shrink-0 active:scale-95 transition"
              >
                {loadingFreight ? "Buscando..." : "Calcular"}
              </button>
            </div>

            {modalFreightResult && (
              <div
                className={`p-4 rounded-2xl text-xs space-y-1.5 border ${
                  modalFreightResult.found
                    ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 text-emerald-900 dark:text-emerald-300"
                    : "bg-rose-50 dark:bg-rose-950/60 border-rose-200 text-rose-900 dark:text-rose-300"
                }`}
              >
                {modalFreightResult.found ? (
                  <>
                    <div className="flex items-center justify-between font-black text-sm">
                      <span>Taxa de Entrega:</span>
                      <span>{formatBRL(modalFreightResult.fee)}</span>
                    </div>
                    {modalFreightResult.estimate && (
                      <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                        ⏱️ Prazo estimado: {modalFreightResult.estimate}
                      </p>
                    )}
                    {modalFreightResult.matchedName && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-400">
                        📍 Região: {modalFreightResult.matchedName}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                    <span>{modalFreightResult.message || "Não entregamos nesse endereço ou região."}</span>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      {cartOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full sm:max-w-lg max-h-[92vh] rounded-t-[36px] sm:rounded-[36px] flex flex-col overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800 ring-1 ring-black/10">
            <div className="pt-3 pb-1 flex justify-center sm:hidden">
              <div className="w-12 h-1 bg-slate-200 dark:bg-slate-700 rounded-full" />
            </div>

            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  style={{ backgroundColor: `${brandColor}20`, color: brandColor }}
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                >
                  <ShoppingBag className="w-5 h-5 stroke-[2]" />
                </div>
                <div>
                  <h2 className="font-black text-lg text-slate-900 dark:text-white leading-none">
                    Sua Sacola
                  </h2>
                  <p className="text-xs text-slate-400 font-medium mt-1">
                    Revise seus itens e finalize o pedido
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCartOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
              {/* Lista de Itens no Carrinho */}
              <div className="space-y-2.5">
                {cart.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 py-6 font-semibold">
                    Sua sacola está vazia. Adicione itens para continuar!
                  </p>
                ) : (
                  cart.map(({ product, qty }) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 p-3.5 rounded-2xl shadow-xs"
                    >
                      <div className="min-w-0 pr-3">
                        <p className="font-extrabold text-sm text-slate-900 dark:text-slate-100 truncate">
                          {product.name}
                        </p>
                        <p
                          style={{ color: brandColor }}
                          className="text-xs font-black mt-0.5"
                        >
                          {formatBRL(product.price * qty)}
                        </p>
                      </div>
                      <div className="flex items-center bg-white dark:bg-slate-700 border border-slate-200/80 dark:border-slate-600 rounded-xl p-0.5 gap-1 shadow-xs">
                        <button
                          onClick={() => updateQty(product.id, -1)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 active:scale-90 transition"
                        >
                          <Minus className="w-3.5 h-3.5 stroke-[2]" />
                        </button>
                        <span className="text-xs font-black w-5 text-center text-slate-900 dark:text-white">
                          {qty}
                        </span>
                        <button
                          onClick={() => addToCart(product)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 active:scale-90 transition"
                        >
                          <Plus className="w-3.5 h-3.5 stroke-[2]" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Seletor Entrega x Retirada no Checkout */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Modalidade de Recebimento
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
                  <button
                    onClick={() => setDeliveryType("entrega")}
                    className={`py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                      deliveryType === "entrega"
                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                    }`}
                  >
                    <Bike className="w-3.5 h-3.5" /> Entrega
                  </button>
                  <button
                    onClick={() => setDeliveryType("retirada")}
                    className={`py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                      deliveryType === "retirada"
                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                    }`}
                  >
                    <StoreIcon className="w-3.5 h-3.5" /> Retirar na loja
                  </button>
                </div>
              </div>

              {/* Identificação do Cliente (Login Obrigatório) */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Identificação do Cliente
                </label>
                {customerUser ? (
                  <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        style={{ backgroundColor: `${brandColor}20`, color: brandColor }}
                        className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs"
                      >
                        {customerUser.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-900 dark:text-white leading-tight">
                          {customerUser.name}
                        </p>
                        <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatPhoneBR(customerUser.phone)}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthPromptMessage(undefined);
                        setAuthModalMode("login");
                        setShowAuthModal(true);
                      }}
                      className="text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline"
                    >
                      Trocar conta
                    </button>
                  </div>
                ) : (
                  <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 border-2 border-amber-200/80 dark:border-amber-800/60 rounded-2xl space-y-2.5">
                    <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-black text-xs uppercase tracking-wide">
                      <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <span>Login Obrigatório para Comprar</span>
                    </div>
                    <p className="text-xs text-amber-900 dark:text-amber-300 leading-snug font-medium">
                      Para finalizar seu pedido e acompanhar suas compras, você precisa entrar ou se cadastrar com seu celular e senha.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthPromptMessage(
                          "Para finalizar seu pedido, entre com seu celular e senha ou crie sua conta em 10 segundos!"
                        );
                        setAuthModalMode("login");
                        setShowAuthModal(true);
                      }}
                      style={{ backgroundColor: brandColor }}
                      className="w-full py-2.5 px-3 rounded-xl text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition"
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>Entrar ou Cadastrar Agora</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Endereço de Entrega (se for Entrega) */}
              {deliveryType === "entrega" && (
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-400">
                    Endereço para entrega
                  </label>

                  {/* Campo de CEP com máscara e busca automática */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500">
                        Calcular frete por CEP
                      </span>
                      {loadingCheckoutCep && (
                        <span className="text-[10px] text-emerald-600 font-bold animate-pulse">
                          Buscando endereço...
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="00000-000"
                        value={cepInput}
                        maxLength={9}
                        onChange={(e) => {
                          const formatted = formatCep(e.target.value);
                          setCepInput(formatted);
                          if (cleanCep(formatted).length === 8) {
                            handleLookupCep(formatted, false);
                          }
                        }}
                        className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleLookupCep(cepInput, false)}
                        disabled={loadingCheckoutCep}
                        className="px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold text-xs shrink-0 active:scale-95 transition"
                      >
                        Buscar
                      </button>
                    </div>

                    {/* Feedback do Frete calculado ou erro */}
                    {checkoutFreightResult && checkoutFreightResult.found && (
                      <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 rounded-xl flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
                        <span className="font-semibold">
                          Frete: {formatBRL(checkoutFreightResult.fee)} ({checkoutFreightResult.estimate || "30-50 min"})
                        </span>
                        <span className="text-[10px] uppercase font-bold text-emerald-600 bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md border border-emerald-200">
                          {checkoutFreightResult.ruleType === "neighborhood" ? "Bairro Atendido" : "Faixa CEP"}
                        </span>
                      </div>
                    )}

                    {freightError && (
                      <div className="p-2.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-1.5 font-medium">
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                        <span>{freightError}</span>
                      </div>
                    )}
                  </div>

                  {/* Seleção de Bairro se houver bairros cadastrados */}
                  {neighborhoods.filter((n) => n.active).length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[11px] font-bold text-slate-500">
                        Ou selecione seu bairro atendido:
                      </span>
                      <select
                        value={selectedNeighborhood}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedNeighborhood(val);
                          const found = neighborhoods.find((n) => n.name === val);
                          if (found) {
                            setCalculatedFreight(Number(found.fee));
                            setFreightError(null);
                            setCheckoutFreightResult({
                              found: true,
                              fee: Number(found.fee),
                              estimate: found.estimate,
                              ruleType: "neighborhood",
                            });
                          }
                        }}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="">Selecione seu bairro atendido *</option>
                        {neighborhoods
                          .filter((n) => n.active)
                          .map((n) => (
                            <option key={n.id} value={n.name}>
                              {n.name} — Frete {formatBRL(n.fee)} {n.estimate ? `(${n.estimate})` : ""}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}

                  <input
                    type="text"
                    placeholder="Rua / Avenida *"
                    value={addressStreet}
                    onChange={(e) => setAddressStreet(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Número *"
                      value={addressNumber}
                      onChange={(e) => setAddressNumber(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Complemento"
                      value={addressComp}
                      onChange={(e) => setAddressComp(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Forma de Pagamento */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-wider text-slate-400">
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
                        className={`p-3 rounded-2xl border-2 text-left transition-all duration-150 active:scale-[0.98] ${
                          selected
                            ? "bg-slate-50 dark:bg-slate-800 shadow-sm"
                            : "border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <Icon
                            style={{ color: selected ? brandColor : undefined }}
                            className={`w-5 h-5 stroke-[2] ${
                              selected ? "" : "text-slate-400"
                            }`}
                          />
                          {opt.highlight && (
                            <span className="text-[9px] font-black bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-200">
                              Popular
                            </span>
                          )}
                        </div>
                        <p className="font-black text-xs sm:text-sm text-slate-900 dark:text-white mt-1.5">
                          {opt.label}
                        </p>
                        <p className="text-[10px] text-slate-400 font-medium">{opt.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Observações */}
              <textarea
                placeholder="Observações do pedido (ex: sem cebola, ponto da carne, troco para 50...)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
              />

              {/* Resumo de Valores */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal</span>
                  <span className="font-bold">{formatBRL(subtotalPrice)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Frete</span>
                  <span className="font-bold">
                    {deliveryType === "retirada"
                      ? "Grátis (Retirada)"
                      : formatBRL(deliveryCost)}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-black text-slate-900 dark:text-white pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span>Total</span>
                  <span style={{ color: brandColor }}>{formatBRL(finalTotalPrice)}</span>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg">
              {customerUser ? (
                <button
                  onClick={handleWhatsAppCheckout}
                  disabled={!isOpen || cart.length === 0 || submittingOrder}
                  style={{ backgroundColor: isOpen ? brandColor : "#94A3B8" }}
                  className={`w-full hover:opacity-95 hover:shadow-xl active:scale-[0.98] text-white py-4 px-4 rounded-2xl font-black text-sm sm:text-base shadow-lg shadow-black/15 flex items-center justify-center gap-2.5 transition-all duration-150 ${
                    !isOpen || cart.length === 0 || submittingOrder ? "cursor-not-allowed opacity-60 shadow-none" : ""
                  }`}
                >
                  {submittingOrder ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Registrando Pedido...</span>
                    </>
                  ) : (
                    <>
                      <MessageCircle className="w-5 h-5 stroke-[2]" />
                      <span>
                        {isOpen
                          ? `Enviar pedido no Zap • ${formatBRL(finalTotalPrice)}`
                          : "Loja Fechada no Momento"}
                      </span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={() => {
                    setAuthPromptMessage(
                      "Para finalizar seu pedido, entre com seu celular e senha ou crie sua conta em 10 segundos!"
                    );
                    setAuthModalMode("login");
                    setShowAuthModal(true);
                  }}
                  style={{ backgroundColor: brandColor }}
                  className="w-full hover:opacity-95 hover:shadow-xl active:scale-[0.98] text-white py-4 px-4 rounded-2xl font-black text-sm sm:text-base shadow-lg shadow-black/15 flex items-center justify-center gap-2.5 transition-all duration-150"
                >
                  <Lock className="w-5 h-5 stroke-[2]" />
                  <span>Entrar / Cadastrar para Pedir • {formatBRL(finalTotalPrice)}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE LOGIN / CADASTRO DE CLIENTE */}
      {showAuthModal && store && (
        <StoreCustomerAuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          storeId={store.id}
          storeName={store.name}
          brandColor={brandColor}
          initialMode={authModalMode}
          promptMessage={authPromptMessage}
          onSuccess={(cust) => {
            setCustomerUser(cust);
            setCustomerName(cust.name);
            setCustomerPhone(cust.phone);
            showToast(`Olá, ${cust.name.split(" ")[0]}! Você está conectado.`);
          }}
        />
      )}

      {/* MODAL DE HISTÓRICO DE COMPRAS DO CLIENTE */}
      {showOrdersModal && customerUser && store && (
        <StoreCustomerOrdersModal
          isOpen={showOrdersModal}
          onClose={() => setShowOrdersModal(false)}
          customer={customerUser}
          storeId={store.id}
          storeName={store.name}
          brandColor={brandColor}
          onLogout={() => {
            try {
              localStorage.removeItem(`meufiadim_customer_${store.id}`);
            } catch {}
            setCustomerUser(null);
            setShowOrdersModal(false);
            showToast("Você saiu da sua conta com sucesso.");
          }}
          onNewOrderClick={() => {
            setShowOrdersModal(false);
            const el = document.getElementById("search-input");
            if (el) el.focus();
          }}
        />
      )}

      {/* RODAPÉ */}
      <footer className="py-12 text-center text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-center gap-2">
        <div className="flex items-center gap-2">
          <span>Tecnologia oficial</span>
          <img src="/logo.png" alt="meufiadim" className="h-6 w-auto inline-block" />
        </div>
        <span className="hidden sm:inline text-slate-300 dark:text-slate-700">•</span>
        <span>Compre Agora, Pague Depois!</span>
      </footer>
    </div>
  );
}
