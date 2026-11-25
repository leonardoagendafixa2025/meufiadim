"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Bot,
  Sparkles,
  Send,
  X,
  Wrench,
  Loader2,
  Minimize2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolsUsed?: string[];
  provider?: string;
}

interface AdminCopilotWidgetProps {
  storeName: string;
  brandColor?: string;
  onDataChanged?: () => void;
}

const QUICK_SUGGESTIONS = [
  "Resumo do fiado",
  "Pedidos em aberto",
  "Clientes sumidos",
  "Estoque baixo",
  "Clientes em atraso",
  "Encomendas pendentes",
];

function renderFormattedText(text: string) {
  const lines = text.split("\n");
  return lines.map((line, lineIdx) => {
    const parts = line.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*)/g);
    return (
      <React.Fragment key={lineIdx}>
        {parts.map((part, idx) => {
          if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
            return (
              <strong key={idx} className="font-bold text-slate-900">
                {part.slice(2, -2)}
              </strong>
            );
          }
          if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
            return (
              <strong key={idx} className="font-bold text-slate-900">
                {part.slice(1, -1)}
              </strong>
            );
          }
          return <React.Fragment key={idx}>{part}</React.Fragment>;
        })}
        {lineIdx < lines.length - 1 && <br />}
      </React.Fragment>
    );
  });
}

export function AdminCopilotWidget({
  storeName,
  brandColor = "#059669",
  onDataChanged,
}: AdminCopilotWidgetProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `Olá! Sou o **Copiloto IA** da loja **${storeName}**.\nPosso consultar seu fiado, listar devedores, verificar encomendas, buscar produtos, criar encomendas e enviar cobranças no WhatsApp via MCP.`,
    },
  ]);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [open, messages, loading]);

  async function sendMessage(rawText?: string) {
    const text = (rawText ?? input).trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
    };

    const nextHistory = messages
      .filter((m) => m.id !== "welcome")
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMsg]);
    if (!rawText) setInput("");
    setLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setMessages((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            role: "assistant",
            content: "Sua sessão expirou. Recarregue a página e faça login novamente.",
          },
        ]);
        return;
      }

      const res = await fetch("/api/ai/copilot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message: text,
          history: nextHistory,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Não foi possível consultar o Copiloto IA.");
      }

      const toolsUsed: string[] = Array.isArray(data.toolsUsed) ? data.toolsUsed : [];
      if (
        toolsUsed.some((t) =>
          [
            "create_encomenda",
            "send_whatsapp_charge",
            "send_reactivation_whatsapp",
            "create_fiado_sale",
            "record_fiado_payment",
            "update_order_status",
          ].includes(t)
        )
      ) {
        onDataChanged?.();
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: data.reply || "Pronto!",
          toolsUsed,
          provider: data.provider,
        },
      ]);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Erro ao falar com o Copiloto IA.";
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: `Ops: ${msg}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir Copiloto IA da loja"
          style={{ backgroundColor: brandColor }}
          className="fixed bottom-24 right-4 sm:right-6 z-40 h-13 px-4 rounded-2xl text-white font-bold text-sm shadow-xl shadow-slate-900/20 flex items-center gap-2.5 transition-all duration-200 hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400/50"
        >
          <span className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <Bot className="w-5 h-5 stroke-[2.2]" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-300 ring-2 ring-white/40 animate-pulse" />
          </span>
          <span className="hidden sm:inline tracking-tight">Copiloto IA</span>
          <Sparkles className="w-4 h-4 text-amber-200 sm:hidden" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-24 right-3 left-3 sm:left-auto sm:right-6 sm:w-[400px] z-50 flex flex-col rounded-3xl bg-white/95 backdrop-blur-xl border border-slate-200/90 shadow-2xl shadow-slate-900/20 overflow-hidden max-h-[75vh] sm:max-h-[580px]">
          {/* Header */}
          <div
            style={{ backgroundColor: brandColor }}
            className="px-4 py-3.5 text-white flex items-center justify-between shrink-0"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-extrabold text-sm truncate">Copiloto IA</h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-white/20">
                    MCP
                  </span>
                </div>
                <p className="text-[11px] text-white/85 truncate">{storeName}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar Copiloto IA"
              className="w-10 h-10 rounded-xl hover:bg-white/15 flex items-center justify-center transition-colors active:scale-95"
            >
              <Minimize2 className="w-4 h-4 hidden sm:block" />
              <X className="w-5 h-5 sm:hidden" />
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/70"
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.role === "user" ? "items-end" : "items-start"
                }`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed shadow-xs ${
                    msg.role === "user"
                      ? "bg-slate-900 text-white rounded-br-md"
                      : "bg-white text-slate-700 border border-slate-200/80 rounded-bl-md"
                  }`}
                >
                  {renderFormattedText(msg.content)}
                </div>
                {msg.role === "assistant" &&
                  msg.toolsUsed &&
                  msg.toolsUsed.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1 max-w-[88%]">
                      {msg.toolsUsed.map((tool) => (
                        <span
                          key={tool}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70 text-[10px] font-semibold"
                        >
                          <Wrench className="w-2.5 h-2.5" />
                          {tool}
                        </span>
                      ))}
                    </div>
                  )}
              </div>
            ))}

            {loading && (
              <div className="flex items-start">
                <div className="bg-white border border-slate-200/80 rounded-2xl rounded-bl-md px-3.5 py-2.5 text-xs text-slate-500 flex items-center gap-2 shadow-xs">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                  Consultando ferramentas MCP...
                </div>
              </div>
            )}
          </div>

          {/* Quick suggestions */}
          <div className="px-3 py-2 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            {QUICK_SUGGESTIONS.map((chip) => (
              <button
                key={chip}
                type="button"
                disabled={loading}
                onClick={() => sendMessage(chip)}
                className="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors active:scale-[0.98] disabled:opacity-50"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="p-3 bg-white border-t border-slate-200/80 flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte sobre fiado, clientes, encomendas..."
              className="flex-1 h-11 px-3.5 rounded-xl bg-slate-100 border border-transparent focus:border-slate-300 focus:bg-white text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-all"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Enviar mensagem ao Copiloto IA"
              style={{ backgroundColor: brandColor }}
              className="h-11 w-11 rounded-xl text-white flex items-center justify-center shrink-0 transition-all hover:brightness-110 active:scale-[0.96] disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
