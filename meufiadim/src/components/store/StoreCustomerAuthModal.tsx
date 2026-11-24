"use client";

import { useState } from "react";
import {
  X,
  Phone,
  Lock,
  User,
  Eye,
  EyeOff,
  LogIn,
  UserPlus,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { formatPhoneBR, cleanPhone } from "@/lib/customer-auth";

export interface CustomerUser {
  id: string;
  store_id?: string;
  name: string;
  phone: string;
  balance: number;
  credit_limit: number;
}

interface StoreCustomerAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeId: string;
  storeName: string;
  brandColor?: string;
  initialMode?: "login" | "register";
  promptMessage?: string;
  onSuccess: (customer: CustomerUser) => void;
}

export function StoreCustomerAuthModal({
  isOpen,
  onClose,
  storeId,
  storeName,
  brandColor = "#059669",
  initialMode = "login",
  promptMessage,
  onSuccess,
}: StoreCustomerAuthModalProps) {
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Máscara dinâmica de telefone brasileiro (DDD + 9 ou 8 dígitos)
  const handlePhoneChange = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 11);
    let formatted = digits;
    if (digits.length > 2) {
      formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    }
    if (digits.length > 7) {
      formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    setPhone(formatted);
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const digits = cleanPhone(phone);
    if (!digits || digits.length < 10) {
      setErrorMessage("Por favor, digite seu WhatsApp com DDD (mínimo 10 dígitos).");
      return;
    }

    if (!password || password.length < 4) {
      setErrorMessage("Sua senha deve conter pelo menos 4 caracteres.");
      return;
    }

    if (mode === "register" && (!name || name.trim().length < 2)) {
      setErrorMessage("Por favor, informe seu nome completo para o cadastro.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/store/customer/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: mode,
          storeId,
          name: name.trim(),
          phone: digits,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Se já existe e tentou registrar, sugere fazer login
        if (data.alreadyExists) {
          setErrorMessage(data.error);
          setMode("login");
          return;
        }
        // Se não cadastrado e tentou logar, sugere registrar
        if (data.notRegistered) {
          setErrorMessage(data.error);
          setMode("register");
          return;
        }
        throw new Error(data.error || "Ocorreu um erro ao processar sua solicitação.");
      }

      setSuccessMessage(data.message || "Acesso realizado com sucesso!");

      // Salvar dados no localStorage para manter a sessão na loja
      try {
        localStorage.setItem(`meufiadim_customer_${storeId}`, JSON.stringify(data.customer));
      } catch (e) {
        console.error("Erro ao salvar sessão local:", e);
      }

      setTimeout(() => {
        onSuccess(data.customer);
        onClose();
      }, 700);
    } catch (err: any) {
      setErrorMessage(err.message || "Não foi possível conectar ao servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-[32px] sm:rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh] animate-in slide-in-from-bottom-6 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* TOPO COM TÍTULO E BOTÃO FECHAR */}
        <div className="px-6 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              style={{ backgroundColor: `${brandColor}15`, color: brandColor }}
              className="w-9 h-9 rounded-xl flex items-center justify-center"
            >
              {mode === "login" ? (
                <LogIn className="w-5 h-5 stroke-[2.2]" />
              ) : (
                <UserPlus className="w-5 h-5 stroke-[2.2]" />
              )}
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white leading-tight">
                {mode === "login" ? "Entrar na Minha Conta" : "Criar Minha Conta"}
              </h2>
              <p className="text-[11px] font-semibold text-slate-400">
                {storeName || "Vitrine Online"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Fechar"
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center transition active:scale-95"
          >
            <X className="w-4 h-4 stroke-[2]" />
          </button>
        </div>

        {/* MENSAGEM / BANNER DE CONTEXTO (EX: BLOQUEIO DE CHECKOUT) */}
        {promptMessage && (
          <div className="mx-6 mt-4 p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-200/80 dark:border-amber-800/60 rounded-2xl flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 leading-snug">
              {promptMessage}
            </p>
          </div>
        )}

        {/* SELETOR DE ABAS: ENTRAR / CADASTRAR */}
        <div className="px-6 pt-4">
          <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`py-2 text-xs font-black rounded-xl transition-all ${
                mode === "login"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
              }`}
            >
              Já tenho conta (Entrar)
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className={`py-2 text-xs font-black rounded-xl transition-all ${
                mode === "register"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
              }`}
            >
              Criar Conta Nova
            </button>
          </div>
        </div>

        {/* FORMULÁRIO */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-3.5 overflow-y-auto">
          {errorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60 rounded-2xl flex items-center gap-2.5 text-xs font-bold text-rose-700 dark:text-rose-300 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl flex items-center gap-2.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* CAMPO NOME (SOMENTE NO CADASTRO) */}
          {mode === "register" && (
            <div className="space-y-1">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                Seu Nome Completo *
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="Ex: Leonardo Silva"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setErrorMessage(null);
                  }}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              </div>
            </div>
          )}

          {/* CAMPO CELULAR / WHATSAPP */}
          <div className="space-y-1">
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">
              Número de Celular (WhatsApp com DDD) *
            </label>
            <div className="relative">
              <input
                type="tel"
                required
                placeholder="(00) 00000-0000"
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            </div>
            <p className="text-[10px] text-slate-400 font-medium pl-1">
              Usado para você acessar seu histórico de compras e receber atualizações.
            </p>
          </div>

          {/* CAMPO SENHA */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                {mode === "login" ? "Sua Senha *" : "Crie uma Senha *"}
              </label>
              {mode === "register" && (
                <span className="text-[10px] font-semibold text-slate-400">
                  Mínimo 4 dígitos
                </span>
              )}
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                placeholder="••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrorMessage(null);
                }}
                className="w-full pl-10 pr-10 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* BOTÃO PRINCIPAL DE SUBMISSÃO */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              style={{ backgroundColor: brandColor }}
              className="w-full py-3.5 px-4 rounded-2xl text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-black/10 hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processando...</span>
                </>
              ) : mode === "login" ? (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Entrar e Continuar</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Cadastrar e Continuar</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* RODAPÉ DO MODAL */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 text-center">
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {mode === "login" ? (
              <>
                Ainda não tem cadastro?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("register");
                    setErrorMessage(null);
                  }}
                  style={{ color: brandColor }}
                  className="font-bold underline hover:opacity-80"
                >
                  Cadastre-se grátis
                </button>
              </>
            ) : (
              <>
                Já possui conta?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setErrorMessage(null);
                  }}
                  style={{ color: brandColor }}
                  className="font-bold underline hover:opacity-80"
                >
                  Faça login
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
