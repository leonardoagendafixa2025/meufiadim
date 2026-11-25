"use client";

import React, { useEffect, useState } from "react";
import {
  BellRing,
  CheckCircle2,
  Loader2,
  Smartphone,
  Volume2,
  VolumeX,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  getBrowserNotificationPermission,
  isBrowserPushSupported,
  playOrderBellChime,
  subscribeBrowserPush,
} from "@/lib/push-client";

interface OrderAlertsBarProps {
  storeId: string;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

export function OrderAlertsBar({
  storeId,
  soundEnabled,
  onToggleSound,
}: OrderAlertsBarProps) {
  const [pushSupported, setPushSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "default"
  );
  const [pushActive, setPushActive] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    const supported = isBrowserPushSupported();
    setPushSupported(supported);
    const perm = getBrowserNotificationPermission();
    setPermission(perm);

    if (supported && perm === "granted" && storeId) {
      try {
        const saved = localStorage.getItem(`meufiadim_merchant_push_${storeId}`);
        if (saved === "1") setPushActive(true);
      } catch {}
    }
  }, [storeId]);

  async function handleEnablePush() {
    if (!storeId || subscribing) return;
    setSubscribing(true);
    setStatusMessage(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setStatusMessage("Sessão expirada. Faça login novamente.");
        return;
      }

      const res = await subscribeBrowserPush({
        storeId,
        role: "merchant",
        authToken: session.access_token,
      });

      setPermission(getBrowserNotificationPermission());

      if (res.ok) {
        setPushActive(true);
        try {
          localStorage.setItem(`meufiadim_merchant_push_${storeId}`, "1");
        } catch {}
        playOrderBellChime();
        setStatusMessage("Push ativado neste aparelho! Você receberá alertas mesmo com a tela bloqueada.");
      } else {
        setStatusMessage(res.reason || "Não foi possível ativar notificações push.");
      }
    } catch (err: any) {
      setStatusMessage(err?.message || "Erro ao registrar notificações.");
    } finally {
      setSubscribing(false);
    }
  }

  return (
    <div className="bg-white rounded-[28px] p-4 sm:p-5 border border-slate-200/80 shadow-sm shadow-slate-200/40 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
            <BellRing className="w-5 h-5 stroke-[2]" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">
              Campainha & Push em Tempo Real
            </h3>
            <p className="text-xs text-slate-500 font-medium leading-snug mt-0.5">
              Toque sonoro imediato quando entrar pedido na vitrine + notificação push no celular ou PC.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleSound}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl text-xs font-extrabold border transition active:scale-[0.98] min-h-[42px] ${
              soundEnabled
                ? "bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100"
                : "bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200"
            }`}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-400" />
            )}
            <span>{soundEnabled ? "Campainha Ativa" : "Som Mudo"}</span>
          </button>

          <button
            type="button"
            onClick={() => playOrderBellChime()}
            className="px-3.5 py-2.5 rounded-2xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition active:scale-[0.98] min-h-[42px]"
          >
            Testar Som
          </button>

          {pushSupported && (
            <button
              type="button"
              onClick={handleEnablePush}
              disabled={subscribing}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-extrabold transition active:scale-[0.98] min-h-[42px] ${
                pushActive && permission === "granted"
                  ? "bg-slate-900 text-white hover:bg-slate-800"
                  : "bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-md shadow-emerald-600/20 hover:shadow-emerald-600/35"
              }`}
            >
              {subscribing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : pushActive && permission === "granted" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <Smartphone className="w-4 h-4" />
              )}
              <span>
                {subscribing
                  ? "Ativando..."
                  : pushActive && permission === "granted"
                  ? "Push Ativo"
                  : "Ativar Push"}
              </span>
            </button>
          )}
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-3 rounded-2xl text-xs font-semibold border ${
            pushActive
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-amber-50 border-amber-200 text-amber-800"
          }`}
        >
          {statusMessage}
        </div>
      )}
    </div>
  );
}
