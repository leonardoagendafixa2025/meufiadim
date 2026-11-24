import { NextResponse } from "next/server";
import {
  getSupabaseAdmin,
  resolveEncomendaStatus,
  type Encomenda,
} from "@/lib/encomendas";

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
 * GET /api/encomendas/[id]
 * Detalhes completos da encomenda.
 */
export async function GET(
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

    let encomenda: Encomenda | null = null;
    const { data: dbData } = await supabase
      .from("encomendas")
      .select(`
        *,
        customer:customers(id, name, phone, balance)
      `)
      .eq("id", id)
      .eq("store_id", store.id)
      .maybeSingle();

    if (dbData) {
      encomenda = dbData as unknown as Encomenda;
    } else {
      const metaEncomendas: Encomenda[] = user.user_metadata?.encomendas || [];
      const found = metaEncomendas.find((e) => e.id === id);
      if (found) {
        const { data: customer } = await supabase
          .from("customers")
          .select("id, name, phone, balance")
          .eq("id", found.customer_id)
          .maybeSingle();

        encomenda = {
          ...found,
          customer: customer || {
            id: found.customer_id,
            name: "Cliente",
            phone: "",
            balance: 0,
          },
        };
      }
    }

    if (!encomenda) {
      return NextResponse.json(
        { error: "Encomenda não encontrada" },
        { status: 404 }
      );
    }

    // Buscar histórico de notificações
    let notifications: any[] = [];
    const { data: dbNotifs } = await supabase
      .from("encomenda_notifications")
      .select("*")
      .eq("encomenda_id", id)
      .order("sent_at", { ascending: false });

    if (dbNotifs && dbNotifs.length > 0) {
      notifications = dbNotifs;
    } else {
      const metaNotifs: any[] = user.user_metadata?.encomenda_notifications || [];
      notifications = metaNotifs.filter((n) => n.encomenda_id === id);
    }

    const dynamicStatus = resolveEncomendaStatus(
      encomenda.status,
      encomenda.due_date
    );

    return NextResponse.json({
      encomenda: {
        ...encomenda,
        status: dynamicStatus,
        notifications,
      },
    });
  } catch (error: any) {
    console.error("Erro ao buscar encomenda:", error);
    return NextResponse.json(
      { error: "Erro interno ao buscar encomenda" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/encomendas/[id]
 * Edita campos da encomenda e sincroniza o saldo se o valor for alterado.
 */
export async function PATCH(
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
    const body = await req.json();

    const {
      description,
      quantity,
      totalAmount,
      deliveryDate,
      dueDate,
      notes,
    } = body;

    // Buscar encomenda atual
    let current: Encomenda | null = null;
    const { data: dbData } = await supabase
      .from("encomendas")
      .select("*")
      .eq("id", id)
      .eq("store_id", store.id)
      .maybeSingle();

    if (dbData) {
      current = dbData as unknown as Encomenda;
    } else {
      const metaEncomendas: Encomenda[] = user.user_metadata?.encomendas || [];
      current = metaEncomendas.find((e) => e.id === id) || null;
    }

    if (!current) {
      return NextResponse.json(
        { error: "Encomenda não encontrada" },
        { status: 404 }
      );
    }

    if (current.status === "PAGA") {
      return NextResponse.json(
        { error: "Não é possível alterar uma encomenda já paga." },
        { status: 400 }
      );
    }

    if (current.status === "CANCELADA") {
      return NextResponse.json(
        { error: "Não é possível alterar uma encomenda cancelada." },
        { status: 400 }
      );
    }

    // Se o valor foi alterado, ajustar saldo no financeiro do cliente
    let newAmount = current.total_amount;
    if (totalAmount !== undefined) {
      const parsedAmount = Number(totalAmount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return NextResponse.json(
          { error: "Valor total inválido." },
          { status: 400 }
        );
      }
      newAmount = parsedAmount;

      const diff = Number((newAmount - current.total_amount).toFixed(2));
      if (diff !== 0) {
        const { data: customer } = await supabase
          .from("customers")
          .select("balance")
          .eq("id", current.customer_id)
          .single();

        if (customer) {
          const nextBalance = Math.max(
            0,
            Number((customer.balance + diff).toFixed(2))
          );
          await supabase
            .from("customers")
            .update({ balance: nextBalance })
            .eq("id", current.customer_id);
        }

        // Atualizar venda vinculada
        if (current.sale_id) {
          const commission = Number(
            ((newAmount * (store.commission_rate || 5)) / 100).toFixed(2)
          );
          await supabase
            .from("sales")
            .update({
              total_amount: newAmount,
              commission_amount: commission,
            })
            .eq("id", current.sale_id);
        }
      }
    }

    // Atualização de campos
    const updatePayload: Partial<Encomenda> = {
      description: description ? description.trim() : current.description,
      quantity: quantity ? Number(quantity) : current.quantity,
      total_amount: newAmount,
      delivery_date:
        deliveryDate !== undefined
          ? deliveryDate
            ? deliveryDate.trim()
            : null
          : current.delivery_date,
      due_date: dueDate ? dueDate.trim() : current.due_date,
      notes: notes !== undefined ? (notes ? notes.trim() : null) : current.notes,
      updated_at: new Date().toISOString(),
    };

    // Salva no banco ou fallback
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
      encomenda: { ...current, ...updatePayload },
    });
  } catch (error: any) {
    console.error("Erro ao atualizar encomenda:", error);
    return NextResponse.json(
      { error: "Erro interno ao atualizar encomenda" },
      { status: 500 }
    );
  }
}
