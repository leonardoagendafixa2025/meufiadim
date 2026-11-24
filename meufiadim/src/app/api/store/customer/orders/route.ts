import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/encomendas";
import { cleanPhone } from "@/lib/customer-auth";

export const dynamic = "force-dynamic";

/**
 * GET: Retorna o histórico de compras e encomendas do cliente na loja informada.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const storeId = searchParams.get("storeId");
    const customerId = searchParams.get("customerId");
    const phone = searchParams.get("phone");

    if (!storeId || (!customerId && !phone)) {
      return NextResponse.json(
        { error: "Parâmetros obrigatórios ausentes (storeId e customerId/phone)." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // 1. Buscar dados do cliente
    let query = supabase.from("customers").select("*").eq("store_id", storeId);
    if (customerId) {
      query = query.eq("id", customerId);
    } else if (phone) {
      query = query.eq("phone", cleanPhone(phone));
    }

    const { data: customer, error: custErr } = await query.maybeSingle();

    if (custErr || !customer) {
      return NextResponse.json(
        { error: "Cliente não encontrado nesta loja." },
        { status: 404 }
      );
    }

    // 2. Buscar vendas realizadas
    const { data: sales, error: salesErr } = await supabase
      .from("sales")
      .select("*")
      .eq("store_id", storeId)
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false });

    if (salesErr) {
      return NextResponse.json(
        { error: "Erro ao buscar vendas do cliente: " + salesErr.message },
        { status: 500 }
      );
    }

    // 3. Buscar encomendas programadas
    const { data: encomendas, error: encErr } = await supabase
      .from("encomendas")
      .select("*")
      .eq("store_id", storeId)
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false });

    return NextResponse.json({
      success: true,
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        balance: customer.balance || 0,
        credit_limit: customer.credit_limit || 0,
        due_date: customer.due_date,
      },
      sales: sales || [],
      encomendas: encErr ? [] : encomendas || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro interno ao consultar histórico." },
      { status: 500 }
    );
  }
}

/**
 * POST: Registra o pedido/venda na vitrine vinculado ao cliente autenticado.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      storeId,
      customerId,
      totalAmount,
      paymentMethod,
      items,
      description,
      deliveryType,
      freightFee,
      address,
      notes,
    } = body;

    if (!storeId || !customerId || !totalAmount) {
      return NextResponse.json(
        { error: "Dados incompletos para registrar o pedido." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // 1. Validar loja e status de abertura
    const { data: store, error: storeErr } = await supabase
      .from("stores")
      .select("id, name, commission_rate, is_open, status")
      .eq("id", storeId)
      .maybeSingle();

    if (storeErr || !store) {
      return NextResponse.json({ error: "Loja não encontrada." }, { status: 404 });
    }

    if (store.status === "blocked") {
      return NextResponse.json(
        { error: "Esta loja está temporariamente indisponível." },
        { status: 403 }
      );
    }

    if (store.is_open === false) {
      return NextResponse.json(
        { error: "A loja está fechada no momento e não está aceitando novos pedidos." },
        { status: 400 }
      );
    }

    // 2. Validar cliente
    const { data: customer, error: custErr } = await supabase
      .from("customers")
      .select("id, name, phone, balance, credit_limit")
      .eq("id", customerId)
      .eq("store_id", storeId)
      .maybeSingle();

    if (custErr || !customer) {
      return NextResponse.json(
        { error: "Cliente não autenticado ou não encontrado para esta loja." },
        { status: 401 }
      );
    }

    const parsedTotal = Number(Number(totalAmount).toFixed(2));
    const commissionRate = Number(store.commission_rate || 5.0);
    const commissionAmount = Number(((parsedTotal * commissionRate) / 100).toFixed(2));

    // Montar descrição legível caso não venha pronta
    let formattedDescription = description || "";
    if (!formattedDescription && Array.isArray(items)) {
      formattedDescription = items
        .map((i: any) => `${i.qty}x ${i.name || i.product?.name || "Item"}`)
        .join(" • ");
    }

    // 3. Inserir a venda
    // Tentamos com description e items; se as colunas ainda não existirem no Supabase, fazemos fallback transparente
    let saleRecord: any = null;
    const insertPayloadWithCols: any = {
      store_id: storeId,
      customer_id: customer.id,
      total_amount: parsedTotal,
      commission_amount: commissionAmount,
      payment_method: paymentMethod || "Pix",
      description: formattedDescription,
      items: items || null,
    };

    const { data: saleData, error: saleErr } = await supabase
      .from("sales")
      .insert(insertPayloadWithCols)
      .select()
      .single();

    if (saleErr) {
      // Fallback sem colunas novas caso a migration ainda esteja sendo executada
      if (saleErr.message?.includes("column") || saleErr.code === "42703") {
        const { data: fallbackSale, error: fallbackErr } = await supabase
          .from("sales")
          .insert({
            store_id: storeId,
            customer_id: customer.id,
            total_amount: parsedTotal,
            commission_amount: commissionAmount,
            payment_method: paymentMethod || "Pix",
          })
          .select()
          .single();

        if (fallbackErr) {
          return NextResponse.json(
            { error: "Erro ao registrar venda: " + fallbackErr.message },
            { status: 500 }
          );
        }
        saleRecord = fallbackSale;
      } else {
        return NextResponse.json(
          { error: "Erro ao registrar venda: " + saleErr.message },
          { status: 500 }
        );
      }
    } else {
      saleRecord = saleData;
    }

    // 4. Se a forma de pagamento for FIADO, somar ao saldo devedor do cliente
    if (paymentMethod === "Fiado") {
      const currentBalance = Number(customer.balance || 0);
      const newBalance = Number((currentBalance + parsedTotal).toFixed(2));

      await supabase
        .from("customers")
        .update({
          balance: newBalance,
        })
        .eq("id", customer.id);
    }

    return NextResponse.json({
      success: true,
      message: "Pedido registrado com sucesso!",
      sale: saleRecord,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro interno ao processar pedido." },
      { status: 500 }
    );
  }
}
