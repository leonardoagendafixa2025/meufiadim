"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  ArrowRight,
  Sparkles,
  ShieldCheck,
  MessageCircle,
  BookOpen,
  Palette,
  CheckCircle2,
  Zap,
  Clock,
  Smartphone,
  Store,
  QrCode,
  TrendingUp,
  ChevronDown,
  Star,
  Users,
  ShoppingBag,
  BadgePercent,
  Check,
  CheckCheck,
  ArrowUpRight,
  BadgeAlert,
  Wallet,
  Play,
} from "lucide-react";
import { HeroVideo } from "@/components/HeroVideo";

// Variantes de animação suaves
const fadeIn: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
    },
  },
};

export default function LandingPage() {
  // Simulador de Fiado
  const [fiadoMensal, setFiadoMensal] = useState<number>(3500);

  // FAQ Accordion
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Segmentos selecionados
  const [activeSegment, setActiveSegment] = useState<number>(0);

  const segmentos = [
    {
      title: "Mercadinhos & Mercearias",
      desc: "Anote o pão, o leite e a compra do mês. No dia do pagamento, o cliente recebe o extrato com o Pix Copia e Cola pronto.",
      badge: "Mais Popular",
      metric: "+42% de recebimento no prazo",
    },
    {
      title: "Lojas de Roupas & Calçados",
      desc: "Venda na confiança para suas clientes fiéis, defina limites de crédito personalizados e controle quem pode comprar mais.",
      badge: "Varejo",
      metric: "Zero atrito na cobrança",
    },
    {
      title: "Marmitarias & Restaurantes",
      desc: "Fechamento semanal ou mensal de marmitas para empresas e vizinhos. Notificações automáticas direto no WhatsApp.",
      badge: "Alimentação",
      metric: "Economia de 15h por semana",
    },
    {
      title: "Autônomos & Revendedores",
      desc: "Para quem vende cosméticos, perfumes e produtos por catálogo. Sua vitrine virtual com fotos no Cloudinary para mandar no Zap.",
      badge: "Empreendedores",
      metric: "Profissionalismo total",
    },
  ];

  const faqs = [
    {
      q: "Preciso ter CNPJ para usar o meufiadim?",
      a: "Não! O meufiadim foi feito especialmente para comerciantes, autônomos e pequenos negócios. Você pode se cadastrar e receber tanto com CPF quanto com CNPJ.",
    },
    {
      q: "O dinheiro do Pix cai na minha conta?",
      a: "Sim, 100%! O Pix gerado para os seus clientes de fiado contém a sua própria chave Pix cadastrada no painel. O dinheiro vai direto do cliente para a sua conta bancária sem intermediação.",
    },
    {
      q: "Como funciona a cobrança automática no WhatsApp?",
      a: "Nosso robô inteligente dispara uma mensagem educada e personalizada no dia do vencimento combinado com o seu cliente, contendo o valor exato em aberto e o botão 'Copiar código Pix'. O cliente só clica, cola no banco dele e paga.",
    },
    {
      q: "Existe alguma mensalidade ou taxa fixa?",
      a: "Não cobramos nenhuma mensalidade fixa. Nosso modelo é ganha-ganha: cobramos apenas uma pequena porcentagem (5%) sobre o valor das vendas que você registrar na plataforma. Se você não vender, não paga nada.",
    },
    {
      q: "O meufiadim funciona no celular?",
      a: "Perfeitamente! O meufiadim é um PWA (Progressive Web App) ultra-rápido. Você pode instalá-lo como aplicativo na tela inicial do seu celular (Android ou iPhone) ou acessar direto pelo navegador no computador.",
    },
    {
      q: "Meus clientes precisam baixar algum aplicativo?",
      a: "Não! Seus clientes não precisam instalar nada. Eles recebem o link da sua vitrine pelo WhatsApp, escolhem os produtos e recebem os lembretes de cobrança direto no próprio WhatsApp que já usam todo dia.",
    },
  ];

  // Cálculos do simulador
  const recuperacaoEstimada = Math.round(fiadoMensal * 0.94);
  const horasEconomizadas = Math.round((fiadoMensal / 300) * 1.5);
  const taxaPlataforma = Math.round(fiadoMensal * 0.05);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-emerald-500 selection:text-white">
      {/* Background Decorativo Superior */}
      <div className="absolute top-0 inset-x-0 h-[650px] bg-gradient-to-b from-emerald-50/60 via-amber-50/20 to-transparent pointer-events-none -z-10" />

      {/* Floating Header */}
      <header className="sticky top-4 z-50 max-w-6xl mx-auto px-4">
        <nav className="bg-white/80 backdrop-blur-xl border border-slate-200/70 rounded-2xl px-4 sm:px-6 py-3 flex items-center justify-between shadow-sm shadow-slate-200/50">
          <Link href="/" className="flex items-center gap-2.5 group">
            <img
              src="/logo.png"
              alt="meufiadim"
              className="h-10 sm:h-11 w-auto object-contain transition-transform group-hover:scale-105"
            />
          </Link>

          {/* Links Desktop */}
          <div className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-600">
            <a href="#como-funciona" className="hover:text-emerald-600 transition">
              Como Funciona
            </a>
            <a href="#recursos" className="hover:text-emerald-600 transition">
              Recursos
            </a>
            <a href="#simulador" className="hover:text-emerald-600 transition">
              Simulador
            </a>
            <a href="#precos" className="hover:text-emerald-600 transition">
              Preço
            </a>
            <a href="#faq" className="hover:text-emerald-600 transition">
              FAQ
            </a>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-bold text-slate-700 hover:text-emerald-600 hover:bg-slate-100/70 rounded-xl transition"
            >
              Entrar
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-emerald-600/25 active:scale-95 transition"
            >
              Criar loja grátis
            </Link>
          </div>
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-24 space-y-32">
        {/* ========================================================================= */}
        {/* HERO SECTION                                                             */}
        {/* ========================================================================= */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center pt-4">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="lg:col-span-7 space-y-6 text-center lg:text-left"
          >
            {/* Pill Tag */}
            <motion.div variants={fadeIn} className="inline-flex items-center">
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/60 text-emerald-800 text-xs font-extrabold shadow-xs">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                Caderninho de Fiado Digital com Pix no WhatsApp
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={fadeIn}
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.12]"
            >
              O fiado organizado. <br />
              O cliente cobrado no{" "}
              <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 bg-clip-text text-transparent">
                WhatsApp com Pix
              </span>
              .
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              variants={fadeIn}
              className="text-slate-600 text-lg sm:text-xl leading-relaxed max-w-2xl mx-auto lg:mx-0 font-normal"
            >
              Diga adeus às anotações em papel que somem e à vergonha de cobrar.
              Crie sua vitrine online, controle os limites de fiado e deixe o robô
              cobrar no vencimento com o botão{" "}
              <strong className="text-slate-900 font-semibold">Copiar Código Pix</strong>.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              variants={fadeIn}
              className="pt-3 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
            >
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2.5 bg-gradient-to-r from-emerald-600 via-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white px-8 py-4 rounded-2xl font-extrabold text-base shadow-xl shadow-emerald-600/30 hover:shadow-emerald-600/40 active:scale-[0.98] transition group"
              >
                <span>Criar minha loja agora</span>
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </Link>

              <a
                href="#simulador"
                className="inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-6 py-4 rounded-2xl font-bold text-base shadow-xs transition"
              >
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                Simular meus ganhos
              </a>
            </motion.div>

            {/* Micro Prova Social */}
            <motion.div
              variants={fadeIn}
              className="pt-4 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-xs text-slate-500 font-medium"
            >
              <div className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600 font-bold" />
                <span>Zero mensalidade</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600 font-bold" />
                <span>Sem cartão de crédito</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600 font-bold" />
                <span>Pix direto na sua conta</span>
              </div>
            </motion.div>
          </motion.div>

          {/* Visual Showcase (Remotion Mockup com Badges Flutuantes) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="lg:col-span-5 relative flex justify-center"
          >
            {/* Glow effect de fundo */}
            <div className="absolute -inset-4 bg-gradient-to-tr from-emerald-400/25 to-amber-300/20 rounded-full blur-3xl -z-10" />

            <div className="relative">
              <HeroVideo />

              {/* Floating Badge 1: Pix Recebido */}
              <motion.div
                initial={{ opacity: 0, x: -30, y: 20 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                transition={{ delay: 0.8, duration: 0.6 }}
                className="hidden sm:flex absolute -left-10 top-16 bg-white/95 backdrop-blur-md p-3.5 rounded-2xl border border-slate-100 shadow-xl items-center gap-3 z-20"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                  ⚡
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                    Pix Recebido
                  </p>
                  <p className="text-sm font-extrabold text-slate-900">
                    + R$ 145,00 na conta
                  </p>
                </div>
              </motion.div>

              {/* Floating Badge 2: Cobrança WhatsApp */}
              <motion.div
                initial={{ opacity: 0, x: 30, y: -20 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                transition={{ delay: 1, duration: 0.6 }}
                className="hidden sm:flex absolute -right-8 bottom-20 bg-white/95 backdrop-blur-md p-3.5 rounded-2xl border border-slate-100 shadow-xl items-center gap-3 z-20"
              >
                <div className="w-10 h-10 rounded-xl bg-green-500 text-white flex items-center justify-center shadow-sm">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                    Zap Automático
                  </p>
                  <p className="text-sm font-extrabold text-slate-900">
                    Cobrança enviada com Pix
                  </p>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </section>

        {/* ========================================================================= */}
        {/* LOGO STRIP / NÚMEROS DE IMPACTO                                           */}
        {/* ========================================================================= */}
        <section className="bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950 text-white rounded-3xl p-8 sm:p-12 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-y md:divide-y-0 md:divide-x divide-slate-800">
            <div className="pt-4 md:pt-0">
              <p className="text-3xl sm:text-4xl font-extrabold text-emerald-400 tracking-tight">
                98%
              </p>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">
                De taxa de recebimento dos fiados
              </p>
            </div>
            <div className="pt-4 md:pt-0">
              <p className="text-3xl sm:text-4xl font-extrabold text-amber-400 tracking-tight">
                30s
              </p>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">
                Para criar sua vitrine com sua logo
              </p>
            </div>
            <div className="pt-4 md:pt-0">
              <p className="text-3xl sm:text-4xl font-extrabold text-emerald-400 tracking-tight">
                0 R$
              </p>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">
                De custo fixo ou mensalidade
              </p>
            </div>
            <div className="pt-4 md:pt-0">
              <p className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                100%
              </p>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">
                Do Pix direto na sua conta bancária
              </p>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* BENTO GRID DE RECURSOS                                                    */}
        {/* ========================================================================= */}
        <section id="recursos" className="space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-4">
            <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200/60">
              Tudo o que você precisa
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
              Feito para quem vende e quer receber sem dor de cabeça.
            </h2>
            <p className="text-slate-600 text-base sm:text-lg">
              Substitua cadernos rasurados, planilhas confusas e mensagens manuais
              por uma plataforma profissional feita sob medida para o comércio brasileiro.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Bento Card 1: Destaque Grande */}
            <div className="md:col-span-2 bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm hover:shadow-md transition space-y-6 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <BookOpen className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900">
                  Caderninho Digital com Limite Inteligente
                </h3>
                <p className="text-slate-600 leading-relaxed text-sm sm:text-base">
                  Cadastre cada cliente com limite de crédito personalizado, anote compras e pagamentos parciais com cálculo de saldo em tempo real. Você nunca mais vende fiado para quem já estourou o limite.
                </p>
              </div>

              {/* Preview UI do Caderninho */}
              <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                  <span>Cliente</span>
                  <span>Saldo Devedor / Limite</span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-100 flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center">
                      JS
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">João Silva</p>
                      <p className="text-[11px] text-slate-400">Vence em 2 dias</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-red-600">R$ 145,00</p>
                    <p className="text-[11px] text-slate-400">Limite: R$ 300,00</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bento Card 2: WhatsApp + Pix */}
            <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 text-white rounded-3xl p-8 shadow-sm flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-white/15 text-white flex items-center justify-center">
                  <MessageCircle className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold">
                  Cobrança no Zap com Pix Automático
                </h3>
                <p className="text-emerald-100 text-sm leading-relaxed">
                  Lembretes elegantes no WhatsApp com o código Pix Copia e Cola pronto para o cliente pagar com um toque no banco dele.
                </p>
              </div>

              <div className="bg-emerald-950/40 rounded-2xl p-4 border border-emerald-400/20 text-xs space-y-2">
                <p className="font-mono text-emerald-200 truncate">
                  00020126580014br.gov.bcb.pix...
                </p>
                <div className="bg-emerald-500 text-white font-bold py-2 rounded-xl text-center shadow-xs">
                  📋 Copiar código Pix
                </div>
              </div>
            </div>

            {/* Bento Card 3: Vitrine Virtual Personalizada */}
            <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm hover:shadow-md transition space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <Palette className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">
                Sua Marca & Fotos no Cloudinary
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Suba fotos de produtos e logotipo da sua loja com otimização em nuvem em alta resolução e carregamento instantâneo.
              </p>
            </div>

            {/* Bento Card 4: Pedidos no WhatsApp */}
            <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm hover:shadow-md transition space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">
                Sacola de Compras Sem Fricção
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                O cliente monta a sacola na sua vitrine e o pedido chega pronto no seu WhatsApp com endereço e forma de pagamento.
              </p>
            </div>

            {/* Bento Card 5: Zero Mensalidade */}
            <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm hover:shadow-md transition space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">
                Risco Zero: Só pague se vender
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Sem mensalidade fixa, sem taxa de adesão e sem surpresas. A plataforma só ganha uma pequena comissão se você faturar.
              </p>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SIMULADOR DE GANHOS E RECUPERAÇÃO                                         */}
        {/* ========================================================================= */}
        <section
          id="simulador"
          className="bg-white border border-slate-200/80 rounded-3xl p-8 sm:p-12 shadow-sm space-y-8"
        >
          <div className="max-w-2xl">
            <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200/60">
              Simulador Interativo
            </span>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 mt-2">
              Quanto o meufiadim recupera para você?
            </h2>
            <p className="text-slate-500 text-sm sm:text-base mt-1">
              Arraste a barra para indicar o quanto você costuma vender no fiado por mês:
            </p>
          </div>

          <div className="space-y-6 max-w-3xl">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-600">
                Valor médio de fiado por mês:
              </span>
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600">
                R$ {fiadoMensal.toLocaleString("pt-BR")}
              </span>
            </div>

            <input
              type="range"
              min="500"
              max="20000"
              step="250"
              value={fiadoMensal}
              onChange={(e) => setFiadoMensal(Number(e.target.value))}
              className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
            />

            <div className="flex justify-between text-xs text-slate-400 font-semibold">
              <span>R$ 500/mês</span>
              <span>R$ 10.000/mês</span>
              <span>R$ 20.000/mês</span>
            </div>
          </div>

          {/* Resultados da simulação */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
            <div className="bg-emerald-50/70 border border-emerald-200/60 rounded-2xl p-5 space-y-1">
              <p className="text-xs text-emerald-800 font-bold uppercase">
                Recebimento Garantido no Prazo
              </p>
              <p className="text-2xl sm:text-3xl font-extrabold text-emerald-700">
                R$ {recuperacaoEstimada.toLocaleString("pt-BR")}
              </p>
              <p className="text-[11px] text-emerald-600">
                Evite o calote com o botão de Pix no WhatsApp
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-5 space-y-1">
              <p className="text-xs text-slate-600 font-bold uppercase">
                Tempo Economizado
              </p>
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                ~{horasEconomizadas} horas/mês
              </p>
              <p className="text-[11px] text-slate-500">
                Sem precisar mandar mensagem um por um
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-5 space-y-1">
              <p className="text-xs text-slate-600 font-bold uppercase">
                Taxa da Plataforma (5%)
              </p>
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                R$ {taxaPlataforma.toLocaleString("pt-BR")}
              </p>
              <p className="text-[11px] text-slate-500">
                Apenas sobre as vendas que derem certo
              </p>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* QUEM USA (SEGMENTOS)                                                      */}
        {/* ========================================================================= */}
        <section id="como-funciona" className="space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200/60">
              Feito para o seu tipo de negócio
            </span>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Quem mais se beneficia do meufiadim?
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {segmentos.map((s, idx) => (
              <div
                key={idx}
                onClick={() => setActiveSegment(idx)}
                className={`p-6 rounded-3xl border transition cursor-pointer flex flex-col justify-between space-y-4 ${
                  activeSegment === idx
                    ? "bg-white border-emerald-500 shadow-md ring-2 ring-emerald-500/20"
                    : "bg-white/70 border-slate-200 hover:bg-white hover:border-slate-300"
                }`}
              >
                <div className="space-y-2">
                  <span className="inline-block text-[11px] font-extrabold uppercase px-2.5 py-1 rounded-md bg-slate-100 text-slate-700">
                    {s.badge}
                  </span>
                  <h3 className="font-bold text-base text-slate-900">{s.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{s.desc}</p>
                </div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-600">
                  <span>{s.metric}</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* COMO FUNCIONA EM 3 PASSOS                                                 */}
        {/* ========================================================================= */}
        <section className="bg-slate-900 text-white rounded-3xl p-8 sm:p-14 space-y-12 shadow-xl">
          <div className="text-center max-w-xl mx-auto space-y-3">
            <h2 className="text-3xl font-extrabold tracking-tight text-white">
              Comece a cobrar no automático em 3 passos
            </h2>
            <p className="text-slate-400 text-sm sm:text-base">
              Você não precisa ser técnico. Em menos de 2 minutos sua loja já está pronta.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            <div className="space-y-4 bg-slate-800/60 p-6 rounded-2xl border border-slate-700/60">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white font-extrabold flex items-center justify-center text-lg">
                1
              </div>
              <h3 className="font-bold text-lg text-white">Crie sua Loja</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Cadastre seu e-mail e nome da loja. Você ganha na hora um link exclusivo como <code>meufiadim.com/sua-loja</code>.
              </p>
            </div>

            <div className="space-y-4 bg-slate-800/60 p-6 rounded-2xl border border-slate-700/60">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white font-extrabold flex items-center justify-center text-lg">
                2
              </div>
              <h3 className="font-bold text-lg text-white">Anote os Fiados</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Adicione seus clientes, defina o limite de crédito e lance compras e pagamentos parciais com facilidade.
              </p>
            </div>

            <div className="space-y-4 bg-slate-800/60 p-6 rounded-2xl border border-slate-700/60">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white font-extrabold flex items-center justify-center text-lg">
                3
              </div>
              <h3 className="font-bold text-lg text-white">Receba no Pix</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                No dia combinado, nosso robô manda a cobrança no WhatsApp com o código Pix direto para sua conta bancária.
              </p>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* PREÇO TRANSPARENTE                                                        */}
        {/* ========================================================================= */}
        <section id="precos" className="max-w-3xl mx-auto text-center space-y-8">
          <div className="space-y-3">
            <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200/60">
              Preço Simples e Honesto
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900">
              Sem mensalidade. Só pague quando receber.
            </h2>
            <p className="text-slate-600 text-base">
              Acreditamos que o pequeno comerciante não deve ter custos fixos para modernizar suas vendas.
            </p>
          </div>

          <div className="bg-white rounded-3xl p-8 sm:p-10 border-2 border-emerald-600 shadow-xl relative overflow-hidden text-left space-y-6">
            <div className="absolute top-0 right-0 bg-emerald-600 text-white text-xs font-extrabold uppercase px-5 py-1.5 rounded-bl-2xl">
              Plano Único
            </div>

            <div>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">
                Acesso Ilimitado
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-5xl font-extrabold text-slate-900 tracking-tight">
                  0 R$
                </span>
                <span className="text-slate-500 font-semibold text-base">
                  / mensalidade
                </span>
              </div>
              <p className="text-sm text-emerald-700 font-bold mt-1">
                + apenas 5% sobre as vendas registradas
              </p>
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-100 text-sm text-slate-700">
              <div className="flex items-center gap-3">
                <Check className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>Vitrine virtual com link personalizado e logo</span>
              </div>
              <div className="flex items-center gap-3">
                <Check className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>Caderninho de fiado com limites e saldos ilimitados</span>
              </div>
              <div className="flex items-center gap-3">
                <Check className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>Upload de fotos no Cloudinary com entrega rápida</span>
              </div>
              <div className="flex items-center gap-3">
                <Check className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>Cobrança automática no WhatsApp com botão Copiar Pix</span>
              </div>
              <div className="flex items-center gap-3">
                <Check className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>Instalável no celular como aplicativo (PWA)</span>
              </div>
            </div>

            <div className="pt-2">
              <Link
                href="/login"
                className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-2xl font-extrabold text-base shadow-lg shadow-emerald-600/25 transition active:scale-[0.99]"
              >
                Começar a usar de graça agora
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* FAQ ACCORDION                                                             */}
        {/* ========================================================================= */}
        <section id="faq" className="max-w-3xl mx-auto space-y-8">
          <div className="text-center space-y-3">
            <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200/60">
              Dúvidas Frequentes
            </span>
            <h2 className="text-3xl font-extrabold text-slate-900">
              Perguntas e Respostas
            </h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, i) => {
              const isOpen = openFaq === i;
              return (
                <div
                  key={i}
                  className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs transition"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    className="w-full p-5 text-left flex items-center justify-between gap-4 font-bold text-slate-900 hover:text-emerald-600 transition"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${
                        isOpen ? "rotate-180 text-emerald-600" : ""
                      }`}
                    />
                  </button>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="px-5 pb-5 text-sm text-slate-600 leading-relaxed border-t border-slate-50"
                      >
                        {faq.a}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* FINAL CTA                                                                 */}
        {/* ========================================================================= */}
        <section className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white rounded-3xl p-8 sm:p-14 text-center space-y-6 shadow-2xl relative overflow-hidden">
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="flex justify-center mb-2">
              <img
                src="/logo.png"
                alt="meufiadim"
                className="h-16 w-auto object-contain bg-white/10 rounded-2xl p-2 backdrop-blur-md"
              />
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Pronto para modernizar suas vendas e nunca mais tomar calote?
            </h2>
            <p className="text-emerald-100 text-base sm:text-lg">
              Junte-se a centenas de comerciantes que já aposentaram o caderninho de papel.
              Crie sua loja grátis agora mesmo.
            </p>
            <div className="pt-4 flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-8 py-4 rounded-2xl font-extrabold text-base shadow-xl transition active:scale-95"
              >
                Criar minha loja agora <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 bg-white py-12 px-5">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="meufiadim" className="h-8 w-auto object-contain" />
            <span className="text-xs text-slate-400 font-medium">
              © {new Date().getFullYear()} meufiadim. Todos os direitos reservados.
            </span>
          </div>

          <div className="flex items-center gap-6 text-xs text-slate-500 font-semibold">
            <a href="#como-funciona" className="hover:text-emerald-600">Como Funciona</a>
            <a href="#simulador" className="hover:text-emerald-600">Simulador</a>
            <a href="#precos" className="hover:text-emerald-600">Preços</a>
            <Link href="/login" className="hover:text-emerald-600">Entrar</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
