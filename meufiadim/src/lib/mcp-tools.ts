import {
  getSupabaseAdmin,
  resolveEncomendaStatus,
  getSaoPauloDateString,
  buildEncomendaWhatsAppMessage,
} from "@/lib/encomendas";
import { canMerchantAccessSystem } from "@/lib/infinitepay";
import { cleanPhone, formatPhoneBR } from "@/lib/customer-auth";
import { formatBRL, getZapApiUrl, getZapApiKey } from "@/lib/whatsapp";
import {
  fetchViaCep,
  calculateDeliveryFee,
  cleanCep,
  formatCep,
} from "@/lib/viacep";

export type MCPUserRole = "merchant" | "customer";

export interface MCPToolContext {
  role: MCPUserRole;
  storeId: string;
  customerId?: string | null;
  userId?: string | null;
}

export interface MCPToolDefinition {
  name: string;
  description: string;
  roles: MCPUserRole[];
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
  execute: (args: Record<string, any>, ctx: MCPToolContext) => Promise<any>;
}

async function getStoreWithOwnerMetadata(storeId: string) {
  const supabase = getSupabaseAdmin();
  const { data: store, error } = await supabase
    .from("stores")
    .select("*")
    .eq("id", storeId)
    .maybeSingle();

  if (error || !store) return null;

  let meta: Record<string, any> = {};
  if (store.owner_id) {
    const { data: ownerRes } = await supabase.auth.admin.getUserById(store.owner_id);
    meta = ownerRes?.user?.user_metadata || {};
  }

  return { store, meta };
}

