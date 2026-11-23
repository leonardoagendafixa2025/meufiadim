import Link from "next/link";
import {
  ShieldCheck,
  MessageCircle,
  BookOpen,
  ArrowRight,
  Sparkles,
  Palette,
} from "lucide-react";
import { HeroVideo } from "@/components/HeroVideo";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#F7F8FA] flex flex-col">
      <header className="bg-white/80 backdrop-blur border-b border-gray-200 px-5 py-4 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white font-extrabold flex items-center justify-center">
              mf
            </div>
            <span className="font-extrabold text-lg tracking-tight">meufiadim</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 rounded-xl"
            >
              Entrar
            </Link>
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-bold bg-gray-900 text-white rounded-xl hover:bg-gray-800"
            >
              Criar loja grátis
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto px-5 py-12 sm:py-16 space-y-20">
        {/* Hero 2 colunas com Remotion */}
        <section className="grid grid-cols-1 md:grid-cols-2 items-center gap-12">
          <div className="space-y-6 text-center md:text-left">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" /> Sem mensalidade — pague apenas % sobre o que vender
            </span>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900 leading-tight">
              Sua vitrine online com{" "}
              <span className="text-emerald-600">caderninho de fiado</span>{" "}
              automático.
            </h1>
            <p className="text-gray-500 text-base sm:text-lg leading-relaxed">
              Personalize com sua logo e cores, receba pedidos direto no WhatsApp
              e deixe o robô cobrar na data combinada já com o botão{" "}
              <strong className="text-gray-800">Copiar código Pix</strong>.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-7 py-4 rounded-2xl font-bold text-base shadow-lg shadow-emerald-600/25 transition"
              >
                Criar minha loja grátis <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>

          <div className="flex justify-center">
            <HeroVideo />
          </div>
        </section>

        {/* Benefícios */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left">
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-2">
            <BookOpen className="w-7 h-7 text-emerald-600" />
            <h2 className="font-bold text-base">Controle de Fiado</h2>
            <p className="text-sm text-gray-500">
              Defina limite de crédito, data final de pagamento e acompanhe o saldo de cada cliente.
            </p>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-2">
            <MessageCircle className="w-7 h-7 text-emerald-600" />
            <h2 className="font-bold text-base">Cobrança no Zap + Pix</h2>
            <p className="text-sm text-gray-500">
              Lembrete automático no vencimento com botão nativo de Copiar Código Pix direto para sua conta.
            </p>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-2">
            <Palette className="w-7 h-7 text-emerald-600" />
            <h2 className="font-bold text-base">Sua Marca na Vitrine</h2>
            <p className="text-sm text-gray-500">
              Suba sua logo, escolha a cor principal e compartilhe seu link exclusivo em segundos.
            </p>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-2">
            <ShieldCheck className="w-7 h-7 text-emerald-600" />
            <h2 className="font-bold text-base">Zero Mensalidade</h2>
            <p className="text-sm text-gray-500">
              Sem custo fixo. Pague apenas uma pequena porcentagem no fechamento semanal ou mensal.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
