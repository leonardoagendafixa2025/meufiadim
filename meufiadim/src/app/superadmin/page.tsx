"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Shield, Store, RefreshCw, CheckCircle2, AlertCircle, LogIn, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface StoreRow {
  id: string;
  name: string;
  slug: string;
  whatsapp: string;
  commission_rate: number;
  billing_cycle: "weekly" | "monthly";
  status: "active" | "blocked";
  created_at?: string;
}

export default function SuperAdminPage() {
  const router = useRouter();
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      setCurrentEmail(user.email || null);

      const email = (user.email || "").toLowerCase().trim();
      const superAdmins = [
        "toyesterdayagencia@gmail.com",
        (process.env.NEXT_PUBLIC_SUPERADMIN_EMAIL || "").toLowerCase().trim(),
      ].filter(Boolean);

      if (!superAdmins.includes(email)) {
        setLoading(false);
        return;
      }

      setAuthorized(true);
      await loadStores();
      setLoading(false);
    }
    init();
  }, []);

  async function loadStores() {
    const { data } = await supabase
      .from("stores")
      .select("*")
      .order("created_at", { ascending: false });
    setStores(data || []);
  }

  function showNotification(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  }

  async function updateStore(id: string, patch: Partial<StoreRow>) {
    try {
      setSavingId(id);
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        alert("Sessão expirada. Faça login novamente.");
        return;
      }

      const res = await fetch("/api/superadmin/store", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ storeId: id, patch }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Falha ao atualizar loja.");
      }

      showNotification("Loja atualizada com sucesso!");
      await loadStores();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setSavingId(null);
    }
  }

  async function handleSwitchAccount() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
        <div className="flex items-center gap-3 bg-white px-6 py-4 rounded-2xl shadow-sm border border-slate-200">
          <RefreshCw className="w-5 h-5 text-emerald-600 animate-spin" />
          <p className="text-sm font-bold text-slate-700">Verificando credenciais de SuperAdmin...</p>
        </div>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200/80 max-w-md w-full space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6 stroke-[2]" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900">Acesso Restrito</h2>

          {currentEmail ? (
            <div className="space-y-2">
              <p className="text-sm text-slate-500">
                Você está conectado como:
              </p>
              <p className="text-xs font-mono font-bold bg-slate-100 py-1.5 px-3 rounded-xl text-slate-800 break-all">
                {currentEmail}
              </p>
              <p className="text-xs text-rose-600 font-semibold pt-1">
                Esta conta não é o SuperAdmin da plataforma.
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Você precisa estar conectado com a conta de SuperAdmin (<strong>toyesterdayagencia@gmail.com</strong>) para acessar esta área.
            </p>
          )}

          <div className="pt-2 space-y-2">
            {currentEmail ? (
              <button
                onClick={handleSwitchAccount}
                className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-sm transition"
              >
                <LogOut className="w-4 h-4" />
                Sair e Conectar como SuperAdmin
              </button>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-sm transition"
              >
                <LogIn className="w-4 h-4" />
                Fazer Login como SuperAdmin
              </Link>
            )}

            <Link
              href="/admin"
              className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
            >
              Voltar ao Meu Painel
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Toast Notificação */}
        {toastMsg && (
          <div className="fixed top-6 right-6 z-50 flex items-center gap-2 bg-emerald-600 text-white text-xs font-extrabold px-4 py-3 rounded-2xl shadow-xl animate-bounce">
            <CheckCircle2 className="w-4 h-4" />
            {toastMsg}
          </div>
        )}

        {/* Header do SuperAdmin */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/70 shadow-sm shadow-slate-200/50">
          <div className="flex items-center gap-3.5">
            <img src="/logo.png" alt="meufiadim" className="h-11 w-auto object-contain" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200/60">
                  <Shield className="w-3 h-3 inline mr-1" />
                  SuperAdmin
                </span>
                <span className="text-xs text-slate-400 font-semibold">• {stores.length} lojas registradas</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
                Gestão Global de Lojas
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold transition-all duration-150 active:scale-95"
            >
              <Store className="w-4 h-4 text-emerald-600" />
              Meu Painel Lojista
            </Link>
          </div>
        </div>

        {/* Lista de Lojas */}
        <div className="bg-white rounded-[32px] border border-slate-200/70 shadow-sm shadow-slate-200/50 divide-y divide-slate-100 overflow-hidden">
          {stores.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm">
              Nenhuma loja cadastrada na plataforma ainda.
            </div>
          ) : (
            stores.map((s) => (
              <div
                key={s.id}
                className="p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-extrabold text-base text-slate-900">{s.name}</p>
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                        s.status === "active"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-rose-50 text-rose-700 border border-rose-200"
                      }`}
                    >
                      {s.status === "active" ? "Ativa" : "Bloqueada"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    Slug:{" "}
                    <a
                      href={`/${s.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-700 font-extrabold hover:underline"
                    >
                      /{s.slug}
                    </a>{" "}
                    • WhatsApp: {s.whatsapp || "Não cadastrado"}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/60">
                    Comissão (%):
                    <input
                      type="number"
                      step="0.5"
                      disabled={savingId === s.id}
                      defaultValue={s.commission_rate}
                      onBlur={(e) => {
                        const val = Number(e.target.value);
                        if (val !== s.commission_rate) {
                          updateStore(s.id, { commission_rate: val });
                        }
                      }}
                      className="w-16 px-2 py-1 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </label>

                  <select
                    value={s.billing_cycle}
                    disabled={savingId === s.id}
                    onChange={(e) =>
                      updateStore(s.id, {
                        billing_cycle: e.target.value as "weekly" | "monthly",
                      })
                    }
                    className="px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="weekly">Ciclo Semanal</option>
                    <option value="monthly">Ciclo Mensal</option>
                  </select>

                  <button
                    onClick={() =>
                      updateStore(s.id, {
                        status: s.status === "active" ? "blocked" : "active",
                      })
                    }
                    disabled={savingId === s.id}
                    className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all duration-150 hover:-translate-y-0.5 active:scale-95 shadow-xs disabled:opacity-50 ${
                      s.status === "active"
                        ? "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80"
                        : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80"
                    }`}
                  >
                    {savingId === s.id
                      ? "Salvando..."
                      : s.status === "active"
                      ? "Bloquear Loja"
                      : "Desbloquear Loja"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
