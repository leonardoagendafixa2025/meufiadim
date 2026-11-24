"use client";

import React, { useMemo } from "react";
import {
  X,
  User,
  CalendarClock,
  ShoppingBag,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";
import { formatBRL } from "@/lib/whatsapp";
import type { Encomenda } from "@/lib/encomendas";

interface Customer {
  id: string;
  name: string;
  phone: string;
  credit_limit: number;
  balance: number;
  due_date?: string | null;
}

interface Sale {
  id: string;
  customer_id?: string | null;
  total_amount: number;
  commission_amount: number;
  payment_method: string;
  created_at: string;
}

interface CustomerHistoryModalProps {
  customer: Customer | null;
  encomendas: Encomenda[];
  sales: Sale[];
  onClose: () => void;
  onSelectEncomenda: (e: Encomenda) => void;
}

export function CustomerHistoryModal({
  customer,
  encomendas,
  sales,
  onClose,
  onSelectEncomenda,
}: CustomerHistoryModalProps) {
  if (!customer) return null;

  // Filtrar encomendas do cliente
  const customerEncomendas = useMemo(() => {
    return encomendas.filter((e) => e.customer_id === customer.id);
  }, [encomendas, customer.id]);

  // Encomendas ativas (pendentes ou atrasadas) que compõem o saldo
  const pendingEncomendas = useMemo(() => {
    return customerEncomendas.filter(
      (e) => e.status === "PENDENTE" || e.status === "ATRASADA"
    );
  }, [customerEncomendas]);

  // Soma das encomendas pendentes
  const totalEncomendasPendentes = useMemo(() => {
    return pendingEncomendas.reduce((acc, e) => acc + Number(e.total_amount || 0), 0);
  }, [pendingEncomendas]);

  // Fiado convencional = saldo total do cliente - encomendas pendentes
  const fiadoConvencional = Math.max(
    0,
    Number((customer.balance - totalEncomendasPendentes).toFixed(2))
  );

  // Vendas do cliente no histórico
  const customerSales = useMemo(() => {
    return sales.filter((s) => s.customer_id === customer.id);
  }, [sales, customer.id]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-xl rounded-[32px] p-6 sm:p-7 shadow-2xl border border-slate-100 ring-1 ring-black/5 space-y-5 max-h-[92vh] overflow-y-auto">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 font-extrabold text-sm shrink-0 shadow-xs">
              {customer.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-slate-900 leading-tight">
                {customer.name}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {customer.phone || "Sem telefone"} — Extrato Financeiro Integrado
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

        {/* Quadro Consolidado de Saldos (Sem Duplicações) */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-5 space-y-4 shadow-xl">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                Saldo Devedor Total
              </span>
              <p className="text-3xl font-extrabold text-white tracking-tight mt-0.5">
                {formatBRL(customer.balance)}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Limite de Crédito
              </span>
              <p className="text-xs font-extrabold text-slate-200 mt-0.5">
                {formatBRL(customer.credit_limit)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-700/80">
            <div className="bg-slate-800/80 rounded-2xl p-3 border border-slate-700/60 space-y-0.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <ShoppingBag className="w-3 h-3 text-amber-400" /> Fiado Convencional
              </span>
              <p className="text-base font-extrabold text-amber-300">
                {formatBRL(fiadoConvencional)}
              </p>
            </div>

            <div className="bg-slate-800/80 rounded-2xl p-3 border border-slate-700/60 space-y-0.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <CalendarClock className="w-3 h-3 text-emerald-400" /> Encomendas Pendentes
              </span>
              <p className="text-base font-extrabold text-emerald-300">
                {formatBRL(totalEncomendasPendentes)}
              </p>
            </div>
          </div>
        </div>

        {/* Seção 1: Encomendas com Pagamento Programado */}
        <div className="space-y-3">
          <h4 className="font-extrabold uppercase tracking-wider text-slate-700 text-xs flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <CalendarClock className="w-4 h-4 text-emerald-600" />
              Encomendas Programadas ({customerEncomendas.length})
            </span>
          </h4>

          {customerEncomendas.length === 0 ? (
            <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-400 font-medium">
              Nenhuma encomenda registrada para este cliente.
            </div>
          ) : (
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {customerEncomendas.map((enc) => {
                const isPaga = enc.status === "PAGA";
                const isAtrasada = enc.status === "ATRASADA";

                return (
                  <div
                    key={enc.id}
                    onClick={() => onSelectEncomenda(enc)}
                    className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200/70 rounded-2xl flex items-center justify-between gap-3 text-xs cursor-pointer transition active:scale-[0.99]"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <p className="font-extrabold text-slate-900 truncate">
                        🍱 {enc.quantity}x {enc.description}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
                        <span>
                          Vencimento:{" "}
                          <strong>
                            {new Date(`${enc.due_date}T12:00:00`).toLocaleDateString("pt-BR")}
                          </strong>
                        </span>
                        {enc.delivery_date && (
                          <span>
                            • Entrega:{" "}
                            {new Date(`${enc.delivery_date}T12:00:00`).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="font-extrabold text-slate-900 text-sm">
                        {formatBRL(enc.total_amount)}
                      </p>
                      <span
                        className={`inline-block text-[9px] font-extrabold px-2 py-0.5 rounded-md ${
                          isPaga
                            ? "bg-emerald-100 text-emerald-800"
                            : isAtrasada
                            ? "bg-rose-100 text-rose-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {enc.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Seção 2: Histórico de Vendas e Fiado */}
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <h4 className="font-extrabold uppercase tracking-wider text-slate-700 text-xs flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <ShoppingBag className="w-4 h-4 text-slate-600" />
              Lançamentos & Vendas Registradas ({customerSales.length})
            </span>
          </h4>

          {customerSales.length === 0 ? (
            <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-400 font-medium">
              Nenhuma venda registrada para este cliente.
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {customerSales.map((sale) => (
                <div
                  key={sale.id}
                  className="p-3 bg-slate-50 border border-slate-200/70 rounded-2xl flex items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5">
                    <span className="font-extrabold text-slate-900 block">
                      {sale.payment_method === "Encomenda"
                        ? "📦 Encomenda Programada"
                        : "📝 Compra no Fiado"}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(sale.created_at).toLocaleDateString("pt-BR")}{" "}
                      {new Date(sale.created_at).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <span className="font-extrabold text-slate-900 text-sm">
                    {formatBRL(sale.total_amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-2xl transition"
        >
          Fechar Extrato
        </button>
      </div>
    </div>
  );
}
