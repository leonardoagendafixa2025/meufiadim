"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Download,
  PackagePlus,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatBRL } from "@/lib/whatsapp";

interface ProductRow {
  id: string;
  name: string;
  price: number;
  category: string;
  stock: number;
}

interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  balance: number;
}

interface SaleRow {
  id: string;
  customer_id?: string | null;
  total_amount: number;
  payment_method: string;
  description?: string | null;
  items?: Array<{ id?: string; name?: string; qty?: number; price?: number }> | null;
  order_status?: string | null;
  created_at: string;
}

interface ReportsTabProps {
  storeName: string;
  products: ProductRow[];
  customers: CustomerRow[];
  sales: SaleRow[];
  lowStockThreshold: number;
  onThresholdSaved: (nextThreshold: number) => void;
  onStockUpdated: () => void;
}

export function ReportsTab({
  storeName,
  products,
  customers,
  sales,
  lowStockThreshold,
  onThresholdSaved,
  onStockUpdated,
}: ReportsTabProps) {
  const [thresholdInput, setThresholdInput] = useState(lowStockThreshold);
  const [savingThreshold, setSavingThreshold] = useState(false);
  const [restockingId, setRestockingId] = useState<string | null>(null);

  const validSales = useMemo(
    () =>
      sales.filter(
        (s) => String(s.order_status || "").toUpperCase() !== "CANCELADO"
      ),
    [sales]
  );

  // Alerta de estoque baixo
  const lowStockProducts = useMemo(
    () =>
      products
        .filter((p) => Number(p.stock || 0) <= thresholdInput)
        .sort((a, b) => Number(a.stock || 0) - Number(b.stock || 0)),
    [products, thresholdInput]
  );

  // KPIs
  const totalSalesVal = useMemo(
    () => validSales.reduce((acc, s) => acc + Number(s.total_amount || 0), 0),
    [validSales]
  );
  const ticketMedio = validSales.length > 0 ? totalSalesVal / validSales.length : 0;
  const totalFiadoOpen = useMemo(
    () => customers.reduce((acc, c) => acc + Number(c.balance || 0), 0),
    [customers]
  );

  // Série dos últimos 7 dias
  const last7Days = useMemo(() => {
    const days: { dateKey: string; label: string; total: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      });
      days.push({ dateKey, label, total: 0 });
    }
    const dayMap = new Map(days.map((d) => [d.dateKey, d]));
    for (const s of validSales) {
      const key = String(s.created_at || "").slice(0, 10);
      const entry = dayMap.get(key);
      if (entry) entry.total += Number(s.total_amount || 0);
    }
    return days;
  }, [validSales]);

  const maxDailyTotal = Math.max(1, ...last7Days.map((d) => d.total));

  // Formas de pagamento
  const paymentBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const s of validSales) {
      const pm = s.payment_method || "Outro";
      const cur = map.get(pm) || { count: 0, total: 0 };
      cur.count += 1;
      cur.total += Number(s.total_amount || 0);
      map.set(pm, cur);
    }
    return Array.from(map.entries())
      .map(([method, v]) => ({ method, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [validSales]);

  // Top 5 produtos mais vendidos
  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const s of validSales) {
      if (!Array.isArray(s.items)) continue;
      for (const it of s.items) {
        const name = it.name || "Produto";
        const qty = Number(it.qty || 1);
        const rev = Number(it.price || 0) * qty;
        const cur = map.get(name) || { name, qty: 0, revenue: 0 };
        cur.qty += qty;
        cur.revenue += rev;
        map.set(name, cur);
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [validSales]);

  // Top 5 clientes
  const topCustomers = useMemo(() => {
    const custMap = new Map(customers.map((c) => [c.id, c.name]));
    const totals = new Map<string, { name: string; count: number; total: number }>();
    for (const s of validSales) {
      if (!s.customer_id) continue;
      const name = custMap.get(s.customer_id) || "Cliente";
      const cur = totals.get(s.customer_id) || { name, count: 0, total: 0 };
      cur.count += 1;
      cur.total += Number(s.total_amount || 0);
      totals.set(s.customer_id, cur);
    }
    return Array.from(totals.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [validSales, customers]);

  async function saveThreshold() {
    setSavingThreshold(true);
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
        body: JSON.stringify({ lowStockThreshold: thresholdInput }),
      });
      if (res.ok) onThresholdSaved(thresholdInput);
    } finally {
      setSavingThreshold(false);
    }
  }

  async function handleQuickRestock(prod: ProductRow, addQty: number) {
    setRestockingId(prod.id);
    try {
      await supabase
        .from("products")
        .update({ stock: Number(prod.stock || 0) + addQty })
        .eq("id", prod.id);
      onStockUpdated();
    } finally {
      setRestockingId(null);
    }
  }

  function handleExportCsv() {
    const custMap = new Map(customers.map((c) => [c.id, c.name]));
    const header = "Data;Cliente;Forma Pagamento;Status;Descricao;Valor (R$)\n";
    const rows = validSales
      .map((s) => {
        const dt = new Date(s.created_at).toLocaleString("pt-BR");
        const cli = (s.customer_id && custMap.get(s.customer_id)) || "Balcao";
        const desc = (s.description || "").replace(/[;\n\r]/g, " ");
        const val = Number(s.total_amount || 0).toFixed(2).replace(".", ",");
        return `${dt};${cli};${s.payment_method};${s.order_status || "RECEBIDO"};${desc};${val}`;
      })
      .join("\n");

    const blob = new Blob(["\uFEFF" + header + rows], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-${storeName.toLowerCase().replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      {/* ALERTA DE ESTOQUE BAIXO */}
      <div className="bg-white rounded-[32px] p-6 border border-slate-200/70 shadow-sm shadow-slate-200/40 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-extrabold text-base sm:text-lg text-slate-900 flex items-center gap-2">
              <AlertTriangle
                className={`w-5 h-5 ${
                  lowStockProducts.length > 0 ? "text-amber-500" : "text-emerald-600"
                }`}
              />
              Monitor de Estoque Baixo
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Produtos com estoque menor ou igual ao limite configurado recebem alerta automático.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-slate-600">Avisar ≤</span>
            <input
              type="number"
              min={0}
              max={100}
              value={thresholdInput}
              onChange={(e) => setThresholdInput(Math.max(0, Number(e.target.value || 0)))}
              className="w-16 px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 font-extrabold text-center"
            />
            <button
              type="button"
              disabled={savingThreshold}
              onClick={saveThreshold}
              className="px-3 py-1.5 rounded-xl bg-slate-900 text-white font-bold text-xs active:scale-95 transition"
            >
              {savingThreshold ? "..." : "Aplicar"}
            </button>
          </div>
        </div>

        {lowStockProducts.length === 0 ? (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800">
            ✅ Nenhum produto com estoque baixo (≤ {thresholdInput} un) no momento.
          </div>
        ) : (
          <div className="space-y-2">
            {lowStockProducts.map((p) => (
              <div
                key={p.id}
                className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                  p.stock === 0
                    ? "bg-rose-50/70 border-rose-200"
                    : "bg-amber-50/70 border-amber-200"
                }`}
              >
                <div className="min-w-0">
                  <p className="font-extrabold text-sm text-slate-900 truncate">{p.name}</p>
                  <p
                    className={`text-xs font-extrabold ${
                      p.stock === 0 ? "text-rose-700" : "text-amber-700"
                    }`}
                  >
                    {p.stock === 0 ? "ESGOTADO (0 un)" : `Restam apenas ${p.stock} un`} •{" "}
                    {p.category}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={restockingId === p.id}
                    onClick={() => handleQuickRestock(p, 5)}
                    className="px-2.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-emerald-50 text-emerald-700 font-extrabold text-xs inline-flex items-center gap-1 shadow-xs active:scale-95 transition"
                  >
                    <PackagePlus className="w-3.5 h-3.5" />
                    +5
                  </button>
                  <button
                    type="button"
                    disabled={restockingId === p.id}
                    onClick={() => handleQuickRestock(p, 10)}
                    className="px-2.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs active:scale-95 transition"
                  >
                    +10
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RESUMO GERENCIAL E EXPORTAÇÃO */}
      <div className="bg-white rounded-[32px] p-6 border border-slate-200/70 shadow-sm shadow-slate-200/40 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-extrabold text-lg text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-600" />
              Relatório de Vendas & Lucro
            </h2>
            <p className="text-xs text-slate-500">Desempenho acumulado da loja {storeName}</p>
          </div>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-sm active:scale-[0.98] transition"
          >
            <Download className="w-4 h-4" />
            <span>Exportar Excel (CSV)</span>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">
              Faturamento
            </span>
            <p className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
              {formatBRL(totalSalesVal)}
            </p>
            <span className="text-[10px] font-semibold text-slate-400">
              {validSales.length} venda(s)
            </span>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">
              Ticket Médio
            </span>
            <p className="text-base sm:text-lg font-black text-emerald-700 mt-0.5">
              {formatBRL(ticketMedio)}
            </p>
            <span className="text-[10px] font-semibold text-slate-400">por pedido</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">
              No Fiado
            </span>
            <p className="text-base sm:text-lg font-black text-amber-600 mt-0.5">
              {formatBRL(totalFiadoOpen)}
            </p>
            <span className="text-[10px] font-semibold text-slate-400">a receber</span>
          </div>
        </div>

        {/* Gráfico 7 dias */}
        <div className="space-y-2 pt-2">
          <p className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            Vendas dos últimos 7 dias
          </p>
          <div className="grid grid-cols-7 gap-2 items-end h-32 p-3 rounded-2xl bg-slate-50 border border-slate-100">
            {last7Days.map((d) => {
              const pct = Math.max(6, Math.round((d.total / maxDailyTotal) * 100));
              return (
                <div key={d.dateKey} className="flex flex-col items-center justify-end h-full gap-1">
                  <span className="text-[9px] font-bold text-slate-500 truncate max-w-full">
                    {d.total > 0 ? `R$${Math.round(d.total)}` : "-"}
                  </span>
                  <div className="w-full flex-1 flex items-end">
                    <div
                      style={{ height: `${d.total > 0 ? pct : 6}%` }}
                      className={`w-full rounded-t-lg transition-all ${
                        d.total > 0 ? "bg-emerald-500" : "bg-slate-200"
                      }`}
                    />
                  </div>
                  <span className="text-[10px] font-extrabold text-slate-600">{d.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Formas de pagamento */}
        {paymentBreakdown.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-extrabold text-slate-700">Por Forma de Pagamento</p>
            <div className="space-y-2">
              {paymentBreakdown.map((item) => {
                const share =
                  totalSalesVal > 0 ? Math.round((item.total / totalSalesVal) * 100) : 0;
                return (
                  <div key={item.method} className="text-xs space-y-1">
                    <div className="flex justify-between font-bold text-slate-700">
                      <span>
                        {item.method} ({item.count})
                      </span>
                      <span>
                        {formatBRL(item.total)} ({share}%)
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${share}%` }}
                        className="h-full bg-slate-900 rounded-full"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* RANKINGS */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-[28px] p-5 border border-slate-200/70 shadow-sm space-y-3">
          <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            Produtos Mais Vendidos
          </h3>
          {topProducts.length === 0 ? (
            <p className="text-xs text-slate-400">
              Vendas feitas pela vitrine aparecerão no ranking por item.
            </p>
          ) : (
            <div className="space-y-2">
              {topProducts.map((p, idx) => (
                <div
                  key={p.name}
                  className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-slate-50"
                >
                  <span className="font-bold text-slate-800 truncate">
                    #{idx + 1} {p.name}
                  </span>
                  <span className="font-extrabold text-emerald-700 shrink-0">
                    {p.qty} un
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-[28px] p-5 border border-slate-200/70 shadow-sm space-y-3">
          <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-600" />
            Clientes que Mais Compram
          </h3>
          {topCustomers.length === 0 ? (
            <p className="text-xs text-slate-400">
              Ainda não há histórico vinculado a clientes.
            </p>
          ) : (
            <div className="space-y-2">
              {topCustomers.map((c, idx) => (
                <div
                  key={c.name}
                  className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-slate-50"
                >
                  <span className="font-bold text-slate-800 truncate">
                    #{idx + 1} {c.name} ({c.count})
                  </span>
                  <span className="font-extrabold text-slate-900 shrink-0">
                    {formatBRL(c.total)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