export const MCP_TOOLS: MCPToolDefinition[] = [
  // ============================================================================
  // FERRAMENTAS DO COPILOTO DO LOJISTA (role: "merchant")
  // ============================================================================
  {
    name: "get_store_summary",
    description:
      "Retorna o resumo financeiro e operacional da loja: total a receber no fiado, volume de vendas, total de clientes, produtos, encomendas pendentes e atrasadas.",
    roles: ["merchant"],
    inputSchema: {
      type: "object",
      properties: {},
    },
    execute: async (_args, ctx) => {
      const supabase = getSupabaseAdmin();
      const [storeRes, custRes, prodRes, salesRes, encRes] = await Promise.all([
        supabase.from("stores").select("id, name, slug, status, commission_rate").eq("id", ctx.storeId).single(),
        supabase.from("customers").select("id, balance, due_date").eq("store_id", ctx.storeId),
        supabase.from("products").select("id, stock").eq("store_id", ctx.storeId),
        supabase.from("sales").select("id, total_amount, created_at").eq("store_id", ctx.storeId),
        supabase.from("encomendas").select("id, total_amount, due_date, status").eq("store_id", ctx.storeId),
      ]);

      const customers = custRes.data || [];
      const sales = salesRes.data || [];
      const products = prodRes.data || [];
      const encomendas = (encRes.data || []).map((e) => ({
        ...e,
        resolvedStatus: resolveEncomendaStatus(e.status, e.due_date),
      }));

      const today = getSaoPauloDateString();
      const totalReceivableFiado = customers.reduce((acc, c) => acc + Number(c.balance || 0), 0);
      const debtorsCount = customers.filter((c) => Number(c.balance || 0) > 0).length;
      const lateDebtorsCount = customers.filter(
        (c) => Number(c.balance || 0) > 0 && c.due_date && c.due_date < today
      ).length;
      const totalSalesAmount = sales.reduce((acc, s) => acc + Number(s.total_amount || 0), 0);
      const pendingEnc = encomendas.filter(
        (e) => e.resolvedStatus === "PENDENTE" || e.resolvedStatus === "ATRASADA"
      );
      const lateEnc = encomendas.filter((e) => e.resolvedStatus === "ATRASADA");

      return {
        storeName: storeRes.data?.name,
        storeStatus: storeRes.data?.status,
        totalCustomers: customers.length,
        debtorsCount,
        lateDebtorsCount,
        totalReceivableFiado: Number(totalReceivableFiado.toFixed(2)),
        totalReceivableFiadoFormatted: formatBRL(totalReceivableFiado),
        totalSalesCount: sales.length,
        totalSalesAmount: Number(totalSalesAmount.toFixed(2)),
        totalSalesAmountFormatted: formatBRL(totalSalesAmount),
        totalProducts: products.length,
        pendingEncomendasCount: pendingEnc.length,
        lateEncomendasCount: lateEnc.length,
        pendingEncomendasAmountFormatted: formatBRL(
          pendingEnc.reduce((acc, e) => acc + Number(e.total_amount || 0), 0)
        ),
      };
    },
  },
  {
    name: "list_debtor_customers",
    description:
      "Lista os clientes com saldo devedor no fiado (balance > 0), ordenados do maior valor para o menor, com opção de filtrar apenas os vencidos/atrasados ou buscar por nome.",
    roles: ["merchant"],
    inputSchema: {
      type: "object",
      properties: {
        onlyLate: {
          type: "boolean",
          description: "Se true, retorna apenas clientes cuja data de vencimento já passou.",
        },
        search: {
          type: "string",
          description: "Nome ou telefone parcial para filtrar.",
        },
      },
    },
    execute: async (args, ctx) => {
      const supabase = getSupabaseAdmin();
      const today = getSaoPauloDateString();
      const { data: customers } = await supabase
        .from("customers")
        .select("id, name, phone, balance, credit_limit, due_date, last_notified_at")
        .eq("store_id", ctx.storeId)
        .gt("balance", 0)
        .order("balance", { ascending: false });

      let list = (customers || []).map((c) => ({
        ...c,
        balanceFormatted: formatBRL(c.balance),
        phoneFormatted: formatPhoneBR(c.phone),
        isLate: Boolean(c.due_date && c.due_date < today),
      }));

      if (args.onlyLate) {
        list = list.filter((c) => c.isLate);
      }

      if (args.search && String(args.search).trim()) {
        const q = String(args.search).toLowerCase().trim();
        list = list.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.phone || "").includes(cleanPhone(q))
        );
      }

      return {
        today,
        count: list.length,
        totalBalanceFormatted: formatBRL(
          list.reduce((acc, c) => acc + Number(c.balance || 0), 0)
        ),
        customers: list.slice(0, 20),
      };
    },
  },
  {
    name: "get_customer_details",
    description:
      "Busca os detalhes completos de um cliente pelo nome ou telefone (saldo, limite, vencimento, últimas compras e encomendas).",
    roles: ["merchant"],
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Nome ou número de celular do cliente.",
        },
      },
      required: ["query"],
    },
    execute: async (args, ctx) => {
      const supabase = getSupabaseAdmin();
      const q = String(args.query || "").trim();
      const digits = cleanPhone(q);

      const { data: customers } = await supabase
        .from("customers")
        .select("*")
        .eq("store_id", ctx.storeId);

      const matched = (customers || []).filter(
        (c) =>
          c.name.toLowerCase().includes(q.toLowerCase()) ||
          (digits.length >= 4 && (c.phone || "").includes(digits))
      );

      if (matched.length === 0) {
        return { found: false, message: `Nenhum cliente encontrado para "${q}".` };
      }

      const target = matched[0];
      const [salesRes, encRes] = await Promise.all([
        supabase
          .from("sales")
          .select("id, total_amount, payment_method, description, created_at")
          .eq("store_id", ctx.storeId)
          .eq("customer_id", target.id)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("encomendas")
          .select("id, description, quantity, total_amount, due_date, delivery_date, status")
          .eq("store_id", ctx.storeId)
          .eq("customer_id", target.id)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      return {
        found: true,
        otherMatchesCount: matched.length - 1,
        customer: {
          id: target.id,
          name: target.name,
          phone: target.phone,
          phoneFormatted: formatPhoneBR(target.phone),
          balance: Number(target.balance || 0),
          balanceFormatted: formatBRL(target.balance),
          credit_limit: Number(target.credit_limit || 0),
          due_date: target.due_date,
        },
        recentSales: salesRes.data || [],
        recentEncomendas: encRes.data || [],
      };
    },
  },
  {
    name: "create_encomenda",
    description:
      "Cadastra uma nova encomenda com pagamento programado para um cliente existente da loja e integra o valor ao saldo financeiro do cliente.",
    roles: ["merchant"],
    inputSchema: {
      type: "object",
      properties: {
        customerQuery: {
          type: "string",
          description: "Nome ou ID do cliente já cadastrado na loja.",
        },
        description: {
          type: "string",
          description: "Descrição dos produtos/serviços encomendados (ex: 20 marmitas tradicionais).",
        },
        quantity: {
          type: "number",
          description: "Quantidade de itens (padrão 1).",
        },
        totalAmount: {
          type: "number",
          description: "Valor total em reais (ex: 300.00).",
        },
        dueDate: {
          type: "string",
          description: "Data combinada de pagamento no formato YYYY-MM-DD.",
        },
        deliveryDate: {
          type: "string",
          description: "Data prevista de entrega opcional no formato YYYY-MM-DD.",
        },
      },
      required: ["customerQuery", "description", "totalAmount", "dueDate"],
    },
    execute: async (args, ctx) => {
      const access = await canMerchantAccessSystem(ctx.storeId);
      if (!access.allowed) {
        return { error: access.reason || "Loja bloqueada operacionalmente." };
      }

      const supabase = getSupabaseAdmin();
      const { data: store } = await supabase
        .from("stores")
        .select("id, name, commission_rate")
        .eq("id", ctx.storeId)
        .single();

      if (!store) return { error: "Loja não encontrada." };

      const q = String(args.customerQuery || "").trim();
      const { data: customers } = await supabase
        .from("customers")
        .select("*")
        .eq("store_id", ctx.storeId);

      const customer = (customers || []).find(
        (c) =>
          c.id === q ||
          c.name.toLowerCase().includes(q.toLowerCase()) ||
          (cleanPhone(q).length >= 6 && c.phone.includes(cleanPhone(q)))
      );

      if (!customer) {
        return { error: `Cliente "${q}" não encontrado no cadastro da loja.` };
      }

      const amount = Number(args.totalAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return { error: "Valor total inválido." };
      }

      const dueDate = String(args.dueDate).trim();
      const nextBalance = Number((Number(customer.balance || 0) + amount).toFixed(2));
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

      const commission = Number(((amount * (store.commission_rate || 5)) / 100).toFixed(2));
      const { data: saleData } = await supabase
        .from("sales")
        .insert({
          store_id: store.id,
          customer_id: customer.id,
          total_amount: amount,
          commission_amount: commission,
          payment_method: "Encomenda",
          description: `${Number(args.quantity) || 1}x ${String(args.description).trim()}`,
        })
        .select("id")
        .single();

      const { data: created, error: encErr } = await supabase
        .from("encomendas")
        .insert({
          store_id: store.id,
          customer_id: customer.id,
          sale_id: saleData?.id || null,
          description: String(args.description).trim(),
          quantity: Number(args.quantity) || 1,
          total_amount: amount,
          delivery_date: args.deliveryDate ? String(args.deliveryDate).trim() : null,
          due_date: dueDate,
          status: "PENDENTE",
          notes: "Registrada via Copiloto IA",
          notification_count: 0,
        })
        .select("*")
        .single();

      if (encErr) return { error: encErr.message };

      return {
        ok: true,
        message: `Encomenda registrada para ${customer.name} no valor de ${formatBRL(amount)} com vencimento em ${dueDate}.`,
        encomenda: created,
        newCustomerBalanceFormatted: formatBRL(nextBalance),
      };
    },
  },
  {
    name: "send_whatsapp_charge",
    description:
      "Dispara uma cobrança automática no WhatsApp (com Pix Copia e Cola se a loja tiver chave Pix) para um cliente com saldo devedor no fiado.",
    roles: ["merchant"],
    inputSchema: {
      type: "object",
      properties: {
        customerQuery: {
          type: "string",
          description: "Nome, ID ou telefone do cliente que receberá a cobrança.",
        },
      },
      required: ["customerQuery"],
    },
    execute: async (args, ctx) => {
      const access = await canMerchantAccessSystem(ctx.storeId);
      if (!access.allowed) {
        return { error: access.reason || "Loja bloqueada operacionalmente." };
      }

      const supabase = getSupabaseAdmin();
      const { data: store } = await supabase
        .from("stores")
        .select("*")
        .eq("id", ctx.storeId)
        .single();

      if (!store) return { error: "Loja não encontrada." };

      const q = String(args.customerQuery || "").trim();
      const { data: customers } = await supabase
        .from("customers")
        .select("*")
        .eq("store_id", ctx.storeId)
        .gt("balance", 0);

      const customer = (customers || []).find(
        (c) =>
          c.id === q ||
          c.name.toLowerCase().includes(q.toLowerCase()) ||
          (cleanPhone(q).length >= 6 && c.phone.includes(cleanPhone(q)))
      );

      if (!customer) {
        return { error: `Nenhum cliente com débito encontrado para "${q}".` };
      }

      const formattedDate = customer.due_date
        ? new Date(`${customer.due_date}T12:00:00`).toLocaleDateString("pt-BR")
        : null;

      const lines = [
        `Olá, ${customer.name}! Tudo bem?`,
        `Passando para lembrar do seu fiado em aberto na *${store.name}*:`,
        ``,
        `💰 *Valor em aberto:* ${formatBRL(customer.balance)}`,
      ];
      if (formattedDate) lines.push(`📅 *Data final de pagamento:* ${formattedDate}`);
      lines.push(
        ``,
        store.pix_key
          ? `Para pagar agora, toque em *"Copiar código Pix"* na mensagem abaixo 👇`
          : `Quando puder fazer o acerto, é só responder por aqui. Obrigado!`
      );

      const res = await fetch(`${getZapApiUrl()}/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": getZapApiKey(),
        },
        body: JSON.stringify({
          phone: customer.phone,
          text: lines.join("\n"),
          pix: store.pix_key
            ? {
                pixKey: store.pix_key,
                merchantName: store.name || "MEUFIADIM",
                merchantCity: store.pix_city || "BRASIL",
                amount: Number(customer.balance),
              }
            : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { error: data.error || "Erro ao enviar cobrança pelo robô WhatsApp." };
      }

      return {
        ok: true,
        message: `Cobrança de ${formatBRL(customer.balance)} enviada com sucesso para ${customer.name} (${formatPhoneBR(customer.phone)})!`,
      };
    },
  },

  // ============================================================================
  // FERRAMENTAS DO VENDEDOR IA & ATENDIMENTO (roles: "customer" e "merchant")
  // ============================================================================
  {
    name: "search_catalog",
    description:
      "Consulta os produtos disponíveis no cardápio/catálogo da loja com preços, descrições, categorias e estoque.",
    roles: ["customer", "merchant"],
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Palavra-chave do produto ou categoria (opcional). Se vazio, lista principais produtos.",
        },
      },
    },
    execute: async (args, ctx) => {
      const supabase = getSupabaseAdmin();
      const { data: products } = await supabase
        .from("products")
        .select("id, name, description, price, category, stock")
        .eq("store_id", ctx.storeId)
        .order("created_at", { ascending: false });

      let list = products || [];
      if (args.query && String(args.query).trim()) {
        const q = String(args.query).toLowerCase().trim();
        list = list.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.description || "").toLowerCase().includes(q) ||
            (p.category || "").toLowerCase().includes(q)
        );
      }

      return {
        count: list.length,
        products: list.slice(0, 25).map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category || "Geral",
          description: p.description || "",
          price: Number(p.price),
          priceFormatted: formatBRL(p.price),
          stock: p.stock,
        })),
      };
    },
  },
  {
    name: "get_store_delivery_info",
    description:
      "Informa se a loja está aberta agora, tempo estimado de entrega, pedido mínimo, bairros atendidos e taxas.",
    roles: ["customer", "merchant"],
    inputSchema: {
      type: "object",
      properties: {},
    },
    execute: async (_args, ctx) => {
      const info = await getStoreWithOwnerMetadata(ctx.storeId);
      if (!info) return { error: "Loja não encontrada." };

      const { store, meta } = info;
      const isOpen =
        store.status !== "blocked" &&
        (meta.is_open !== undefined ? Boolean(meta.is_open) : store.is_open !== false);

      const neighborhoods = (meta.delivery_neighborhoods || []).filter((n: any) => n.active);
      const cepRanges = (meta.delivery_cep_ranges || []).filter((r: any) => r.active);

      return {
        storeName: store.name,
        slug: store.slug,
        isOpen,
        statusMessage: isOpen ? "Aberta agora para pedidos" : "Fechada no momento",
        deliveryTime: meta.delivery_time || "30min",
        minOrder: meta.min_order !== undefined ? Number(meta.min_order) : 25,
        minOrderFormatted: formatBRL(
          meta.min_order !== undefined ? Number(meta.min_order) : 25
        ),
        neighborhoods: neighborhoods.map((n: any) => ({
          name: n.name,
          feeFormatted: formatBRL(n.fee),
          estimate: n.estimate || "30-50 min",
        })),
        cepRangesCount: cepRanges.length,
        paymentMethods: ["Fiado", "Pix", "Cartão", "Dinheiro"],
      };
    },
  },
  {
    name: "calculate_freight_by_cep",
    description:
      "Calcula o valor do frete e prazo de entrega para um CEP brasileiro de 8 dígitos usando ViaCEP e as regras cadastradas pela loja.",
    roles: ["customer"],
    inputSchema: {
      type: "object",
      properties: {
        cep: {
          type: "string",
          description: "CEP de entrega (ex: 30130-000 ou 30130000).",
        },
      },
      required: ["cep"],
    },
    execute: async (args, ctx) => {
      const digits = cleanCep(String(args.cep || ""));
      if (digits.length !== 8) {
        return { ok: false, error: "CEP inválido. Informe 8 números." };
      }

      const info = await getStoreWithOwnerMetadata(ctx.storeId);
      if (!info) return { ok: false, error: "Loja não encontrada." };

      const viaCep = await fetchViaCep(digits);
      if (!viaCep) {
        return { ok: false, error: "CEP não encontrado nos Correios/ViaCEP." };
      }

      const result = calculateDeliveryFee({
        neighborhoodName: viaCep.bairro,
        cep: digits,
        neighborhoods: info.meta.delivery_neighborhoods || [],
        cepRanges: info.meta.delivery_cep_ranges || [],
      });

      return {
        ok: true,
        cep: formatCep(digits),
        street: viaCep.logradouro || "",
        neighborhood: viaCep.bairro || "",
        city: `${viaCep.localidade || ""}/${viaCep.uf || ""}`,
        delivered: result.found,
        fee: result.fee,
        feeFormatted: formatBRL(result.fee),
        estimate: result.estimate || info.meta.delivery_time || "30-50 min",
        message: result.found
          ? `Entregamos em ${viaCep.bairro || viaCep.localidade}! Frete: ${formatBRL(result.fee)} (${result.estimate || "30-50 min"}).`
          : result.message || "Ainda não atendemos este CEP para entrega, mas você pode retirar na loja!",
      };
    },
  },
  {
    name: "get_my_customer_orders",
    description:
      "Consulta o histórico de compras, encomendas e saldo no fiado do cliente autenticado na loja.",
    roles: ["customer"],
    inputSchema: {
      type: "object",
      properties: {},
    },
    execute: async (_args, ctx) => {
      if (!ctx.customerId) {
        return {
          authenticated: false,
          message:
            "O cliente precisa estar logado com celular e senha para consultar o histórico de compras e saldo.",
        };
      }

      const supabase = getSupabaseAdmin();
      const [custRes, salesRes, encRes] = await Promise.all([
        supabase
          .from("customers")
          .select("id, name, phone, balance, credit_limit")
          .eq("id", ctx.customerId)
          .eq("store_id", ctx.storeId)
          .maybeSingle(),
        supabase
          .from("sales")
          .select("id, total_amount, payment_method, description, created_at")
          .eq("store_id", ctx.storeId)
          .eq("customer_id", ctx.customerId)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("encomendas")
          .select("id, description, quantity, total_amount, due_date, status")
          .eq("store_id", ctx.storeId)
          .eq("customer_id", ctx.customerId)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      if (!custRes.data) {
        return { authenticated: false, message: "Cliente não localizado nesta loja." };
      }

      return {
        authenticated: true,
        customerName: custRes.data.name,
        fiadoBalanceFormatted: formatBRL(custRes.data.balance || 0),
        recentOrders: (salesRes.data || []).map((s) => ({
          ...s,
          totalFormatted: formatBRL(s.total_amount),
        })),
        encomendas: encRes.data || [],
      };
    },
  },
  {
    name: "add_to_cart_suggestion",
    description:
      "Adiciona um produto específico da loja diretamente na sacola de compras do cliente na vitrine online.",
    roles: ["customer"],
    inputSchema: {
      type: "object",
      properties: {
        productId: {
          type: "string",
          description: "ID exato do produto (obtido via search_catalog).",
        },
        productName: {
          type: "string",
          description: "Nome do produto (fallback caso o ID não seja informado).",
        },
        quantity: {
          type: "number",
          description: "Quantidade para adicionar (padrão 1).",
        },
      },
    },
    execute: async (args, ctx) => {
      const supabase = getSupabaseAdmin();
      let product: any = null;

      if (args.productId) {
        const { data } = await supabase
          .from("products")
          .select("id, name, price")
          .eq("store_id", ctx.storeId)
          .eq("id", args.productId)
          .maybeSingle();
        product = data;
      }

      if (!product && args.productName) {
        const { data: list } = await supabase
          .from("products")
          .select("id, name, price")
          .eq("store_id", ctx.storeId);
        const q = String(args.productName).toLowerCase().trim();
        product = (list || []).find((p) => p.name.toLowerCase().includes(q));
      }

      if (!product) {
        return { ok: false, error: "Produto não encontrado no cardápio desta loja." };
      }

      const qty = Math.max(1, Math.min(50, Math.round(Number(args.quantity) || 1)));
      return {
        ok: true,
        cartAction: {
          type: "add_to_cart",
          productId: product.id,
          productName: product.name,
          price: Number(product.price),
          qty,
        },
        message: `${qty}x ${product.name} (${formatBRL(Number(product.price) * qty)}) adicionado à sua sacola!`,
      };
    },
  },
];

export function getToolsForRole(role: MCPUserRole): MCPToolDefinition[] {
  return MCP_TOOLS.filter((t) => t.roles.includes(role));
}

export async function executeMcpTool(
  name: string,
  args: Record<string, any>,
  ctx: MCPToolContext
) {
  const tool = MCP_TOOLS.find((t) => t.name === name);
  if (!tool) {
    throw new Error(`Ferramenta MCP "${name}" não encontrada.`);
  }
  if (!tool.roles.includes(ctx.role)) {
    throw new Error(`Permissão negada para executar "${name}" com o perfil ${ctx.role}.`);
  }
  return await tool.execute(args || {}, ctx);
}
