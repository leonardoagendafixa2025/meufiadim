"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

        if (data.user?.email === process.env.NEXT_PUBLIC_SUPERADMIN_EMAIL) {
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
    <div className="min-h-screen flex items-center justify-center bg-[#F7F8FA] px-4">
      <div className="w-full max-w-md bg-white p-7 rounded-3xl border border-gray-100 shadow-sm space-y-5">
        <div className="text-center">
          <img src="/logo.png" alt="meufiadim" className="h-20 w-auto object-contain mx-auto mb-2" />
          <p className="text-sm text-gray-500 mt-1">
            {isSignUp
              ? "Crie sua loja grátis — pague só % sobre o que vender"
              : "Acesse o painel da sua loja"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {isSignUp && (
            <>
              <input
                type="text"
                placeholder="Nome da sua loja (ex: Doces da Maria)"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border rounded-2xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
              <input
                type="text"
                placeholder="Seu WhatsApp com DDD (ex: 31999998888)"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border rounded-2xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </>
          )}

          <input
            type="email"
            placeholder="Seu e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 bg-gray-50 border rounded-2xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            required
          />
          <input
            type="password"
            placeholder="Sua senha (mín. 6 caracteres)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 bg-gray-50 border rounded-2xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 text-white py-3.5 rounded-2xl font-bold text-sm hover:bg-emerald-700 disabled:opacity-50 shadow-lg shadow-emerald-600/20 transition"
          >
            {loading
              ? "Aguarde..."
              : isSignUp
              ? "Criar minha loja grátis"
              : "Entrar"}
          </button>
        </form>

        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="w-full text-center text-sm text-gray-600 hover:underline"
        >
          {isSignUp
            ? "Já tem loja? Fazer login"
            : "Ainda não tem loja? Criar conta grátis"}
        </button>
      </div>
    </div>
  );
}
