"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface StoreRow {
  id: string;
  name: string;
  slug: string;
  whatsapp: string;
  commission_rate: number;
  billing_cycle: "weekly" | "monthly";
  status: "active" | "blocked";
}

export default function SuperAdminPage() {
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email !== process.env.NEXT_PUBLIC_SUPERADMIN_EMAIL) return;
      setAuthorized(true);
      loadStores();
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

  async function updateStore(id: string, patch: Partial<StoreRow>) {
    await supabase.from("stores").update(patch).eq("id", id);
    loadStores();
  }

  if (!authorized) {
    return (
      <div className="p-10 text-center text-gray-600">
        Acesso restrito ao administrador da plataforma.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 p-6 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3.5 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/70 shadow-sm shadow-slate-200/50">
          <img src="/logo.png" alt="meufiadim" className="h-11 w-auto object-contain" />
          <div>
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-purple-100 text-purple-800">
              Gestão Global
            </span>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-0.5">SuperAdmin — Lojas da Plataforma</h1>
          </div>
        </div>

        <div className="bg-white rounded-[32px] border border-slate-200/70 shadow-sm shadow-slate-200/50 divide-y divide-slate-100 overflow-hidden">
          {stores.map((s) => (
            <div
              key={s.id}
              className="p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
            >
              <div>
                <p className="font-extrabold text-base text-slate-900">{s.name}</p>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Slug: <strong className="text-slate-800">/{s.slug}</strong> • WhatsApp: {s.whatsapp}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/60">
                  Taxa (%):
                  <input
                    type="number"
                    step="0.5"
                    defaultValue={s.commission_rate}
                    onBlur={(e) =>
                      updateStore(s.id, {
                        commission_rate: Number(e.target.value),
                      })
                    }
                    className="w-16 px-2 py-1 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </label>

                <select
                  value={s.billing_cycle}
                  onChange={(e) =>
                    updateStore(s.id, {
                      billing_cycle: e.target.value as "weekly" | "monthly",
                    })
                  }
                  className="px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="weekly">Semanal</option>
                  <option value="monthly">Mensal</option>
                </select>

                <button
                  onClick={() =>
                    updateStore(s.id, {
                      status: s.status === "active" ? "blocked" : "active",
                    })
                  }
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all duration-150 hover:-translate-y-0.5 active:scale-95 shadow-xs ${
                    s.status === "active"
                      ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80"
                      : "bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200/80"
                  }`}
                >
                  {s.status === "active"
                    ? "✓ Ativa (Bloquear)"
                    : "✕ Bloqueada (Liberar)"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
