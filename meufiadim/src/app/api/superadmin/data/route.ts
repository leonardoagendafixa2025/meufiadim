import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return createClient(url, key);
}

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseAdmin = getSupabaseAdmin();
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    const userEmail = (user?.email || "").toLowerCase().trim();
    const superAdmins = [
      "toyesterdayagencia@gmail.com",
      (process.env.NEXT_PUBLIC_SUPERADMIN_EMAIL || "").toLowerCase().trim(),
    ].filter(Boolean);

    if (authError || !user || !superAdmins.includes(userEmail)) {
      return NextResponse.json(
        { error: "Acesso negado. Apenas o SuperAdmin pode acessar estes dados." },
        { status: 403 }
      );
    }

    // 1. Buscar todas as lojas
    const { data: stores, error: storesError } = await supabaseAdmin
      .from("stores")
      .select("*")
      .order("created_at", { ascending: false });

    if (storesError) {
      throw storesError;
    }

    // 2. Buscar dados agregados de clientes, produtos, vendas e faturas
    const [custRes, prodRes, salesRes, invRes] = await Promise.all([
      supabaseAdmin.from("customers").select("id, store_id, balance"),
      supabaseAdmin.from("products").select("id, store_id"),
      supabaseAdmin.from("sales").select("id, store_id, total_amount, commission_amount"),
      supabaseAdmin
        .from("platform_invoices")
        .select("*, stores(name, slug)")
        .order("created_at", { ascending: false }),
    ]);

    const customers = custRes.data || [];
    const products = prodRes.data || [];
    const sales = salesRes.data || [];
    const invoices = invRes.data || [];

    // Mapear métricas por loja
    const storeMetricsMap: Record<
      string,
      {
        customersCount: number;
        productsCount: number;
        totalBalance: number;
        totalSales: number;
        totalCommission: number;
      }
    > = {};

    for (const s of stores || []) {
      storeMetricsMap[s.id] = {
        customersCount: 0,
        productsCount: 0,
        totalBalance: 0,
        totalSales: 0,
        totalCommission: 0,
      };
    }

    for (const c of customers) {
      if (storeMetricsMap[c.store_id]) {
        storeMetricsMap[c.store_id].customersCount += 1;
        storeMetricsMap[c.store_id].totalBalance += Number(c.balance || 0);
      }
    }

    for (const p of products) {
      if (storeMetricsMap[p.store_id]) {
        storeMetricsMap[p.store_id].productsCount += 1;
      }
    }

    for (const sa of sales) {
      if (storeMetricsMap[sa.store_id]) {
        storeMetricsMap[sa.store_id].totalSales += Number(sa.total_amount || 0);
        storeMetricsMap[sa.store_id].totalCommission += Number(sa.commission_amount || 0);
      }
    }

    // Enriquecer lista de lojas com as métricas
    const enrichedStores = (stores || []).map((s) => ({
      ...s,
      metrics: storeMetricsMap[s.id] || {
        customersCount: 0,
        productsCount: 0,
        totalBalance: 0,
        totalSales: 0,
        totalCommission: 0,
      },
    }));

    // Métricas Globais da Plataforma
    const totalStores = enrichedStores.length;
    const activeStores = enrichedStores.filter((s) => s.status === "active").length;
    const blockedStores = enrichedStores.filter((s) => s.status === "blocked").length;
    const totalCustomers = customers.length;
    const totalProducts = products.length;

    const totalReceivable = customers.reduce(
      (acc, c) => acc + Number(c.balance || 0),
      0
    );

    const totalSalesVolume = sales.reduce(
      (acc, sa) => acc + Number(sa.total_amount || 0),
      0
    );

    const totalCommissionDue = enrichedStores.reduce(
      (acc, s) => acc + (s.metrics?.totalCommission || 0),
      0
    );

    const totalCommissionPaid = invoices
      .filter((inv) => inv.status === "paid")
      .reduce((acc, inv) => acc + Number(inv.commission_due || 0), 0);

    return NextResponse.json({
      stats: {
        totalStores,
        activeStores,
        blockedStores,
        totalCustomers,
        totalProducts,
        totalReceivable,
        totalSalesVolume,
        totalCommissionDue,
        totalCommissionPaid,
      },
      stores: enrichedStores,
      invoices,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Erro interno ao carregar dados do SuperAdmin." },
      { status: 500 }
    );
  }
}
