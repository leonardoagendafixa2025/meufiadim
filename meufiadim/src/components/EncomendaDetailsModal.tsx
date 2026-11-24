"use client";

import React, { useState } from "react";
import {
  X,
  CalendarClock,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  MessageCircle,
  DollarSign,
  Edit2,
  Save,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Send,
  Calendar,
} from "lucide-react";
import { formatBRL } from "@/lib/whatsapp";
import type { Encomenda } from "@/lib/encomendas";

interface EncomendaDetailsModalProps {
  encomenda: Encomenda | null;
  onClose: () => void;
  onBaixa: (e: Encomenda) => Promise<void>;
  onCancel: (e: Encomenda) => Promise<void>;
  onEdit: (
    id: string,
    payload: {
      description: string;
      quantity: number;
      totalAmount: number;
      deliveryDate?: string;
      dueDate: string;
      notes?: string;
    }
  ) => Promise<void>;
  onCharge: (e: Encomenda) => Promise<void>;
  charging: boolean;
  onOpenWhatsAppWeb: (e: Encomenda) => void;
}

export function EncomendaDetailsModal({
  encomenda,
  onClose,
  onBaixa,
  onCancel,
  onEdit,
  onCharge,
  charging,
  onOpenWhatsAppWeb,
}: EncomendaDetailsModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [desc, setDesc] = useState(encomenda?.description || "");
  const [qty, setQty] = useState(String(encomenda?.quantity || 1));
  const [val, setVal] = useState(String(encomenda?.total_amount || ""));
  const [delivDate, setDelivDate] = useState(encomenda?.delivery_date || "");
  const [dueDate, setDueDate] = useState(encomenda?.due_date || "");
  const [notes, setNotes] = useState(encomenda?.notes || "");
  const [savingEdit, setSavingEdit] = useState(false);
  const [expandedNotifId, setExpandedNotifId] = useState<string | null>(null);

  if (!encomenda) return null;

  const isPaga = encomenda.status === "PAGA";
  const isAtrasada = encomenda.status === "ATRASADA";
  const isCancelada = encomenda.status === "CANCELADA";

  const handleSaveEdit = async () => {
    const numAmount = Number(val.replace(",", "."));
    if (isNaN(numAmount) || numAmount <= 0) {
      alert("Informe um valor total válido.");
      return;
    }
    if (!dueDate) {
      alert("A data de pagamento é obrigatória.");
      return;
    }

    setSavingEdit(true);
    try {
      await onEdit(encomenda.id, {
        description: desc.trim(),
        quantity: Number(qty) || 1,
        totalAmount: numAmount,
        deliveryDate: delivDate || undefined,
        dueDate,
        notes: notes.trim() || undefined,
      });
      setIsEditing(false);
    } catch (e: any) {
      alert(`Erro ao salvar alterações: ${e.message}`);
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-xl rounded-[32px] p-6 sm:p-7 shadow-2xl border border-slate-100 ring-1 ring-black/5 space-y-5 max-h-[92vh] overflow-y-auto">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
              <CalendarClock className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-mono font-extrabold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                  #{encomenda.id.slice(0, 8).toUpperCase()}
                </span>
                {isPaga && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3" /> Paga
                  </span>
                )}
                {isAtrasada && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                    <AlertTriangle className="w-3 h-3" /> Atrasada
                  </span>
                )}
                {!isPaga && !isAtrasada && !isCancelada && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                    <Clock className="w-3 h-3" /> Pendente
                  </span>
                )}
                {isCancelada && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    <XCircle className="w-3 h-3" /> Cancelada
                  </span>
                )}
              </div>
              <h3 className="font-extrabold text-lg text-slate-900 mt-0.5">
                Detalhes da Encomenda
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Card do Cliente */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-700 font-extrabold text-sm flex items-center justify-center shrink-0 shadow-xs">
              {encomenda.customer?.name ? encomenda.customer.name.slice(0, 2).toUpperCase() : "CL"}
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Cliente</span>
              <p className="font-extrabold text-sm text-slate-900 truncate">
                {encomenda.customer?.name || "Cliente"}
              </p>
              <p className="text-slate-500 font-medium">
                {encomenda.customer?.phone || "Sem telefone"}
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Saldo Total Devedor</span>
            <span className="text-sm font-extrabold text-slate-900">
              {formatBRL(encomenda.customer?.balance || 0)}
            </span>
          </div>
        </div>

        {/* Informações da Encomenda (Modo Visualização ou Edição) */}
        {!isEditing ? (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <h4 className="font-extrabold uppercase tracking-wider text-slate-400 text-[10px]">
                Dados do Pedido
              </h4>
              {!isPaga && !isCancelada && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-1 text-emerald-600 font-bold hover:underline"
                >
                  <Edit2 className="w-3 h-3" /> Editar
                </button>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-3 pt-1">
              <div>
                <span className="text-slate-500 block">Descrição:</span>
                <span className="font-extrabold text-slate-900 text-sm">
                  🍱 {encomenda.quantity}x {encomenda.description}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block">Valor a Receber:</span>
                <span className="font-extrabold text-emerald-600 text-base">
                  {formatBRL(encomenda.total_amount)}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block">Data de Criação:</span>
                <span className="font-semibold text-slate-800">
                  {new Date(encomenda.created_at).toLocaleDateString("pt-BR")}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block">Data Prevista de Entrega:</span>
                <span className="font-semibold text-slate-800">
                  {encomenda.delivery_date
                    ? new Date(`${encomenda.delivery_date}T12:00:00`).toLocaleDateString("pt-BR")
                    : "Não informada"}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block">Data Combinada para Pagamento:</span>
                <span className="font-extrabold text-slate-900 text-sm">
                  {new Date(`${encomenda.due_date}T12:00:00`).toLocaleDateString("pt-BR")}
                </span>
              </div>

              {encomenda.paid_at && (
                <div>
                  <span className="text-slate-500 block">Quitada em:</span>
                  <span className="font-extrabold text-emerald-700">
                    {new Date(encomenda.paid_at).toLocaleDateString("pt-BR")}{" "}
                    {new Date(encomenda.paid_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              )}
            </div>

            {encomenda.notes && (
              <div className="pt-2 border-t border-slate-100 text-xs">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] block">
                  Observações:
                </span>
                <p className="text-slate-600 mt-0.5 italic">{encomenda.notes}</p>
              </div>
            )}
          </div>
        ) : (
          /* MODO EDIÇÃO */
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3 text-xs">
            <h4 className="font-extrabold uppercase tracking-wider text-slate-700 text-xs flex items-center gap-1.5">
              <Edit2 className="w-3.5 h-3.5 text-emerald-600" />
              Editar Dados da Encomenda
            </h4>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 block">Descrição:</label>
              <input
                type="text"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Quantidade:</label>
                <input
                  type="number"
                  min="1"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Valor Total (R$):</label>
                <input
                  type="number"
                  step="0.01"
                  value={val}
                  onChange={(e) => setVal(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Data de Entrega:</label>
                <input
                  type="date"
                  value={delivDate}
                  onChange={(e) => setDelivDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Data de Pagamento *:</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 block">Observações:</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="px-4 py-2 bg-emerald-600 text-white font-extrabold text-xs rounded-xl shadow-xs"
              >
                {savingEdit ? "Salvando..." : "Salvar Alterações"}
              </button>
            </div>
          </div>
        )}

        {/* Histórico de Disparos de Cobrança pelo WhatsApp */}
        <div className="space-y-2.5">
          <h4 className="font-extrabold uppercase tracking-wider text-slate-500 text-[10px] flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
              Histórico de Cobranças pelo WhatsApp
            </span>
            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">
              {encomenda.notifications?.length || 0} disparo(s)
            </span>
          </h4>

          {(!encomenda.notifications || encomenda.notifications.length === 0) ? (
            <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-400 font-medium">
              Nenhuma cobrança enviada pelo WhatsApp para esta encomenda até o momento.
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {encomenda.notifications.map((notif) => {
                const isSent = notif.status === "sent";
                const isExpanded = expandedNotifId === notif.id;

                return (
                  <div
                    key={notif.id}
                    className="p-3 bg-slate-50 border border-slate-200/70 rounded-2xl text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isSent ? "bg-emerald-500" : "bg-rose-500"
                          }`}
                        />
                        <span className="font-extrabold text-slate-900">
                          {isSent ? "Enviado com sucesso" : "Falha no envio"}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(notif.sent_at).toLocaleDateString("pt-BR")}{" "}
                          {new Date(notif.sent_at).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setExpandedNotifId(isExpanded ? null : notif.id)}
                        className="text-[11px] text-emerald-600 font-bold hover:underline flex items-center gap-0.5"
                      >
                        <span>{isExpanded ? "Ocultar" : "Ver Mensagem"}</span>
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    </div>

                    {notif.error_message && (
                      <p className="text-[11px] text-rose-600 font-medium">
                        Erro: {notif.error_message}
                      </p>
                    )}

                    {isExpanded && (
                      <div className="p-2.5 bg-white border border-slate-200 rounded-xl text-[11px] font-mono text-slate-700 whitespace-pre-wrap mt-1 shadow-inner">
                        {notif.message}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Botões de Ação */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
          {!isPaga && !isCancelada ? (
            <>
              <button
                type="button"
                onClick={() => onCancel(encomenda)}
                className="px-3.5 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-2xl transition flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Cancelar Encomenda</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenWhatsAppWeb(encomenda)}
                  className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-2xl flex items-center gap-1.5 transition active:scale-95"
                  title="Abrir no WhatsApp Web"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>WhatsApp Web</span>
                </button>

                <button
                  type="button"
                  onClick={() => onCharge(encomenda)}
                  disabled={charging}
                  className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-2xl flex items-center gap-1.5 shadow-md active:scale-95 transition disabled:opacity-50"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{charging ? "Enviando..." : "Cobrar Zap"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onBaixa(encomenda)}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-2xl flex items-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95 transition"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Dar Baixa (Receber)</span>
                </button>
              </div>
            </>
          ) : (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-2xl transition"
              >
                Fechar Detalhes
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
