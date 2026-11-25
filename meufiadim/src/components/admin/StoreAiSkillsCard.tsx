"use client";

import React, { useEffect, useState } from "react";
import { Bot, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  DEFAULT_AI_SKILL_ID,
  STORE_AI_SKILLS,
  type StoreAiSkillId,
} from "@/lib/ai-skills";

export function StoreAiSkillsCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<StoreAiSkillId>(DEFAULT_AI_SKILL_ID);
  const [customInstructions, setCustomInstructions] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const res = await fetch("/api/store/ai-skills", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await res.json();
        if (res.ok && data.ok) {
          setSelectedSkill(data.skillId || DEFAULT_AI_SKILL_ID);
          setCustomInstructions(data.customInstructions || "");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleSave(e?: React.FormEvent) {
    e?.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch("/api/store/ai-skills", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          skillId: selectedSkill,
          customInstructions,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar Skill da IA.");
      setFeedback(data.message || "Skill salva com sucesso!");
    } catch (err: any) {
      alert(err?.message || "Não foi possível salvar a Skill.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSave}
      className="bg-white rounded-[32px] p-6 sm:p-7 border border-slate-200/70 shadow-sm shadow-slate-200/50 space-y-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase px-3 py-1 rounded-full bg-purple-50 text-purple-800 border border-purple-200/80">
            <Sparkles className="w-3 h-3 text-purple-600" />
            Skills do Vendedor IA
          </span>
          <h3 className="font-extrabold text-xl text-slate-900 mt-2 tracking-tight">
            Especialidade da IA por Ramo do Negócio
          </h3>
          <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">
            Escolha como o <strong>Vendedor IA da vitrine</strong> e o{" "}
            <strong>Assistente do WhatsApp</strong> atendem seus clientes e sugerem produtos.
          </p>
        </div>

        <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center shrink-0">
          <Bot className="w-6 h-6" />
        </div>
      </div>

      {loading ? (
        <div className="py-8 flex items-center justify-center text-xs font-bold text-slate-400 gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
          Carregando Skills...
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 gap-3">
            {STORE_AI_SKILLS.map((sk) => {
              const active = selectedSkill === sk.id;
              return (
                <button
                  key={sk.id}
                  type="button"
                  onClick={() => setSelectedSkill(sk.id)}
                  className={`p-4 rounded-2xl border-2 text-left transition-all active:scale-[0.99] space-y-1.5 ${
                    active
                      ? "bg-emerald-50/70 border-emerald-500 shadow-xs"
                      : "bg-slate-50/70 border-slate-200/70 hover:bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-extrabold text-sm text-slate-900">{sk.name}</span>
                    <span
                      className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                        active
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {sk.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{sk.description}</p>
                  <p className="text-[11px] font-semibold text-emerald-700 pt-0.5">
                    {sk.exampleTip}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-slate-700 block">
              Regras extras da sua loja para a IA (opcional)
            </label>
            <textarea
              rows={3}
              maxLength={400}
              placeholder="Ex: Entregamos até as 22h. Pedidos acima de R$ 80 têm brinde surpresa. Aceitamos encomendas de bolos com 2 dias de antecedência."
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-emerald-500 focus:outline-none transition"
            />
            <p className="text-[10px] text-slate-400 text-right">
              {customInstructions.length}/400 caracteres
            </p>
          </div>

          {feedback && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{feedback}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs sm:text-sm shadow-md active:scale-[0.98] transition disabled:opacity-50"
          >
            {saving ? "Salvando Skill..." : "Salvar Especialidade da IA"}
          </button>
        </>
      )}
    </form>
  );
}
