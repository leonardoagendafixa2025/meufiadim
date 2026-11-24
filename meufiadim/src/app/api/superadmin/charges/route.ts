import { NextResponse } from "next/server";
import {
  authenticateSuperAdmin,
  executeCreateCheckout,
} from "@/lib/infinitepay";

export const dynamic = "force-dynamic";

/**
 * GET /api/superadmin/charges
 * Retorna todas as cobranças avulsas, tentativas, eventos de auditoria e métricas do Dashboard Financeiro.
 */
export async function GET(req: Request) {
  try {
    const auth = await authenticateSuperAdmin(req);
    if (!auth) {
      return NextResponse.json(
        { error: "Acesso negado. Apenas o Super Admin pode consultar cobranças." },
        { status: 403 }
      );
    }

    const { supabase } = auth;

    const [chargesRes, attemptsRes, eventsRes, storesRes] = await Promise.all([
      supabase
        .from("merchant_charges")
        .select("*, stores(id, name, slug, whatsapp, status, admin_blocked, financial_blocked, regularized_at)")
        .order("created_at", { ascending: false }),
      supabase
        .from("merchant_charge_attempts")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("infinitepay_webhook_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("stores")
        .select("id, name, slug, whatsapp, status, admin_blocked, financial_blocked, regularized_at"),
    ]);

    if (chargesRes.error) {
      return NextResponse.json(
        {
          error:
            chargesRes.error.message?.includes("merchant_charges")
              ? "Tabela merchant_charges ainda não criada. Execute migration_infinitepay.sql no Supabase."
              : chargesRes.error.message,
        },
        { status: 500 }
      );
    }

    const charges = chargesRes.data || [];
    const attempts = attemptsRes.data || [];
    const events = eventsRes.data || [];
    const stores = storesRes.data || [];

    // Indicadores do Dashboard Financeiro (valores reais em centavos, nunca estimados)
    let totalReceivedCents = 0;
    let totalPaidByBuyersCents = 0;
    let totalFeeCents = 0;
    let totalPendingCents = 0;
    let totalRefundReviewCents = 0;
    let paidCount = 0;
    let canceledCount = 0;
    let pendingCount = 0;

    for (const c of charges) {
      const amount = Number(c.amount || 0);
      if (c.status === "paid") {
        paidCount += 1;
        totalReceivedCents += Number(c.net_amount ?? amount);
        totalPaidByBuyersCents += Number(c.paid_amount ?? amount);
        totalFeeCents += Number(c.fee_amount || 0);
      } else if (c.status === "pending" || c.status === "expired") {
        pendingCount += 1;
        totalPendingCents += amount;
      } else if (c.status === "canceled") {
        canceledCount += 1;
      } else if (c.status === "refunded_review") {
        totalRefundReviewCents += amount;
      }
    }

    const blockedMerchantsCount = stores.filter(
      (s: any) => s.status === "blocked" || s.financial_blocked || s.admin_blocked
    ).length;

    const regularizedMerchantsCount = stores.filter(
      (s: any) => s.status === "active" && Boolean(s.regularized_at)
    ).length;

    return NextResponse.json({
      ok: true,
      charges,
      attempts,
      events,
      metrics: {
        totalReceivedCents,
        totalPaidByBuyersCents,
        totalFeeCents,
        totalPendingCents,
        totalRefundReviewCents,
        totalChargesCount: charges.length,
        paidCount,
        pendingCount,
        canceledCount,
        blockedMerchantsCount,
        regularizedMerchantsCount,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Erro interno ao listar cobranças." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/superadmin/charges
 * Cria uma nova cobrança avulsa para um lojista, bloqueia o acesso imediatamente
 * e opcionalmente já gera o link de checkout InfinitePay.
 */
export async function POST(req: Request) {
  try {
    const auth = await authenticateSuperAdmin(req);
    if (!auth) {
      return NextResponse.json(
        { error: "Acesso negado. Apenas o Super Admin pode criar cobranças." },
        { status: 403 }
      );
    }

    const { user, token, supabase } = auth;
    const body = await req.json();
    const {
      merchantId,
      amountReais,
      amountCents,
      description,
      reason,
      dueDate,
      adminNotes,
      generateCheckout = true,
    } = body;

    if (!merchantId) {
      return NextResponse.json({ error: "Selecione o lojista." }, { status: 400 });
    }

    if (!description || String(description).trim().length < 3) {
      return NextResponse.json(
        { error: "Informe uma descrição válida para a cobrança." },
        { status: 400 }
      );
    }

    const parsedCents = amountCents
      ? Math.round(Number(amountCents))
      : Math.round(Number(String(amountReais || "0").replace(",", ".")) * 100);

    if (!Number.isFinite(parsedCents) || parsedCents < 100) {
      return NextResponse.json(
        { error: "Valor mínimo obrigatório é R$ 1,00 (100 centavos)." },
        { status: 400 }
      );
    }

    // Validar que o lojista existe
    const { data: store, error: storeErr } = await supabase
      .from("stores")
      .select("id, name, whatsapp")
      .eq("id", merchantId)
      .maybeSingle();

    if (storeErr || !store) {
      return NextResponse.json({ error: "Lojista não encontrado." }, { status: 404 });
    }

    const orderNsu = `FIADIM-${merchantId.slice(0, 6).toUpperCase()}-${Date.now()}`;
    const dueIso = dueDate ? new Date(`${dueDate}T23:59:59-03:00`).toISOString() : null;

    // 1. Inserir cobrança em merchant_charges
    const { data: newCharge, error: insertErr } = await supabase
      .from("merchant_charges")
      .insert({
        merchant_id: merchantId,
        created_by: user.id,
        description: String(description).trim(),
        reason: reason ? String(reason).trim() : null,
        admin_notes: adminNotes ? String(adminNotes).trim() : null,
        amount: parsedCents,
        due_date: dueIso,
        status: "pending",
        order_nsu: orderNsu,
      })
      .select("*, stores(id, name, slug, whatsapp, status)")
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // 2. REGRA DE BLOQUEIO AUTOMÁTICO IMEDIATO (sem esperar vencimento)
    await supabase.rpc("reevaluate_merchant_access", {
      p_merchant_id: merchantId,
    });

    // 3. Gerar checkout InfinitePay se solicitado
    let checkoutResult: any = null;
    if (generateCheckout) {
      checkoutResult = await executeCreateCheckout({
        userToken: token,
        chargeId: newCharge.id,
        regenerate: false,
      });
    }

    // Recarregar cobrança com checkout_url atualizado
    const { data: finalCharge } = await supabase
      .from("merchant_charges")
      .select("*, stores(id, name, slug, whatsapp, status, financial_blocked, admin_blocked)")
      .eq("id", newCharge.id)
      .single();

    return NextResponse.json({
      ok: true,
      charge: finalCharge || newCharge,
      checkoutError:
        checkoutResult && !checkoutResult.ok
          ? checkoutResult.data?.error || "Cobrança criada e lojista bloqueado, mas houve erro ao gerar link InfinitePay."
          : null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Erro interno ao criar cobrança." },
      { status: 500 }
    );
  }
}
