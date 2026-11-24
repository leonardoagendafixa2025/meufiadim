import { NextResponse } from "next/server";
import {
  authenticateMerchant,
  canMerchantAccessSystem,
  executeCheckPayment,
  executeCreateCheckout,
} from "@/lib/infinitepay";

export const dynamic = "force-dynamic";

/**
 * GET /api/merchant/charges
 * Retorna somente as cobranças do lojista autenticado + estado de bloqueio centralizado.
 */
export async function GET(req: Request) {
  try {
    const auth = await authenticateMerchant(req);
    if (!auth) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { store, supabase } = auth;

    const [chargesRes, access] = await Promise.all([
      supabase
        .from("merchant_charges")
        .select("id, merchant_id, description, reason, amount, due_date, status, order_nsu, invoice_slug, transaction_nsu, checkout_url, payment_method, installments, paid_amount, receipt_url, expires_at, paid_at, canceled_at, created_at")
        .eq("merchant_id", store.id)
        .order("created_at", { ascending: false }),
      canMerchantAccessSystem(store.id),
    ]);

    if (chargesRes.error) {
      // Se a tabela ainda não foi migrada, não quebra o painel existente
      return NextResponse.json({
        ok: true,
        charges: [],
        access: {
          allowed: store.status !== "blocked",
          reason: null,
          pending_charges_count: 0,
          financial_blocked: false,
          admin_blocked: store.status === "blocked",
        },
      });
    }

    return NextResponse.json({
      ok: true,
      charges: chargesRes.data || [],
      access,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Erro ao buscar cobranças" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/merchant/charges
 * Permite ao lojista apenas:
 * - Solicitar/recuperar checkout_url de uma cobrança pendente SUA (`action: "pay"`)
 * - Consultar pagamento na InfinitePay (`action: "check"`)
 * Nunca permite criar cobranças, editar valores ou marcar como pago diretamente.
 */
export async function POST(req: Request) {
  try {
    const auth = await authenticateMerchant(req);
    if (!auth) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { store, token, supabase } = auth;
    const body = await req.json();
    const { action, chargeId, orderNsu, slug, transactionNsu } = body;

    if (action === "pay") {
      if (!chargeId) {
        return NextResponse.json({ error: "chargeId é obrigatório" }, { status: 400 });
      }

      // Validação estrita de propriedade contra IDOR
      const { data: charge } = await supabase
        .from("merchant_charges")
        .select("id, merchant_id, status")
        .eq("id", chargeId)
        .eq("merchant_id", store.id)
        .maybeSingle();

      if (!charge) {
        return NextResponse.json(
          { error: "Cobrança não encontrada para esta loja." },
          { status: 404 }
        );
      }

      if (charge.status !== "pending" && charge.status !== "expired") {
        return NextResponse.json(
          { error: "Esta cobrança não está disponível para pagamento." },
          { status: 400 }
        );
      }

      const res = await executeCreateCheckout({
        userToken: token,
        chargeId: charge.id,
        regenerate: false,
      });

      return NextResponse.json(res.data, { status: res.status || 200 });
    }

    if (action === "check") {
      // Validação estrita de propriedade
      let query = supabase
        .from("merchant_charges")
        .select("id, merchant_id")
        .eq("merchant_id", store.id);

      if (chargeId) {
        query = query.eq("id", chargeId);
      } else if (orderNsu) {
        query = query.eq("order_nsu", orderNsu);
      } else {
        return NextResponse.json({ error: "Informe chargeId ou orderNsu" }, { status: 400 });
      }

      const { data: charge } = await query.maybeSingle();
      if (!charge) {
        return NextResponse.json(
          { error: "Cobrança não encontrada para esta loja." },
          { status: 404 }
        );
      }

      const res = await executeCheckPayment({
        userToken: token,
        chargeId: charge.id,
        orderNsu,
        slug,
        transactionNsu,
      });

      const access = await canMerchantAccessSystem(store.id);
      return NextResponse.json({ ...res.data, access }, { status: res.status || 200 });
    }

    return NextResponse.json({ error: "Ação não permitida" }, { status: 403 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Erro interno" },
      { status: 500 }
    );
  }
}
