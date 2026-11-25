"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Send,
  X,
  ShoppingBag,
  Loader2,
  MessageCircle,
  CheckCircle2,
} from "lucide-react";

export interface CartActionItem {
  type: "add_to_cart";
  productId: string;
  productName: string;
  price: number;
  qty: number;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  cartActions?: CartActionItem[];
}

interface StoreSellerChatWidgetProps {
  storeId: string;
  storeSlug: string;
  storeName: string;
  brandColor?: string;
  customerId?: string | null;
  hasFloatingCartBar?: boolean;
  onCartActions?: (actions: CartActionItem[]) => void;
}

const CUSTOMER_CHIPS = [
  "Ver cardápio",
  "Calcular frete por CEP",
  "Estão abertos?",
  "Meus pedidos",
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
              <strong key={idx} className="font-bold">
                {part.slice(2, -2)}
              </strong>
            );
          }
          if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
            return (
              <strong key={idx} className="font-bold">
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

export function StoreSellerChatWidget({
  storeId,
  storeSlug,
  storeName,
  brandColor = "#059669",
  customerId = null,
  hasFloatingCartBar = false,
  onCartActions,
}: StoreSellerChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `Olá! Sou o **Vendedor IA** da **${storeName}**.\nPosso ajudar você a encontrar produtos, calcular o frete pelo CEP, tirar dúvidas de entrega ou montar sua sacola!`,
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
      const res = await fetch("/api/ai/seller", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          storeSlug,
          customerId,
          message: text,
          history: nextHistory,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Não foi possível responder agora.");
      }

      const cartActions: CartActionItem[] = Array.isArray(data.cartActions)
        ? data.cartActions
        : [];
      if (cartActions.length > 0) {
        onCartActions?.(cartActions);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: data.reply || "Como posso ajudar mais?",
          cartActions,
        },
      ]);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Erro de conexão. Tente novamente.";
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: `Desculpe, ocorreu um problema: ${msg}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const bottomOffsetClass = hasFloatingCartBar
    ? "bottom-24 sm:bottom-24"
    : "bottom-5 sm:bottom-6";

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Abrir atendimento IA da loja ${storeName}`}
          style={{ backgroundColor: brandColor }}
          className={`fixed ${bottomOffsetClass} right-4 sm:right-6 z-40 h-13 px-4 rounded-full text-white font-bold text-sm shadow-xl shadow-slate-900/25 flex items-center gap-2 transition-all duration-200 hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400/50`}
        >
          <MessageCircle className="w-5 h-5 stroke-[2.2]" />
          <span className="tracking-tight">Tirar Dúvidas</span>
          <Sparkles className="w-3.5 h-3.5 text-amber-200" />
        </button>
      )}

      {open && (
        <div
          className={`fixed ${bottomOffsetClass} right-3 left-3 sm:left-auto sm:right-6 sm:w-[390px] z-50 flex flex-col rounded-3xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800 shadow-2xl shadow-slate-900/25 overflow-hidden max-h-[74vh] sm:max-h-[560px]`}
        >
          {/* Header */}
          <div
            style={{ backgroundColor: brandColor }}
            className="px-4 py-3.5 text-white flex items-center justify-between shrink-0"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div className="min-w-0">
                <h3 className="font-extrabold text-sm truncate">Vendedor IA</h3>
                <p className="text-[11px] text-white/85 truncate">{storeName}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar atendimento IA"
              className="w-10 h-10 rounded-xl hover:bg-white/15 flex items-center justify-center transition-colors active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/70 dark:bg-slate-950/60"
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
                      ? "bg-slate-900 dark:bg-emerald-600 text-white rounded-br-md"
                      : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700 rounded-bl-md"
                  }`}
                >
                  {renderFormattedText(msg.content)}
                </div>

                {msg.role === "assistant" &&
                  msg.cartActions &&
                  msg.cartActions.length > 0 && (
                    <div className="mt-1.5 flex flex-col gap-1 max-w-[88%]">
                      {msg.cartActions.map((act, idx) => (
                        <span
                          key={`${act.productId}-${idx}`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800 text-[11px] font-semibold"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            +{act.qty}x {act.productName} na sacola
                          </span>
                          <ShoppingBag className="w-3 h-3 shrink-0" />
                        </span>
                      ))}
                    </div>
                  )}
              </div>
            ))}

            {loading && (
              <div className="flex items-start">
                <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-2xl rounded-bl-md px-3.5 py-2.5 text-xs text-slate-500 dark:text-slate-300 flex items-center gap-2 shadow-xs">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                  Verificando estoque e informações...
                </div>
              </div>
            )}
          </div>

          {/* Quick chips */}
          <div className="px-3 py-2 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            {CUSTOMER_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                disabled={loading}
                onClick={() => sendMessage(chip)}
                className="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors active:scale-[0.98] disabled:opacity-50"
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
            className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte sobre produtos ou frete..."
              className="flex-1 h-11 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-slate-300 dark:focus:border-slate-600 focus:bg-white dark:focus:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none transition-all"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Enviar pergunta ao Vendedor IA"
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
