"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  Lock,
  Store,
  Phone,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [storeName, setStoreName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  const makeSlug = (text: string) =>
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;

        if (data.user) {
          const slug = makeSlug(storeName) || `loja-${Date.now()}`;
          const res = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: data.user.id,
              storeName: storeName.trim(),
              slug,
              whatsapp,
            }),
          });
          const resData = await res.json();
          if (!res.ok) {
            throw new Error(resData.error || "Erro ao registrar a loja.");
          }
        }

        if (data.session) {
          alert("Loja criada com sucesso!");
          router.push("/admin");
        } else {
          alert("Cadastro realizado! Se o Supabase exigir confirmação por e-mail, verifique sua caixa de entrada, ou faça login com suas credenciais.");
          setIsSignUp(false);
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        const superEmail = (
          process.env.NEXT_PUBLIC_SUPERADMIN_EMAIL || "toyesterdayagencia@gmail.com"
        ).toLowerCase().trim();

        if (data.user?.email?.toLowerCase().trim() === superEmail) {
          router.push("/superadmin");
        } else {
          router.push("/admin");
        }
      }
    } catch (err: any) {
      alert(err.message || "Erro na autenticação.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-[#F8FAFC] px-4 py-10 overflow-hidden">
      {/* Círculos de luz ambiente suave */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md bg-white/95 backdrop-blur-xl p-7 sm:p-9 rounded-[36px] border border-slate-200/80 shadow-2xl shadow-slate-200/70 ring-1 ring-black/5 space-y-6">
        {/* Logo e Mascote */}
        <div className="text-center">
          <div className="relative inline-block">
            <img
              src="/logo.png"
              alt="meufiadim"
              className="h-20 sm:h-22 w-auto object-contain mx-auto transition-transform hover:scale-105 duration-200"
            />
          </div>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-2">
            {isSignUp
              ? "Crie sua vitrine grátis em menos de 1 minuto"
              : "Acesse o painel da sua loja e seu caderninho"}
          </p>
        </div>

        {/* Segmented Switch Tab (Entrar vs Criar Loja) */}
        <div className="grid grid-cols-2 gap-1.5 p-1.5 bg-slate-100 rounded-2xl border border-slate-200/60">
          <button
            type="button"
            onClick={() => setIsSignUp(false)}
            className={`py-2.5 rounded-xl text-xs font-extrabold transition-all duration-150 ${
              !isSignUp
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Já tenho loja
          </button>
          <button
            type="button"
            onClick={() => setIsSignUp(true)}
            className={`py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1 transition-all duration-150 ${
              isSignUp
                ? "bg-white text-emerald-700 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Criar Loja Grátis</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {isSignUp && (
            <>
              {/* Nome da Loja */}
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-emerald-600 transition-colors">
                  <Store className="w-4 h-4 stroke-[2]" />
                </div>
                <input
                  type="text"
                  placeholder="Nome da sua loja (ex: Doces da Maria)"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 shadow-xs focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none transition-all"
                  required
                />
              </div>

              {/* WhatsApp da Loja */}
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-emerald-600 transition-colors">
                  <Phone className="w-4 h-4 stroke-[2]" />
                </div>
                <input
                  type="text"
                  placeholder="Seu WhatsApp com DDD (ex: 31999998888)"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 shadow-xs focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none transition-all"
                  required
                />
              </div>
            </>
          )}

          {/* E-mail */}
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-emerald-600 transition-colors">
              <Mail className="w-4 h-4 stroke-[2]" />
            </div>
            <input
              type="email"
              placeholder="Seu e-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 shadow-xs focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none transition-all"
              required
            />
          </div>

          {/* Senha */}
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-emerald-600 transition-colors">
              <Lock className="w-4 h-4 stroke-[2]" />
            </div>
            <input
              type="password"
              placeholder="Sua senha (mín. 6 caracteres)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 shadow-xs focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 focus:outline-none transition-all"
              required
            />
          </div>

          {/* Botão de Submissão com Hover Seta */}
          <button
            type="submit"
            disabled={loading}
            className="group w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white py-4 px-4 rounded-2xl font-extrabold text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-600/25 hover:shadow-emerald-600/40 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-150 disabled:opacity-50"
          >
            <span>
              {loading
                ? "Aguarde..."
                : isSignUp
                ? "Criar Minha Loja Agora"
                : "Entrar no Painel"}
            </span>
            {!loading && (
              <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
            )}
          </button>
        </form>

        {/* Badges de Confiança */}
        <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px] text-slate-500 font-semibold text-center">
          <div className="flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Dados 100% Seguros</span>
          </div>
          <div className="flex items-center justify-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>Sem Mensalidade Fixa</span>
          </div>
        </div>
      </div>
    </div>
  );
}
