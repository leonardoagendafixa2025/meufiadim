"use client";

import React, { useEffect, useState } from "react";
import {
  Tag,
  Award,
  Plus,
  Trash2,
  Power,
  Loader2,
  CheckCircle2,
  Percent,
  DollarSign,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatBRL } from "@/lib/whatsapp";
import {
  DEFAULT_LOYALTY_CONFIG,
  type LoyaltyConfig,
  type StoreCoupon,
} from "@/lib/store-features";

export function PromotionsTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [coupons, setCoupons] = useState<StoreCoupon[]>([]);
  const [loyalty, setLoyalty] = useState<LoyaltyConfig>(DEFAULT_LOYALTY_CONFIG);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Novo cupom
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [minOrder, setMinOrder] = useState("");

  async function loadPromos() {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch("/api/store/promotions", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setCoupons(data.coupons || []);
        setLoyalty(data.loyaltyConfig || DEFAULT_LOYALTY_CONFIG);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPromos();
  }, []);

  async function callPromoApi(payload: Record<string, any>, successText: string) {
    setSaving(true);
    setFeedback(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch("/api/store/promotions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar promoção.");
      setCoupons(data.coupons || []);
      setLoyalty(data.loyaltyConfig || DEFAULT_LOYALTY_CONFIG);
      setFeedback(successText);
    } catch (err: any) {
      alert(err?.message || "Erro ao atualizar promoções.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateCoupon(e: React.FormEvent) {
    e.preventDefault();
    await callPromoApi(
      {
        action: "create_coupon",
        code,
        discountType,
        discountValue: Number(discountValue.replace(",", ".")),
        minOrder: Number((minOrder || "0").replace(",", ".")),
      },
      `Cupom ${code.toUpperCase()} criado com sucesso!`
    );
    setCode("");
    setDiscountValue("");
    setMinOrder("");
  }

  if (loading) {
    return (
      <div className="bg-white rounded-[32px] p-10 text-center border border-slate-200/70">
        <Loader2 className="w-7 h-7 animate-spin text-emerald-600 mx-auto mb-2" />
        <p className="text-xs font-bold text-slate-400">Carregando cupons e fidelidade...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {feedback && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* PROGRAMA DE FIDELIDADE DIGITAL */}
      <div className="bg-white rounded-[32px] p-6 sm:p-7 border border-slate-200/70 shadow-sm shadow-slate-200/40 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
              <Award className="w-3 h-3" />
              Retenção de Clientes
            </span>
            <h2 className="font-extrabold text-lg text-slate-900 mt-1.5 tracking-tight">
              Cartão Fidelidade Digital (por Celular)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              A cada pedido confirmado na vitrine, o cliente ganha 1 carimbo. Ao completar a meta, ganha desconto automático!
            </p>
          </div>
        </div>

        <label className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200/70 cursor-pointer">
          <div>
            <span className="text-xs font-extrabold text-slate-900 block">
              Ativar Programa de Fidelidade na vitrine
            </span>
            <span className="text-[11px] text-slate-500">
              Clientes veem os carimbos acumulados dentro da conta deles
            </span>
          </div>
          <input
            type="checkbox"
            checked={loyalty.enabled}
            onChange={(e) => setLoyalty((prev) => ({ ...prev, enabled: e.target.checked }))}
            className="w-5 h-5 accent-emerald-600 rounded cursor-pointer"
          />
        </label>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-1.5">
            <label className="font-bold text-slate-700 block">
              Meta de compras (carimbos)
            </label>
            <input
              type="number"
              min={2}
              max={50}
              value={loyalty.targetOrders}
              onChange={(e) =>
                setLoyalty((prev) => ({
                  ...prev,
                  targetOrders: Math.max(2, Number(e.target.value || 10)),
                }))
              }
              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 font-bold text-slate-900"
            />
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-1.5">
            <label className="font-bold text-slate-700 block">
              Prêmio em desconto (R$)
            </label>
            <input
              type="number"
              min={1}
              step="0.5"
              value={loyalty.rewardAmount}
              onChange={(e) =>
                setLoyalty((prev) => ({
                  ...prev,
                  rewardAmount: Math.max(1, Number(e.target.value || 15)),
                }))
              }
              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 font-bold text-slate-900"
            />
          </div>
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={() =>
            callPromoApi(
              { action: "save_loyalty", loyaltyConfig: loyalty },
              "Programa de fidelidade atualizado!"
            )
          }
          className="px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs active:scale-[0.98] transition disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Salvar Fidelidade"}
        </button>
      </div>

      {/* CRIAR NOVO CUPOM */}
      <form
        onSubmit={handleCreateCoupon}
        className="bg-white rounded-[32px] p-6 sm:p-7 border border-slate-200/70 shadow-sm shadow-slate-200/40 space-y-4"
      >
        <div>
          <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
            <Tag className="w-4 h-4 text-emerald-600" />
            Criar Cupom de Desconto
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Ex.: BEMVINDO10 (10% off) ou VIP15 (R$ 15 off)
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 text-xs">
          <input
            type="text"
            required
            placeholder="Código (ex: BEMVINDO10)"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s+/g, ""))}
            className="px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 font-extrabold uppercase text-slate-900 placeholder:normal-case placeholder:font-medium"
          />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDiscountType("percent")}
              className={`flex-1 py-2.5 px-3 rounded-2xl font-extrabold border flex items-center justify-center gap-1 transition ${
                discountType === "percent"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                  : "bg-slate-50 text-slate-500 border-slate-200"
              }`}
            >
              <Percent className="w-3.5 h-3.5" />
              Porcentagem
            </button>
            <button
              type="button"
              onClick={() => setDiscountType("fixed")}
              className={`flex-1 py-2.5 px-3 rounded-2xl font-extrabold border flex items-center justify-center gap-1 transition ${
                discountType === "fixed"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                  : "bg-slate-50 text-slate-500 border-slate-200"
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              Valor Fixo
            </button>
          </div>

          <input
            type="text"
            inputMode="decimal"
            required
            placeholder={discountType === "percent" ? "Desconto em % (ex: 10)" : "Desconto em R$ (ex: 15,00)"}
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
            className="px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 font-bold text-slate-900"
          />

          <input
            type="text"
            inputMode="decimal"
            placeholder="Pedido mínimo em R$ (opcional)"
            value={minOrder}
            onChange={(e) => setMinOrder(e.target.value)}
            className="px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 font-bold text-slate-900"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md shadow-emerald-600/20 active:scale-[0.98] transition disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          <span>Criar Cupom</span>
        </button>
      </form>

      {/* LISTA DE CUPONS */}
      <div className="bg-white rounded-[32px] p-6 sm:p-7 border border-slate-200/70 shadow-sm shadow-slate-200/40 space-y-3">
        <h3 className="font-extrabold text-sm text-slate-900">
          Cupons Cadastrados ({coupons.length})
        </h3>

        {coupons.length === 0 ? (
          <p className="text-xs text-slate-400">
            Nenhum cupom cadastrado ainda. Crie acima para divulgar aos clientes!
          </p>
        ) : (
          <div className="space-y-2.5">
            {coupons.map((c) => (
              <div
                key={c.id}
                className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-xl bg-slate-900 text-white font-black text-xs tracking-wide">
                      {c.code}
                    </span>
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                        c.active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {c.active ? "Ativo" : "Pausado"}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-600 mt-1">
                    {c.discountType === "percent"
                      ? `${c.discountValue}% de desconto`
                      : `${formatBRL(c.discountValue)} de desconto`}
                    {c.minOrder > 0 ? ` • Mínimo ${formatBRL(c.minOrder)}` : ""}
                    {` • ${c.usesCount} uso(s)`}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      callPromoApi(
                        { action: "toggle_coupon", couponId: c.id },
                        `Cupom ${c.code} ${c.active ? "pausado" : "ativado"}!`
                      )
                    }
                    title={c.active ? "Pausar cupom" : "Ativar cupom"}
                    className={`p-2.5 rounded-xl transition ${
                      c.active
                        ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                        : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                    }`}
                  >
                    <Power className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      callPromoApi(
                        { action: "delete_coupon", couponId: c.id },
                        `Cupom ${c.code} removido.`
                      )
                    }
                    title="Excluir cupom"
                    className="p-2.5 rounded-xl text-rose-500 hover:bg-rose-50 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
