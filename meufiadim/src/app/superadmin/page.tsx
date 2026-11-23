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
    <div className="min-h-screen bg-[#F7F8FA] p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <h1 className="text-2xl font-extrabold">SuperAdmin — meufiadim</h1>

        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm divide-y">
          {stores.map((s) => (
            <div
              key={s.id}
              className="p-5 flex flex-wrap items-center justify-between gap-4"
            >
              <div>
                <p className="font-bold">{s.name}</p>
                <p className="text-xs text-gray-500">
                  /{s.slug} • Zap: {s.whatsapp}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <label className="text-xs flex items-center gap-1">
                  Comissão (%):
                  <input
                    type="number"
                    step="0.5"
                    defaultValue={s.commission_rate}
                    onBlur={(e) =>
                      updateStore(s.id, {
                        commission_rate: Number(e.target.value),
                      })
                    }
                    className="w-16 px-2 py-1 border rounded-lg text-sm"
                  />
                </label>

                <select
                  value={s.billing_cycle}
                  onChange={(e) =>
                    updateStore(s.id, {
                      billing_cycle: e.target.value as "weekly" | "monthly",
                    })
                  }
                  className="px-2 py-1 border rounded-lg text-sm"
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
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
                    s.status === "active"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {s.status === "active"
                    ? "Ativa (Bloquear)"
                    : "Bloqueada (Liberar)"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
