import { NextResponse } from "next/server";
import { getSupabaseAdmin, type Encomenda } from "@/lib/encomendas";

export const dynamic = "force-dynamic";

async function authenticateRequest(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  const supabase = getSupabaseAdmin();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  const { data: store } = await supabase
    .from("stores")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!store) return null;
  return { user, store, supabase };
}

/**
 * POST /api/encomendas/[id]/baixa
 * Registra o pagamento da encomenda, quita o débito no financeiro do cliente
 * e encerra futuras cobranças automáticas.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const { user, store, supabase } = auth;

    // 1. Localizar a encomenda
    let encomenda: Encomenda | null = null;
    const { data: dbData } = await supabase
      .from("encomendas")
      .select("*")
      .eq("id", id)
      .eq("store_id", store.id)
      .maybeSingle();

    if (dbData) {
      encomenda = dbData as unknown as Encomenda;
    } else {
      const metaEncomendas: Encomenda[] = user.user_metadata?.encomendas || [];
      encomenda = metaEncomendas.find((e) => e.id === id) || null;
    }

    if (!encomenda) {
      return NextResponse.json(
        { error: "Encomenda não encontrada" },
        { status: 404 }
      );
    }

    if (encomenda.status === "PAGA") {
      return NextResponse.json(
        { error: "Esta encomenda já foi paga anteriormente." },
        { status: 400 }
      );
    }

    if (encomenda.status === "CANCELADA") {
      return NextResponse.json(
        { error: "Esta encomenda está cancelada e não pode receber baixa." },
        { status: 400 }
      );
    }

    // 2. Dar baixa no saldo devedor do cliente
    const { data: customer } = await supabase
      .from("customers")
      .select("*")
      .eq("id", encomenda.customer_id)
      .single();

    if (customer) {
      const nextBalance = Math.max(
        0,
        Number((customer.balance - encomenda.total_amount).toFixed(2))
      );
      await supabase
        .from("customers")
        .update({
          balance: nextBalance,
          due_date: nextBalance === 0 ? null : customer.due_date,
          notify_date: nextBalance === 0 ? null : customer.notify_date,
        })
        .eq("id", customer.id);
    }

    // 3. Atualizar status da encomenda para PAGA
    const nowIso = new Date().toISOString();
    const updatePayload = {
      status: "PAGA" as const,
      paid_at: nowIso,
      updated_at: nowIso,
    };

    if (dbData) {
      await supabase
        .from("encomendas")
        .update(updatePayload)
        .eq("id", id);
    } else {
      const metaEncomendas: Encomenda[] = user.user_metadata?.encomendas || [];
      const updatedList = metaEncomendas.map((e) =>
        e.id === id ? { ...e, ...updatePayload } : e
      );
      await supabase.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...user.user_metadata,
          encomendas: updatedList,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      message: "Pagamento registrado com sucesso!",
      encomenda: {
        ...encomenda,
        ...updatePayload,
      },
    });
  } catch (error: any) {
    console.error("Erro ao registrar baixa da encomenda:", error);
    return NextResponse.json(
      { error: "Erro interno ao processar baixa de pagamento" },
      { status: 500 }
    );
  }
}
