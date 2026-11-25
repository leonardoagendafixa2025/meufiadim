"use client";

import React, { useEffect, useState } from "react";
import {
  BellRing,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Send,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  DEFAULT_FIADO_BILLING_CONFIG,
  type FiadoBillingConfig,
} from "@/lib/store-features";

export function FiadoBillingCard() {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningCron, setRunningCron] = useState(false);
  const [config, setConfig] = useState<FiadoBillingConfig>(DEFAULT_FIADO_BILLING_CONFIG);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const res = await fetch("/api/fiado/billing", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await res.json();
        if (res.ok && data.config) {
          setConfig(data.config);
        }
      } catch {
        // Silencioso
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleSave(nextCfg?: FiadoBillingConfig) {
    const payload = nextCfg || config;
    setSaving(true);
    setStatusMessage(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch("/api/fiado/billing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ config: payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar régua.");
      setConfig(data.config);
      setStatusMessage("Régua automática salva com sucesso!");
    } catch (err: any) {
      alert(err?.message || "Erro ao salvar configurações.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRunNow() {
    setRunningCron(true);
    setStatusMessage(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch("/api/fiado/cron", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao executar régua.");
      setStatusMessage(
        `Verificados: ${data.scanned} • Enviados agora: ${data.sent} • Já notificados / sem vencimento hoje: ${data.skipped}`
      );
    } catch (err: any) {
      alert(err?.message || "Erro ao disparar régua.");
    } finally {
      setRunningCron(false);
    }
  }

  return (
    <div className="bg-white rounded-[28px] border border-slate-200/70 shadow-sm shadow-slate-200/40 overflow-hidden">
      <div
        onClick={() => setExpanded((prev) => !prev)}
        className="p-4 sm:p-5 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/70 transition"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
              config.enabled
                ? "bg-emerald-100 text-emerald-700"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            <BellRing className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-sm text-slate-900 truncate">
                Régua Automática de Cobrança (WhatsApp)
              </h3>
              <span
                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                  loading
                    ? "bg-slate-100 text-slate-400"
                    : config.enabled
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {loading ? "..." : config.enabled ? "Ativa 09h" : "Desativada"}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium truncate">
              Lembra antes do vencimento, no dia e após atraso com Pix Copia e Cola
            </p>
          </div>
        </div>

        <button
          type="button"
          aria-label="Expandir régua automática"
          className="p-2 rounded-xl text-slate-400 hover:text-slate-700"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {expanded && (
        <div className="px-4 sm:px-5 pb-5 pt-2 border-t border-slate-100 space-y-4">
          <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 cursor-pointer">
            <div>
              <span className="text-xs font-extrabold text-slate-900 block">
                Ativar cobrança automática diária às 09h
              </span>
              <span className="text-[11px] text-slate-500">
                Só dispara uma mensagem por cliente no dia, evitando repetições
              </span>
            </div>
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => {
                const updated = { ...config, enabled: e.target.checked };
                setConfig(updated);
                handleSave(updated);
              }}
              className="w-5 h-5 accent-emerald-600 rounded cursor-pointer"
            />
          </label>

          <div className="grid sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-1.5">
              <label className="font-bold text-slate-700 block">
                Avisar antes (dias)
              </label>
              <input
                type="number"
                min={0}
                max={15}
                value={config.remindBeforeDays}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    remindBeforeDays: Number(e.target.value || 0),
                  }))
                }
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 font-bold text-slate-900"
              />
              <p className="text-[10px] text-slate-400">0 = desativado</p>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-1.5">
              <label className="font-bold text-slate-700 block">
                Cobrar no dia exato
              </label>
              <label className="flex items-center gap-2 pt-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.remindOnDueDate}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      remindOnDueDate: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 accent-emerald-600"
                />
                <span className="font-semibold text-slate-700">Sim, no vencimento</span>
              </label>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-1.5">
              <label className="font-bold text-slate-700 block">
                Relembrar atraso (dias)
              </label>
              <input
                type="number"
                min={1}
                max={30}
                value={config.remindOverdueDays}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    remindOverdueDays: Math.max(1, Number(e.target.value || 3)),
                  }))
                }
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 font-bold text-slate-900"
              />
              <p className="text-[10px] text-slate-400">A cada X dias em atraso</p>
            </div>
          </div>

          {statusMessage && (
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave()}
              className="px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs active:scale-[0.98] transition disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Salvar Configurações"}
            </button>

            {config.enabled && (
              <button
                type="button"
                disabled={runningCron}
                onClick={handleRunNow}
                className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs inline-flex items-center gap-1.5 active:scale-[0.98] transition disabled:opacity-50"
              >
                {runningCron ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Disparar Elegíveis Agora</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
