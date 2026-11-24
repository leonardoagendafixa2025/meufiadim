"use client";

import React, { useState } from "react";
import { X, CalendarClock, ArrowRight, ArrowLeft, Check, AlertCircle, User, DollarSign } from "lucide-react";
import { formatBRL } from "@/lib/whatsapp";

interface Customer {
  id: string;
  name: string;
  phone: string;
  balance: number;
}

interface NewEncomendaModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  onSave: (payload: {
    customerId: string;
    description: string;
    quantity: number;
    totalAmount: number;
    deliveryDate?: string;
    dueDate: string;
    notes?: string;
  }) => Promise<void>;
  saving: boolean;
}

export function NewEncomendaModal({
  isOpen,
  onClose,
  customers,
  onSave,
  saving,
}: NewEncomendaModalProps) {
  const [step, setStep] = useState<"form" | "review">("form");

  const [customerId, setCustomerId] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [totalAmount, setTotalAmount] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!isOpen) return null;

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const parsedAmount = Number(totalAmount.replace(",", "."));

  const handleGoToReview = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!customerId) {
      setValidationError("Por favor, selecione um cliente existente.");
      return;
    }
    if (!description.trim()) {
      setValidationError("Informe a descrição da encomenda.");
      return;
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setValidationError("Informe um valor total válido maior que zero.");
      return;
    }
    if (!dueDate) {
      setValidationError("A data combinada para pagamento é obrigatória.");
      return;
    }

    setStep("review");
  };

  const handleConfirmSubmit = async () => {
    await onSave({
      customerId,
      description: description.trim(),
      quantity: Number(quantity) || 1,
      totalAmount: parsedAmount,
      deliveryDate: deliveryDate || undefined,
      dueDate,
      notes: notes.trim() || undefined,
    });
    // Reset form
    setStep("form");
    setCustomerId("");
    setDescription("");
    setQuantity("1");
    setTotalAmount("");
    setDeliveryDate("");
    setDueDate("");
    setNotes("");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-lg rounded-[32px] p-6 sm:p-7 shadow-2xl border border-slate-100 ring-1 ring-black/5 space-y-5 max-h-[92vh] overflow-y-auto">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <CalendarClock className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-slate-900 leading-tight">
                {step === "form" ? "Cadastrar Encomenda" : "Conferência da Encomenda"}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {step === "form"
                  ? "Preencha os dados da encomenda com data de pagamento"
                  : "Revise os detalhes antes de integrar ao financeiro"}
              </p>
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

        {validationError && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{validationError}</span>
          </div>
        )}

        {/* ETAPA 1: FORMULÁRIO */}
        {step === "form" && (
          <form onSubmit={handleGoToReview} className="space-y-4">
            {/* Seleção do Cliente */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Cliente *
              </label>
              {customers.length === 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 font-medium">
                  Nenhum cliente cadastrado ainda. Cadastre clientes no Caderninho de Fiado antes de lançar encomendas.
                </div>
              ) : (
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                >
                  <option value="">Selecione o cliente...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — Tel: {c.phone} (Saldo atual: {formatBRL(c.balance)})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Descrição da Encomenda */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Descrição da Encomenda *
              </label>
              <input
                type="text"
                placeholder="Ex: 20 marmitas tradicionais, 3 bolos, 50 salgados..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            {/* Quantidade e Valor Total */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Quantidade
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Valor Total (R$) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Ex: 300.00"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
            </div>

            {/* Datas: Entrega (Opcional) e Pagamento (Obrigatório) */}
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Data Prevista de Entrega <span className="text-slate-400 font-normal">(opcional)</span>
                </label>
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Data de Pagamento * <span className="text-emerald-600 font-bold">(vencimento)</span>
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
            </div>

            {/* Observações */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Observações <span className="text-slate-400 font-normal">(opcional)</span>
              </label>
              <textarea
                placeholder="Ex: Entregar até 12h, ponto de referência, preferências..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md active:scale-95 transition"
            >
              <span>Conferir Resumo da Encomenda</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* ETAPA 2: RESUMO E CONFERÊNCIA ANTES DE SALVAR */}
        {step === "review" && (
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Cliente</span>
                <span className="text-sm font-extrabold text-slate-900">{selectedCustomer?.name}</span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Telefone</span>
                <span className="text-sm font-semibold text-slate-700">{selectedCustomer?.phone}</span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Descrição</span>
                <span className="text-sm font-extrabold text-slate-900">
                  {quantity}x {description}
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Valor Total</span>
                <span className="text-base font-extrabold text-emerald-600">{formatBRL(parsedAmount)}</span>
              </div>

              {deliveryDate && (
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Data de Entrega</span>
                  <span className="text-sm font-semibold text-slate-900">
                    {new Date(`${deliveryDate}T12:00:00`).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Data de Pagamento</span>
                <span className="text-sm font-extrabold text-slate-900">
                  {new Date(`${dueDate}T12:00:00`).toLocaleDateString("pt-BR")}
                </span>
              </div>

              {notes && (
                <div className="pt-1 text-xs text-slate-600">
                  <span className="font-bold block text-slate-500 uppercase tracking-wider text-[10px]">Observações:</span>
                  <p className="mt-0.5 italic">{notes}</p>
                </div>
              )}
            </div>

            {/* Aviso sobre Integração Financeira */}
            <div className="p-3.5 bg-emerald-50 border border-emerald-200/80 rounded-2xl flex items-start gap-2.5 text-xs text-emerald-900">
              <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-extrabold">Integração Financeira Automática:</p>
                <p className="text-[11px] text-emerald-800 leading-relaxed mt-0.5">
                  O valor de <strong>{formatBRL(parsedAmount)}</strong> será somado ao saldo devedor do cliente{" "}
                  (novo saldo: <strong>{formatBRL((selectedCustomer?.balance || 0) + parsedAmount)}</strong>) sem duplicações,
                  e a cobrança pelo WhatsApp com código Pix será disponibilizada para o dia{" "}
                  <strong>{new Date(`${dueDate}T12:00:00`).toLocaleDateString("pt-BR")}</strong>.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep("form")}
                disabled={saving}
                className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-2xl flex items-center justify-center gap-1.5 transition active:scale-95"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar e Editar</span>
              </button>

              <button
                type="button"
                onClick={handleConfirmSubmit}
                disabled={saving}
                className="py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-2xl flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95 transition disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{saving ? "Salvando..." : "Confirmar e Salvar"}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
