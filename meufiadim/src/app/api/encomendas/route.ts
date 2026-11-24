import { NextResponse } from "next/server";
import {
  getSupabaseAdmin,
  resolveEncomendaStatus,
  type Encomenda,
} from "@/lib/encomendas";
import { canMerchantAccessSystem } from "@/lib/infinitepay";

export const dynamic = "force-dynamic";

/**
 * Autentica a requisição via Bearer token e valida se o lojista é dono da loja.
 */
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
 * GET /api/encomendas
 * Retorna as encomendas e KPIs do lojista autenticado.
 */
export async function GET(req: Request) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { user, store, supabase } = auth;
    const url = new URL(req.url);
    const search = (url.searchParams.get("search") || "").trim().toLowerCase();
    const statusFilter = url.searchParams.get("status") || "TODOS";

    // 1. Tenta buscar da tabela oficial public.encomendas
    let encomendas: Encomenda[] = [];
    const { data: dbData, error: dbError } = await supabase
      .from("encomendas")
      .select(`
        *,
        customer:customers(id, name, phone, balance)
      `)
      .eq("store_id", store.id)
      .order("created_at", { ascending: false });

    if (!dbError && dbData) {
      encomendas = dbData as unknown as Encomenda[];
    } else {
      // Fallback gracioso para user_metadata enquanto a tabela estiver sendo criada
      const metaEncomendas: Encomenda[] = user.user_metadata?.encomendas || [];
      const { data: customers } = await supabase
        .from("customers")
        .select("id, name, phone, balance")
        .eq("store_id", store.id);

      const custMap = new Map((customers || []).map((c) => [c.id, c]));
      encomendas = metaEncomendas.map((e) => ({
        ...e,
        customer: custMap.get(e.customer_id) || {
          id: e.customer_id,
          name: "Cliente",
          phone: "",
          balance: 0,
        },
      }));
    }

    // Buscar notificações de cada encomenda para histórico
    const { data: notifData } = await supabase
      .from("encomenda_notifications")
      .select("*")
      .eq("store_id", store.id)
      .order("sent_at", { ascending: false });

    const notifMap = new Map<string, any[]>();
    if (notifData) {
      for (const n of notifData) {
        if (!notifMap.has(n.encomenda_id)) notifMap.set(n.encomenda_id, []);
        notifMap.get(n.encomenda_id)!.push(n);
      }
    }

    // Fallback de notificações se não houver no banco
    const metaNotifs: any[] = user.user_metadata?.encomenda_notifications || [];
    for (const n of metaNotifs) {
      if (!notifMap.has(n.encomenda_id)) notifMap.set(n.encomenda_id, []);
      if (!notifMap.get(n.encomenda_id)!.some((item) => item.id === n.id)) {
        notifMap.get(n.encomenda_id)!.push(n);
      }
    }

    // Calcula status dinâmico e anexa notificações
    const processed = encomendas.map((item) => {
      const dynamicStatus = resolveEncomendaStatus(item.status, item.due_date);
      return {
        ...item,
        status: dynamicStatus,
        notifications: notifMap.get(item.id) || [],
      };
    });

    // Filtros
    let filtered = processed;
    if (search) {
      filtered = filtered.filter(
        (e) =>
          e.customer?.name?.toLowerCase().includes(search) ||
          e.description?.toLowerCase().includes(search)
      );
    }

    if (statusFilter !== "TODOS") {
      filtered = filtered.filter((e) => e.status === statusFilter);
    }

    // Indicadores / KPIs
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

    const totalPendentes = processed.filter(
      (e) => e.status === "PENDENTE" || e.status === "ATRASADA"
    ).length;

    const valorTotalAReceber = processed
      .filter((e) => e.status === "PENDENTE" || e.status === "ATRASADA")
      .reduce((acc, e) => acc + Number(e.total_amount || 0), 0);

    const vencimentoHoje = processed.filter(
      (e) => (e.status === "PENDENTE" || e.status === "ATRASADA") && e.due_date === todayStr
    ).length;

    const atrasadas = processed.filter((e) => e.status === "ATRASADA").length;

    const totalPagas = processed.filter((e) => e.status === "PAGA").length;

    return NextResponse.json({
      encomendas: filtered,
      kpis: {
        totalPendentes,
        valorTotalAReceber,
        vencimentoHoje,
        atrasadas,
        totalPagas,
      },
    });
  } catch (error: any) {
    console.error("Erro ao listar encomendas:", error);
    return NextResponse.json(
      { error: "Erro interno ao buscar encomendas" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/encomendas
 * Cadastra uma nova encomenda e integra automaticamente ao financeiro do cliente.
 */
export async function POST(req: Request) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { user, store, supabase } = auth;
    const accessCheck = await canMerchantAccessSystem(store.id);
    if (!accessCheck.allowed) {
      return NextResponse.json(
        { error: accessCheck.reason || "Acesso operacional bloqueado por pendência financeira." },
        { status: 403 }
      );
    }
    const body = await req.json();

    const {
      customerId,
      description,
      quantity,
      totalAmount,
      deliveryDate,
      dueDate,
      notes,
    } = body;

    // 1. Validações obrigatórias
    if (!customerId) {
      return NextResponse.json(
        { error: "Selecione um cliente para a encomenda." },
        { status: 400 }
      );
    }

    if (!description || !description.trim()) {
      return NextResponse.json(
        { error: "A descrição da encomenda é obrigatória." },
        { status: 400 }
      );
    }

    const amount = Number(totalAmount);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Informe um valor total válido para a encomenda." },
        { status: 400 }
      );
    }

    if (!dueDate || !dueDate.trim()) {
      return NextResponse.json(
        { error: "A data de pagamento/vencimento é obrigatória." },
        { status: 400 }
      );
    }

    // 2. Verificar se o cliente pertence à loja do lojista
    const { data: customer, error: custError } = await supabase
      .from("customers")
      .select("*")
      .eq("id", customerId)
      .eq("store_id", store.id)
      .single();

    if (custError || !customer) {
      return NextResponse.json(
        { error: "Cliente não encontrado ou não pertence a esta loja." },
        { status: 404 }
      );
    }

    // 3. Integração com o financeiro:
    // Atualiza saldo devedor do cliente SEM duplicar dívida
    const nextBalance = Number((customer.balance + amount).toFixed(2));
    const nextDueDate = customer.due_date
      ? dueDate < customer.due_date
        ? dueDate
        : customer.due_date
      : dueDate;

    await supabase
      .from("customers")
      .update({
        balance: nextBalance,
        due_date: nextDueDate,
        notify_date: nextDueDate,
      })
      .eq("id", customer.id);

    // 4. Registro na tabela de vendas com origem Encomenda para comissão
    const commission = Number(
      ((amount * (store.commission_rate || 5)) / 100).toFixed(2)
    );

    const { data: saleData } = await supabase
      .from("sales")
      .insert({
        store_id: store.id,
        customer_id: customer.id,
        total_amount: amount,
        commission_amount: commission,
        payment_method: "Encomenda",
      })
      .select("id")
      .single();

    const saleId = saleData?.id || null;

    // 5. Inserir encomenda
    const newEncomendaData = {
      store_id: store.id,
      customer_id: customer.id,
      sale_id: saleId,
      description: description.trim(),
      quantity: Number(quantity) || 1,
      total_amount: amount,
      delivery_date: deliveryDate ? deliveryDate.trim() : null,
      due_date: dueDate.trim(),
      status: "PENDENTE",
      notes: notes ? notes.trim() : null,
      notification_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let createdEncomenda: any = null;
    const { data: dbEncomenda, error: insertError } = await supabase
      .from("encomendas")
      .insert(newEncomendaData)
      .select("*")
      .single();

    if (!insertError && dbEncomenda) {
      createdEncomenda = dbEncomenda;
    } else {
      // Fallback em user_metadata
      const existing: any[] = user.user_metadata?.encomendas || [];
      const fallbackItem = {
        ...newEncomendaData,
        id: crypto.randomUUID(),
      };
      existing.unshift(fallbackItem);
      await supabase.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...user.user_metadata,
          encomendas: existing,
        },
      });
      createdEncomenda = fallbackItem;
    }

    return NextResponse.json({
      ok: true,
      encomenda: {
        ...createdEncomenda,
        customer: {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          balance: nextBalance,
        },
      },
    });
  } catch (error: any) {
    console.error("Erro ao cadastrar encomenda:", error);
    return NextResponse.json(
      { error: "Erro interno ao cadastrar encomenda" },
      { status: 500 }
    );
  }
}
