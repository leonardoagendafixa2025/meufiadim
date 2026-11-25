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
  Zap,
  TrendingUp,
  ChevronDown,
  ShoppingBag,
  Check,
  Bot,
  Bike,
  Tag,
  Award,
  BarChart3,
  CalendarClock,
  ChefHat,
  CheckCircle2,
  BellRing,
  MapPin,
  AlertTriangle,
} from "lucide-react";
import { HeroVideo } from "@/components/HeroVideo";

const fadeIn: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

export default function LandingPage() {
  const [fiadoMensal, setFiadoMensal] = useState<number>(3500);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [activeSegment, setActiveSegment] = useState<number>(0);

  const segmentos = [
    {
      title: "Mercadinhos & Mercearias",
      desc: "Anote o fiado com limite por cliente, controle estoque baixo com 1 clique e envie cobrança automática com Pix Copia e Cola no WhatsApp.",
      badge: "Mais Popular",
      metric: "+42% recebimento no prazo",
    },
    {
      title: "Marmitarias, Adegas & Lanches",
      desc: "Vitrine rápida com cálculo de frete por CEP/bairro, rastreamento ao vivo estilo iFood (Em preparo → Saiu p/ entrega) e aviso automático no Zap.",
      badge: "Delivery & Balcão",
      metric: "Zero pergunta repetida no Zap",
    },
    {
      title: "Lojas de Roupas & Varejo",
      desc: "Crie cupons de desconto, ative cartão fidelidade por celular e venda no crediário/encomenda sabendo exatamente quando cada cliente vence.",
      badge: "Fidelidade & Cupons",
      metric: "Clientes compram mais vezes",
    },
    {
      title: "Encomendas & Autônomos",
      desc: "Agende encomendas para datas futuras com pagamento programado, deixe o Vendedor IA tirar dúvidas 24h e receba direto no seu Pix.",
      badge: "IA 24 Horas",
      metric: "Atendimento até fora do horário",
    },
  ];

  const faqs = [
    {
      q: "Preciso ter CNPJ para usar o meufiadim?",
      a: "Não! O meufiadim foi feito para comerciantes locais, autônomos, lanchonetes e pequenos negócios. Você pode se cadastrar e cadastrar sua chave Pix usando CPF, CNPJ, e-mail ou celular.",
    },
    {
      q: "O dinheiro das vendas e do Pix cai direto na minha conta?",
      a: "Sim, 100%! Todo código Pix enviado aos seus clientes pelo robô usa a sua própria chave Pix cadastrada no painel. O valor vai direto da conta do cliente para a sua conta bancária sem intermediários.",
    },
    {
      q: "Como funcionam o Vendedor IA e o Assistente no WhatsApp?",
      a: "Na sua vitrine online, um Vendedor IA atende clientes 24h respondendo dúvidas de cardápio, calculando frete por CEP e adicionando itens direto na sacola. Para você lojista, o Assistente no painel e no WhatsApp mostra quem está devendo, estoque baixo, pedidos abertos e até anota vendas no fiado por texto.",
    },
    {
      q: "Como funciona o rastreamento ao vivo dos pedidos?",
      a: "Quando o cliente pede na sua vitrine, você avança o status com 1 clique no painel (Recebido → Em Preparo → Saiu para Entrega / Pronto p/ Retirada → Entregue). O cliente acompanha a barra em tempo real e recebe aviso automático no WhatsApp a cada mudança.",
    },
    {
      q: "Como funciona a Régua Automática de Cobrança de Fiado?",
      a: "Você escolhe no painel se quer lembrar o cliente alguns dias antes do vencimento, no dia exato e após X dias de atraso. Todos os dias às 09h o robô envia mensagens educadas (sem repetir no mesmo dia) já com o Pix Copia e Cola pronto.",
    },
    {
      q: "Existe mensalidade fixa ou taxa de adesão?",
      a: "Zero mensalidade fixa! Você não paga nada para criar sua loja, subir produtos, usar IA, cupons ou relatórios. Cobramos apenas 10% sobre as vendas registradas na plataforma — se não vender, não paga nada.",
    },
    {
      q: "Funciona no celular sem precisar baixar nada?",
      a: "Sim! O sistema é 100% online e instalável como aplicativo (PWA) no Android, iPhone ou computador. Seus clientes também não precisam instalar nada — compram direto pelo link da sua loja e acompanham tudo no celular e no WhatsApp.",
    },
  ];

  const recuperacaoEstimada = Math.round(fiadoMensal * 0.94);
  const horasEconomizadas = Math.round((fiadoMensal / 300) * 1.8);
  const taxaPlataforma = Math.round(fiadoMensal * 0.10);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-emerald-500 selection:text-white">
      {/* Background Decorativo Superior */}
      <div className="absolute top-0 inset-x-0 h-[680px] bg-gradient-to-b from-emerald-50/70 via-amber-50/20 to-transparent pointer-events-none -z-10" />

      {/* Floating Header */}
      <header className="sticky top-4 z-50 max-w-6xl mx-auto px-4">
        <nav className="bg-white/85 backdrop-blur-xl border border-slate-200/70 rounded-2xl px-4 sm:px-6 py-3 flex items-center justify-between shadow-sm shadow-slate-200/50">
          <Link href="/" className="flex items-center gap-2.5 group">
            <img
              src="/logo.png"
              alt="meufiadim"
              className="h-10 sm:h-11 w-auto object-contain transition-transform group-hover:scale-105"
            />
          </Link>

          <div className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-600">
            <a href="#recursos" className="hover:text-emerald-600 transition">
              Recursos
            </a>
            <a href="#ia-whatsapp" className="hover:text-emerald-600 transition">
              IA + WhatsApp
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

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-24 space-y-28 sm:space-y-32">
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
            <motion.div variants={fadeIn} className="inline-flex items-center">
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/60 text-emerald-800 text-xs font-extrabold shadow-xs">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                Vitrine Online • Fiado com Pix • Pedidos ao Vivo • Vendedor IA
              </span>
            </motion.div>

            <motion.h1
              variants={fadeIn}
              className="text-4xl sm:text-5xl lg:text-[56px] font-extrabold tracking-tight text-slate-900 leading-[1.1]"
            >
              Sua loja completa com{" "}
              <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 bg-clip-text text-transparent">
                Fiado no WhatsApp, Vitrine e IA
              </span>
              .
            </motion.h1>

            <motion.p
              variants={fadeIn}
              className="text-slate-600 text-lg sm:text-xl leading-relaxed max-w-2xl mx-auto lg:mx-0 font-normal"
            >
              Venda pela sua vitrine personalizada com{" "}
              <strong className="text-slate-900 font-semibold">frete automático por CEP</strong>,{" "}
              cupons e fidelidade. Acompanhe pedidos ao vivo estilo iFood, deixe o{" "}
              <strong className="text-slate-900 font-semibold">Vendedor IA</strong> atender 24h e
              cobre o fiado no automático com{" "}
              <strong className="text-slate-900 font-semibold">Pix direto na sua conta</strong>.
            </motion.p>

            <motion.div
              variants={fadeIn}
              className="pt-3 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
            >
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2.5 bg-gradient-to-r from-emerald-600 via-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white px-8 py-4 rounded-2xl font-extrabold text-base shadow-xl shadow-emerald-600/30 hover:shadow-emerald-600/40 active:scale-[0.98] transition group"
              >
                <span>Criar minha loja grátis</span>
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </Link>

              <a
                href="#recursos"
                className="inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-6 py-4 rounded-2xl font-bold text-base shadow-xs transition"
              >
                <Zap className="w-5 h-5 text-emerald-600" />
                Ver tudo que o sistema faz
              </a>
            </motion.div>

            <motion.div
              variants={fadeIn}
              className="pt-4 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-xs text-slate-500 font-medium"
            >
              <div className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600 font-bold" />
                <span>R$ 0 de mensalidade fixa</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600 font-bold" />
                <span>Apenas 10% quando vender</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600 font-bold" />
                <span>Pix 100% direto na sua conta</span>
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
            <div className="absolute -inset-4 bg-gradient-to-tr from-emerald-400/25 to-amber-300/20 rounded-full blur-3xl -z-10" />

            <div className="relative">
              <HeroVideo />

              {/* Floating Badge 1: Rastreamento / Pix */}
              <motion.div
                initial={{ opacity: 0, x: -30, y: 20 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                transition={{ delay: 0.8, duration: 0.6 }}
                className="hidden sm:flex absolute -left-10 top-14 bg-white/95 backdrop-blur-md p-3.5 rounded-2xl border border-slate-100 shadow-xl items-center gap-3 z-20"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold shadow-sm">
                  <Bike className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                    Pedido ao Vivo
                  </p>
                  <p className="text-sm font-extrabold text-slate-900">
                    Saiu p/ entrega • Aviso Zap
                  </p>
                </div>
              </motion.div>

              {/* Floating Badge 2: IA + Cobrança */}
              <motion.div
                initial={{ opacity: 0, x: 30, y: -20 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                transition={{ delay: 1, duration: 0.6 }}
                className="hidden sm:flex absolute -right-8 bottom-20 bg-white/95 backdrop-blur-md p-3.5 rounded-2xl border border-slate-100 shadow-xl items-center gap-3 z-20"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-900 text-emerald-400 flex items-center justify-center shadow-sm">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                    IA + Régua 09h
                  </p>
                  <p className="text-sm font-extrabold text-slate-900">
                    Venda e Pix automáticos
                  </p>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </section>

        {/* ========================================================================= */}
        {/* NUMBERS / IMPACT STRIP                                                    */}
        {/* ========================================================================= */}
        <section className="bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950 text-white rounded-3xl p-8 sm:p-12 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-y md:divide-y-0 md:divide-x divide-slate-800">
            <div className="pt-4 md:pt-0">
              <p className="text-3xl sm:text-4xl font-extrabold text-emerald-400 tracking-tight">
                24/7
              </p>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">
                Vendedor IA na vitrine e no WhatsApp
              </p>
            </div>
            <div className="pt-4 md:pt-0">
              <p className="text-3xl sm:text-4xl font-extrabold text-amber-400 tracking-tight">
                R$ 0
              </p>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">
                De mensalidade fixa ou taxa de adesão
              </p>
            </div>
            <div className="pt-4 md:pt-0">
              <p className="text-3xl sm:text-4xl font-extrabold text-emerald-400 tracking-tight">
                10%
              </p>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">
                Apenas sobre as vendas que você fechar
              </p>
            </div>
            <div className="pt-4 md:pt-0">
              <p className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                100%
              </p>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">
                Do Pix direto para sua conta bancária
              </p>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* BENTO GRID COMPLETO DE RECURSOS                                           */}
        {/* ========================================================================= */}
        <section id="recursos" className="space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-4">
            <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200/60">
              Ecossistema Completo
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
              Tudo o que sua loja precisa em um só lugar.
            </h2>
            <p className="text-slate-600 text-base sm:text-lg">
              Do cardápio online ao fiado cobrado no automático, com Inteligência Artificial,
              controle de estoque e acompanhamento ao vivo de cada pedido.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1: Caderninho + Régua Automática */}
            <div className="md:col-span-2 bg-white rounded-3xl p-7 sm:p-8 border border-slate-200/80 shadow-sm hover:shadow-md transition space-y-6 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                    <BellRing className="w-3 h-3" /> Régua Automática 09h
                  </span>
                </div>
                <h3 className="text-2xl font-bold text-slate-900">
                  Caderninho Digital com Limite & Régua de Cobrança Automática
                </h3>
                <p className="text-slate-600 leading-relaxed text-sm sm:text-base">
                  Controle saldos, limites de crédito e pagamentos parciais em tempo real. Ative a
                  régua automática e o robô lembra antes do vencimento, no dia exato e após atraso
                  já enviando seu Pix Copia e Cola — sem repetir mensagens no mesmo dia.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                  <span>Cliente • Vencimento</span>
                  <span>Saldo / Limite</span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-100 flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center">
                      JS
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">João Silva</p>
                      <p className="text-[11px] text-amber-600 font-semibold">
                        Lembrete automático agendado
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-rose-600">R$ 145,00</p>
                    <p className="text-[11px] text-slate-400">Limite: R$ 300,00</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Rastreamento ao Vivo Estilo iFood */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-3xl p-7 sm:p-8 shadow-sm flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Bike className="w-5 h-5" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold">
                  Rastreamento de Pedido ao Vivo
                </h3>
                <p className="text-slate-300 text-sm leading-relaxed">
                  Avance o status no painel com 1 clique. O cliente acompanha na tela em tempo real e
                  recebe aviso automático no WhatsApp em cada etapa.
                </p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 grid grid-cols-4 gap-1 text-center">
                {[
                  { label: "Recebido", icon: CheckCircle2, active: true },
                  { label: "Preparo", icon: ChefHat, active: true },
                  { label: "A caminho", icon: Bike, active: true },
                  { label: "Entregue", icon: ShoppingBag, active: false },
                ].map((s) => {
                  const Icon = s.icon;
                  return (
                    <div key={s.label} className="flex flex-col items-center gap-1">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center ${
                          s.active ? "bg-emerald-500 text-white" : "bg-white/10 text-slate-400"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[10px] font-bold text-slate-200">{s.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Card 3: Vendedor IA + Assistente IA */}
            <div
              id="ia-whatsapp"
              className="md:col-span-2 bg-gradient-to-br from-emerald-600 to-teal-800 text-white rounded-3xl p-7 sm:p-8 shadow-sm flex flex-col justify-between space-y-6"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-11 h-11 rounded-2xl bg-white/15 text-white flex items-center justify-center">
                    <Bot className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-black uppercase px-2.5 py-1 rounded-full bg-white/15 text-amber-200">
                    IA + WhatsApp Integrados
                  </span>
                </div>
                <h3 className="text-2xl font-bold">
                  Vendedor IA para Clientes + Assistente IA para o Lojista
                </h3>
                <p className="text-emerald-50 text-sm sm:text-base leading-relaxed">
                  Na vitrine, o <strong>Vendedor IA</strong> tira dúvidas de cardápio, calcula frete
                  pelo CEP e coloca itens direto na sacola. No WhatsApp ou no painel, você comanda
                  sua loja por mensagem: consulte devedores, estoque baixo, pedidos abertos ou
                  diga <em>&ldquo;anota 45 no fiado do João&rdquo;</em>.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-black/25 border border-white/15 rounded-2xl p-3.5 space-y-1">
                  <p className="font-extrabold text-amber-200">🛍️ Cliente na Vitrine:</p>
                  <p className="text-emerald-50">
                    &ldquo;Quanto fica o frete para 30130-000 e tem coca 2L?&rdquo; → IA calcula e
                    adiciona na sacola!
                  </p>
                </div>
                <div className="bg-black/25 border border-white/15 rounded-2xl p-3.5 space-y-1">
                  <p className="font-extrabold text-emerald-300">📱 Lojista no WhatsApp:</p>
                  <p className="text-emerald-50">
                    &ldquo;Anota R$ 45 no fiado do João&rdquo; → Saldo atualizado e comprovante
                    enviado na hora!
                  </p>
                </div>
              </div>
            </div>

            {/* Card 4: Frete por CEP & Vitrine */}
            <div className="bg-white rounded-3xl p-7 border border-slate-200/80 shadow-sm hover:shadow-md transition space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-11 h-11 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center">
                  <MapPin className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">
                  Vitrine Própria & Frete por CEP
                </h3>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Link exclusivo com sua logo e cores, fotos otimizadas, bairros atendidos, faixas de
                  CEP automáticas via ViaCEP, botão Aberto/Fechado e retirada no balcão.
                </p>
              </div>
              <div className="text-[11px] font-bold text-sky-700 bg-sky-50 border border-sky-200/70 rounded-xl px-3 py-2">
                ✓ Área do cliente com login por celular e senha
              </div>
            </div>

            {/* Card 5: Encomendas Programadas */}
            <div className="bg-white rounded-3xl p-7 border border-slate-200/80 shadow-sm hover:shadow-md transition space-y-4">
              <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <CalendarClock className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">
                Encomendas Programadas
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Registre pedidos sob encomenda com data de entrega e data combinada de pagamento,
                com status (Pendente, Atrasada, Paga) e disparo automático de cobrança no Zap.
              </p>
            </div>

            {/* Card 6: Cupons e Cartão Fidelidade */}
            <div className="bg-white rounded-3xl p-7 border border-slate-200/80 shadow-sm hover:shadow-md transition space-y-4">
              <div className="w-11 h-11 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center">
                <Tag className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">
                Cupons & Cartão Fidelidade
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Crie cupons em % ou R$ com pedido mínimo e ative carimbos digitais pelo celular do
                cliente (ex.: complete 10 pedidos e ganhe R$ 15 de desconto automático).
              </p>
              <div className="flex items-center gap-2 text-[11px] font-extrabold text-amber-700 bg-amber-50 border border-amber-200/70 rounded-xl px-3 py-2">
                <Award className="w-4 h-4 shrink-0" />
                <span>Fidelidade: 8/10 carimbos acumulados</span>
              </div>
            </div>

            {/* Card 7: Relatórios + Estoque Baixo */}
            <div className="bg-white rounded-3xl p-7 border border-slate-200/80 shadow-sm hover:shadow-md transition space-y-4">
              <div className="w-11 h-11 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">
                Relatórios & Alerta de Estoque
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Gráfico de vendas dos últimos 7 dias, ranking de produtos e clientes, reposição
                rápida (+5 / +10 un), baixa automática nas vendas e exportação em Excel (CSV).
              </p>
              <div className="flex items-center gap-2 text-[11px] font-extrabold text-rose-700 bg-rose-50 border border-rose-200/70 rounded-xl px-3 py-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Alerta automático quando estoque ≤ 3 un</span>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* DOIS LADOS CONECTADOS: LOJISTA X CLIENTE                                  */}
        {/* ========================================================================= */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-3xl p-7 sm:p-8 border border-slate-200/80 shadow-sm space-y-4">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase px-3 py-1 rounded-full bg-slate-900 text-white">
              Painel do Lojista (/admin)
            </span>
            <h3 className="text-2xl font-extrabold text-slate-900">
              Gestão completa na palma da mão
            </h3>
            <ul className="space-y-2.5 text-sm text-slate-600 font-medium">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                Fila de pedidos ao vivo com avanço de etapa e aviso automático no WhatsApp
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                Fiado completo, encomendas agendadas e régua automática de cobrança
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                Copiloto IA no painel e via WhatsApp para lançar vendas e consultar dados
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                Relatórios, ranking de produtos, cupons, fidelidade e estoque baixo
              </li>
            </ul>
          </div>

          <div className="bg-white rounded-3xl p-7 sm:p-8 border border-emerald-200 shadow-sm space-y-4">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase px-3 py-1 rounded-full bg-emerald-600 text-white">
              Vitrine do Cliente (/sua-loja)
            </span>
            <h3 className="text-2xl font-extrabold text-slate-900">
              Compra rápida, sem baixar aplicativo
            </h3>
            <ul className="space-y-2.5 text-sm text-slate-600 font-medium">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                Cardápio com busca, destaques, modo escuro/claro e cálculo de frete por CEP
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                Vendedor IA que tira dúvidas de preços/entrega e monta a sacola na conversa
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                Acompanhamento de pedido em tempo real + cartão fidelidade e cupons no checkout
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                Confirmação instantânea no WhatsApp com botão &ldquo;Copiar código Pix&rdquo;
              </li>
            </ul>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SIMULADOR DE GANHOS E RECUPERAÇÃO (10%)                                  */}
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
              Arraste a barra para indicar o quanto você costuma vender no fiado e vitrine por mês:
            </p>
          </div>

          <div className="space-y-6 max-w-3xl">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-600">
                Volume médio de vendas / fiado por mês:
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
            <div className="bg-emerald-50/70 border border-emerald-200/60 rounded-2xl p-5 space-y-1">
              <p className="text-xs text-emerald-800 font-bold uppercase">
                Recebimento Estimado no Prazo
              </p>
              <p className="text-2xl sm:text-3xl font-extrabold text-emerald-700">
                R$ {recuperacaoEstimada.toLocaleString("pt-BR")}
              </p>
              <p className="text-[11px] text-emerald-600">
                Régua automática + botão de Pix no WhatsApp
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
                Sem cobrar cliente um por um nem anotar em papel
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-5 space-y-1">
              <p className="text-xs text-slate-600 font-bold uppercase">
                Comissão da Plataforma (10%)
              </p>
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                R$ {taxaPlataforma.toLocaleString("pt-BR")}
              </p>
              <p className="text-[11px] text-slate-500">
                R$ 0 de mensalidade fixa — só sobre vendas reais
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
              Feito para o seu negócio
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
              Sua loja online e no piloto automático em 3 passos
            </h2>
            <p className="text-slate-400 text-sm sm:text-base">
              Você não precisa ser técnico. Em menos de 2 minutos sua vitrine, seu fiado e seu
              atendente IA já estão prontos.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            <div className="space-y-4 bg-slate-800/60 p-6 rounded-2xl border border-slate-700/60">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white font-extrabold flex items-center justify-center text-lg">
                1
              </div>
              <h3 className="font-bold text-lg text-white">Crie sua Loja e Vitrine</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Cadastre sua loja, suba logo e produtos e receba na hora o link exclusivo{" "}
                <code suppressHydrationWarning className="text-emerald-300">
                  {typeof window !== "undefined"
                    ? window.location.host
                    : "meufiadimdigital.vercel.app"}
                  /sua-loja
                </code>
                .
              </p>
            </div>

            <div className="space-y-4 bg-slate-800/60 p-6 rounded-2xl border border-slate-700/60">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white font-extrabold flex items-center justify-center text-lg">
                2
              </div>
              <h3 className="font-bold text-lg text-white">Venda, Encomende ou Anote</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Receba pedidos pela vitrine com frete por CEP, ative cupons/fidelidade e anote
                fiados ou encomendas direto pelo painel ou WhatsApp com IA.
              </p>
            </div>

            <div className="space-y-4 bg-slate-800/60 p-6 rounded-2xl border border-slate-700/60">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white font-extrabold flex items-center justify-center text-lg">
                3
              </div>
              <h3 className="font-bold text-lg text-white">Acompanhe e Receba no Pix</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Avance etapas do pedido ao vivo, acompanhe relatórios de lucro/estoque e deixe a
                régua automática cobrar no WhatsApp direto na sua chave Pix.
              </p>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* PREÇO TRANSPARENTE (10%)                                                  */}
        {/* ========================================================================= */}
        <section id="precos" className="max-w-3xl mx-auto text-center space-y-8">
          <div className="space-y-3">
            <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-800 bg-emerald-50 px-3.5 py-1.5 rounded-full border border-emerald-200/80 shadow-xs">
              Preço Simples e Honesto
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Sem mensalidade. Só pague quando vender.
            </h2>
            <p className="text-slate-600 text-base max-w-xl mx-auto">
              Todos os recursos liberados desde o primeiro dia sem custo fixo mensal.
            </p>
          </div>

          <div className="group bg-white rounded-[36px] p-8 sm:p-10 border-2 border-emerald-500 shadow-2xl shadow-emerald-500/10 relative overflow-hidden text-left space-y-6 transition-all duration-200 hover:shadow-emerald-500/20">
            <div className="absolute top-0 right-0 bg-gradient-to-l from-emerald-600 to-emerald-700 text-white text-xs font-extrabold uppercase px-6 py-2 rounded-bl-3xl shadow-sm">
              Plano Único Completo
            </div>

            <div>
              <p className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                Acesso Completo Liberado
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-5xl sm:text-6xl font-extrabold text-slate-900 tracking-tight">
                  R$ 0
                </span>
                <span className="text-slate-500 font-bold text-base">/ mensalidade fixa</span>
              </div>
              <p className="text-sm text-emerald-700 font-extrabold mt-1.5 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Apenas 10% sobre as vendas registradas na plataforma
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-3.5 pt-4 border-t border-slate-100 text-sm font-semibold text-slate-700">
              {[
                "Vitrine virtual personalizada + área do cliente",
                "Cálculo de frete por CEP (ViaCEP) e bairros",
                "Rastreamento de pedido ao vivo + aviso Zap",
                "Vendedor IA 24h na vitrine e no WhatsApp",
                "Caderninho de fiado + Régua de cobrança 09h",
                "Encomendas agendadas com baixa integrada",
                "Cupons de desconto + Cartão Fidelidade",
                "Relatórios, alerta de estoque baixo e PWA",
              ].map((feat) => (
                <div key={feat} className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  </div>
                  <span>{feat}</span>
                </div>
              ))}
            </div>

            <div className="pt-2">
              <Link
                href="/login"
                className="group w-full inline-flex items-center justify-center gap-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white py-4 px-6 rounded-2xl font-extrabold text-base shadow-xl shadow-emerald-600/30 hover:shadow-emerald-600/40 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-150"
              >
                <span>Começar a usar de graça agora</span>
                <ArrowRight className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* FAQ ACCORDION                                                             */}
        {/* ========================================================================= */}
        <section id="faq" className="max-w-3xl mx-auto space-y-8">
          <div className="text-center space-y-3">
            <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-800 bg-emerald-50 px-3.5 py-1.5 rounded-full border border-emerald-200/80 shadow-xs">
              Dúvidas Frequentes
            </span>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Perguntas e Respostas
            </h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, i) => {
              const isOpen = openFaq === i;
              return (
                <div
                  key={i}
                  className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs hover:border-emerald-300 hover:shadow-md transition-all duration-200"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    className="w-full p-5 text-left flex items-center justify-between gap-4 font-extrabold text-slate-900 hover:text-emerald-700 transition"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-200 ${
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
                        className="px-5 pb-5 text-sm text-slate-600 font-medium leading-relaxed border-t border-slate-50"
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
        <section className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white rounded-[36px] p-8 sm:p-14 text-center space-y-6 shadow-2xl shadow-emerald-700/25 relative overflow-hidden">
          <div className="max-w-2xl mx-auto space-y-5">
            <div className="flex justify-center mb-1">
              <div className="w-20 h-20 bg-white/10 rounded-3xl p-2.5 backdrop-blur-md border border-white/20 shadow-xl flex items-center justify-center">
                <img
                  src="/logo.png"
                  alt="meufiadim"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
              Pronto para vender mais pela vitrine e receber seu fiado sem dor de cabeça?
            </h2>
            <p className="text-emerald-100 text-base sm:text-lg font-normal">
              Crie sua loja em menos de 2 minutos com R$ 0 de mensalidade, IA integrada e Pix direto
              na sua conta.
            </p>
            <div className="pt-3 flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/login"
                className="group inline-flex items-center justify-center gap-2.5 bg-slate-900 hover:bg-black text-white px-8 py-4 rounded-2xl font-extrabold text-base shadow-2xl shadow-black/30 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-150"
              >
                <span>Criar minha loja agora</span>
                <ArrowRight className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Mobile Sticky Quick Action Bar */}
      <div className="sm:hidden fixed bottom-3 inset-x-3 z-30">
        <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-800 text-white px-4 py-3 rounded-[24px] shadow-2xl shadow-black/40 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <img src="/logo.png" alt="meufiadim" className="h-7 w-auto object-contain shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-white truncate">meufiadim</p>
              <p className="text-[10px] text-emerald-400 font-semibold truncate">
                R$ 0 mensalidade • IA 24h
              </p>
            </div>
          </div>
          <Link
            href="/login"
            className="shrink-0 bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2 rounded-xl font-extrabold text-xs shadow-md shadow-emerald-500/25 active:scale-95 transition"
          >
            Criar Loja
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 bg-white py-12 px-5 pb-24 sm:pb-12">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="meufiadim" className="h-8 w-auto object-contain" />
            <span className="text-xs text-slate-400 font-medium">
              © {new Date().getFullYear()} meufiadim. Todos os direitos reservados.
            </span>
          </div>

          <div className="flex items-center gap-6 text-xs text-slate-500 font-semibold">
            <a href="#recursos" className="hover:text-emerald-600">
              Recursos
            </a>
            <a href="#ia-whatsapp" className="hover:text-emerald-600">
              IA + WhatsApp
            </a>
            <a href="#simulador" className="hover:text-emerald-600">
              Simulador
            </a>
            <a href="#precos" className="hover:text-emerald-600">
              Preços
            </a>
            <Link href="/login" className="hover:text-emerald-600">
              Entrar
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
