"use client";

import React, { useMemo } from "react";
import {
  CalendarClock,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  Eye,
  MessageCircle,
  TrendingUp,
  Zap,
  Calendar,
  Package,
} from "lucide-react";
import { formatBRL } from "@/lib/whatsapp";
import type { Encomenda } from "@/lib/encomendas";

interface EncomendasTabProps {
  encomendas: Encomenda[];
  kpis: {
    totalPendentes: number;
    valorTotalAReceber: number;
    vencimentoHoje: number;
    atrasadas: number;
    totalPagas: number;
  };
  loading: boolean;
  search: string;
  setSearch: (s: string) => void;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  onOpenNew: () => void;
  onSelectEncomenda: (e: Encomenda) => void;
  onBaixa: (e: Encomenda) => void;
  onCharge: (e: Encomenda) => void;
  chargingId: string | null;
  onTriggerCron: () => void;
  triggeringCron: boolean;
}

export function EncomendasTab({
  encomendas,
  kpis,
  loading,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  onOpenNew,
  onSelectEncomenda,
  onBaixa,
  onCharge,
  chargingId,
  onTriggerCron,
  triggeringCron,
}: EncomendasTabProps) {
  const filteredEncomendas = useMemo(() => {
    return encomendas.filter((item) => {
      // Filtro de busca
      const matchesSearch =
        !search.trim() ||
        item.customer?.name?.toLowerCase().includes(search.toLowerCase()) ||
        item.description?.toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;

      // Filtro de status
      if (statusFilter === "TODOS") return true;
      if (statusFilter === "HOJE") {
        const todayStr = new Intl.DateTimeFormat("pt-BR", {
          timeZone: "America/Sao_Paulo",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        })
          .format(new Date())
          .split("/")
          .reverse()
          .join("-");
        return (
          (item.status === "PENDENTE" || item.status === "ATRASADA") &&
          item.due_date === todayStr
        );
      }
      return item.status === statusFilter;
    });
  }, [encomendas, search, statusFilter]);

  return (
    <div className="space-y-5">
      {/* Top Banner do Módulo */}
      <div className="bg-white rounded-[32px] p-6 sm:p-7 border border-slate-200/70 shadow-sm shadow-slate-200/50">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80">
              <CalendarClock className="w-3.5 h-3.5 text-emerald-600" />
              Vendas Antecipadas & Encomendas
            </span>
            <h2 className="font-extrabold text-xl text-slate-900 mt-2 tracking-tight">
              Módulo de Encomendas com Pagamento Programado
            </h2>
            <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed max-w-xl">
              Registre pedidos sob encomenda, integre ao saldo do cliente sem duplicar
              dívidas e automatize a cobrança no WhatsApp com chave Pix no dia do vencimento.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onTriggerCron}
              disabled={triggeringCron}
              className="px-3.5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 font-extrabold text-xs flex items-center gap-1.5 border border-slate-200/70 shadow-xs active:scale-95 transition"
              title="Verifica encomendas que vencem hoje e dispara cobranças pendentes"
            >
              <Zap className={`w-3.5 h-3.5 text-amber-500 ${triggeringCron ? "animate-spin" : ""}`} />
              <span>{triggeringCron ? "Disparando..." : "Cobrar Hoje"}</span>
            </button>

            <button
              type="button"
              onClick={onOpenNew}
              className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Encomenda</span>
            </button>
          </div>
        </div>

        {/* 5 Cards de Indicadores / KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6 pt-5 border-t border-slate-100">
          <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-3.5 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-500" /> Pendentes
            </span>
            <p className="text-xl sm:text-2xl font-extrabold text-slate-900">
              {kpis.totalPendentes}
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-3.5 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-emerald-600" /> A Receber
            </span>
            <p className="text-xl sm:text-2xl font-extrabold text-emerald-600 truncate">
              {formatBRL(kpis.valorTotalAReceber)}
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-3.5 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-blue-500" /> Vence Hoje
            </span>
            <p className="text-xl sm:text-2xl font-extrabold text-blue-600">
              {kpis.vencimentoHoje}
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-3.5 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-rose-500" /> Atrasadas
            </span>
            <p className="text-xl sm:text-2xl font-extrabold text-rose-600">
              {kpis.atrasadas}
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-3.5 space-y-1 col-span-2 sm:col-span-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Pagas
            </span>
            <p className="text-xl sm:text-2xl font-extrabold text-emerald-700">
              {kpis.totalPagas}
            </p>
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Pesquisar por cliente ou descrição..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200/80 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
          />
        </div>

        {/* Pílulas de Filtro de Situação */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
          {[
            { key: "TODOS", label: "Todas" },
            { key: "PENDENTE", label: "Pendentes" },
            { key: "HOJE", label: "Vencem Hoje" },
            { key: "ATRASADA", label: "Atrasadas" },
            { key: "PAGA", label: "Pagas" },
            { key: "CANCELADA", label: "Canceladas" },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setStatusFilter(item.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition active:scale-95 ${
                statusFilter === item.key
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Listagem de Encomendas */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400 font-semibold bg-white rounded-3xl border border-slate-200/70">
          Carregando encomendas...
        </div>
      ) : filteredEncomendas.length === 0 ? (
        <div className="bg-white rounded-[32px] p-10 sm:p-12 text-center border border-slate-200/70 shadow-sm shadow-slate-200/40 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto text-emerald-600 shadow-xs">
            <CalendarClock className="w-7 h-7 stroke-[1.75]" />
          </div>
          <h3 className="text-base font-extrabold text-slate-900">
            Nenhuma encomenda encontrada
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
            {search || statusFilter !== "TODOS"
              ? "Tente ajustar os filtros ou a busca acima para encontrar as encomendas desejadas."
              : "Cadastre encomendas antecipadas (marmitas, bolos, salgados) para controlar pagamentos futuros e disparar cobranças automáticas no WhatsApp."}
          </p>
          <button
            type="button"
            onClick={onOpenNew}
            className="mt-4 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md shadow-emerald-600/20 active:scale-95 transition"
          >
            <Plus className="w-4 h-4" /> Cadastrar Encomenda
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEncomendas.map((e) => {
            const isAtrasada = e.status === "ATRASADA";
            const isPaga = e.status === "PAGA";
            const isCancelada = e.status === "CANCELADA";

            const formattedDueDate = e.due_date
              ? new Date(`${e.due_date}T12:00:00`).toLocaleDateString("pt-BR")
              : "Data não definida";

            const formattedDeliveryDate = e.delivery_date
              ? new Date(`${e.delivery_date}T12:00:00`).toLocaleDateString("pt-BR")
              : null;

            return (
              <div
                key={e.id}
                className={`bg-white rounded-3xl p-5 border shadow-sm transition-all duration-200 space-y-4 hover:shadow-md ${
                  isAtrasada
                    ? "border-rose-200/90 bg-rose-50/10"
                    : isPaga
                    ? "border-emerald-200/70"
                    : isCancelada
                    ? "border-slate-200/70 opacity-70"
                    : "border-slate-200/80 hover:border-emerald-200"
                }`}
              >
                {/* Linha Superior: Cliente e Status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-slate-100 to-slate-200 text-slate-700 font-extrabold text-xs flex items-center justify-center shrink-0 border border-slate-200/60 shadow-xs">
                      {e.customer?.name ? e.customer.name.slice(0, 2).toUpperCase() : "EN"}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-extrabold text-sm sm:text-base text-slate-900 truncate">
                        {e.customer?.name || "Cliente não informado"}
                      </h4>
                      <p className="text-[11px] text-slate-400 font-medium">
                        {e.customer?.phone || "Sem telefone"}
                      </p>
                    </div>
                  </div>

                  {/* Badge de Status */}
                  <div className="shrink-0">
                    {isPaga && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Paga
                      </span>
                    )}
                    {isAtrasada && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                        <AlertTriangle className="w-3.5 h-3.5" /> Atrasada
                      </span>
                    )}
                    {!isPaga && !isAtrasada && !isCancelada && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                        <Clock className="w-3.5 h-3.5" /> Pendente
                      </span>
                    )}
                    {isCancelada && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-3 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                        <XCircle className="w-3.5 h-3.5" /> Cancelada
                      </span>
                    )}
                  </div>
                </div>

                {/* Meio: Descrição da Encomenda, Valor e Datas */}
                <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1 min-w-0">
                    <p className="font-extrabold text-slate-900 text-sm">
                      🍱 {e.description}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 font-medium">
                      <span>Qtd: <strong>{e.quantity}x</strong></span>
                      {formattedDeliveryDate && (
                        <span>Entrega prevista: <strong>{formattedDeliveryDate}</strong></span>
                      )}
                      <span>
                        Vencimento:{" "}
                        <strong className={isAtrasada ? "text-rose-600 font-extrabold" : "text-slate-900"}>
                          {formattedDueDate}
                        </strong>
                      </span>
                    </div>
                  </div>

                  <div className="text-left sm:text-right shrink-0">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Valor Total
                    </span>
                    <span className="text-lg font-extrabold text-slate-900">
                      {formatBRL(e.total_amount)}
                    </span>
                  </div>
                </div>

                {/* Ações da Encomenda */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onSelectEncomenda(e)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200/80 shadow-xs active:scale-95 transition"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-500" />
                    <span>Ver Detalhes</span>
                  </button>

                  <div className="flex items-center gap-2">
                    {!isPaga && !isCancelada && (
                      <>
                        <button
                          type="button"
                          onClick={() => onBaixa(e)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200/70 shadow-xs active:scale-95 transition"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Dar Baixa</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onCharge(e)}
                          disabled={chargingId === e.id}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold text-white bg-slate-900 hover:bg-slate-800 shadow-md active:scale-95 transition disabled:opacity-50"
                        >
                          <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{chargingId === e.id ? "Enviando..." : "Cobrar Zap"}</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
