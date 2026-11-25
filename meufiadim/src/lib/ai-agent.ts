import {
  executeMcpTool,
  getToolsForRole,
  type MCPToolContext,
} from "@/lib/mcp-tools";
import {
  resolveStoreAiSkill,
  sanitizeCustomInstructions,
  type StoreAiSkillId,
} from "@/lib/ai-skills";
import { formatBRL } from "@/lib/whatsapp";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface CartAction {
  type: "add_to_cart";
  productId: string;
  productName: string;
  price: number;
  qty: number;
}

export interface PixAction {
  type: "pix_code";
  code: string;
  amount: number;
  storeName: string;
  orderId?: string;
}

export interface AgentRunResult {
  reply: string;
  toolsUsed: string[];
  cartActions: CartAction[];
  pixActions?: PixAction[];
  provider: "gemini" | "openai" | "local-mcp";
  aiDiagnostic?: "active" | "missing_key" | "api_error";
  aiDiagnosticDetail?: string;
}

function collectToolActions(
  output: any,
  cartActions: CartAction[],
  pixActions: PixAction[]
) {
  if (!output) return;
  if (output.cartAction?.type === "add_to_cart") {
    cartActions.push(output.cartAction);
  }
  if (Array.isArray(output.cartActions)) {
    for (const act of output.cartActions) {
      if (act?.type === "add_to_cart") cartActions.push(act);
    }
  }
  if (output.pixAction?.type === "pix_code" && output.pixAction.code) {
    pixActions.push(output.pixAction);
  }
}

function buildSystemPrompt(
  ctx: MCPToolContext,
  storeName?: string,
  skillId?: StoreAiSkillId | string | null,
  customInstructions?: string | null
): string {
  const today = new Date().toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
  const skill = resolveStoreAiSkill(skillId);
  const cleanCustom = sanitizeCustomInstructions(customInstructions);

  if (ctx.role === "merchant") {
    return [
      `Você é o Assistente oficial da loja "${storeName || "MEU FIADIM"}" no MEU FIADIM.`,
      `Data de hoje em Brasília: ${today}.`,
      `Você conversa com o LOJISTA dono do negócio em português do Brasil claro, direto, amigável e prático.`,
      skill.merchantPromptRules,
      cleanCustom ? `PREFERÊNCIAS EXTRA DO LOJISTA: ${cleanCustom}` : "",
      `Você pode consultar resumo financeiro, listar devedores, ver clientes sumidos (list_dormant_customers) e reativá-los (send_reactivation_whatsapp), ver estoque baixo, acompanhar/atualizar pedidos (EM_PREPARO, SAIU_ENTREGA, ENTREGUE), lançar vendas no fiado (create_fiado_sale), dar baixa de pagamentos (record_fiado_payment), cadastrar encomendas e enviar cobranças no WhatsApp.`,
      `Use SEMPRE suas ferramentas para consultar números, clientes, saldos, encomendas e cardápio — nunca invente valores ou clientes.`,
      `REGRA DE SEGURANÇA PARA AÇÕES SENSÍVEIS:`,
      `- Para ações de escrita ou envio (create_fiado_sale, record_fiado_payment, create_encomenda, send_whatsapp_charge, send_reactivation_whatsapp, update_order_status), se o lojista informou cliente e valor/status/ação claramente, execute; se faltar dado obrigatório ou houver ambiguidade, peça confirmação antes.`,
      `- Nunca altere comissões da plataforma nem prometa recursos inexistentes.`,
      `Formate valores monetários em Real (R$) e use listas curtas e legíveis.`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    `Você é o Vendedor e Atendente Virtual IA oficial da loja "${storeName || "MEU FIADIM"}".`,
    `Data de hoje em Brasília: ${today}.`,
    `Você conversa com o CLIENTE final da loja em português do Brasil simpático, rápido e vendedor (ajuda o cliente a escolher produtos, tirar dúvidas de entrega/frete, repetir o último pedido e fechar a compra com Pix).`,
    skill.customerPromptRules,
    cleanCustom ? `REGRAS ESPECÍFICAS DESTA LOJA: ${cleanCustom}` : "",
    `REGRAS IMPORTANTES:`,
    `1. Use SEMPRE as ferramentas MCP reais (search_catalog, get_store_delivery_info, calculate_freight_by_cep, get_my_customer_orders, add_to_cart_suggestion, build_magic_cart_link, repeat_last_customer_order, create_conversational_order_pix) antes de responder sobre preços, produtos, frete ou pedidos.`,
    `2. NUNCA invente produtos, preços, códigos Pix ou taxas de entrega que não vieram das ferramentas.`,
    `3. Se o cliente pedir para adicionar itens na sacola, use add_to_cart_suggestion (1 item) ou build_magic_cart_link (vários itens ou link pronto).`,
    `4. Se o cliente pedir para repetir o último pedido ("pedir de novo"), use repeat_last_customer_order.`,
    `5. Se o cliente confirmar que quer FECHAR o pedido no chat informando itens, modalidade (entrega/retirada) e pagamento (ex: Pix), use create_conversational_order_pix (quando autenticado) e exiba o Pix Copia e Cola retornado. Caso não esteja logado, monte o Link Mágico com build_magic_cart_link!`,
  ]
    .filter(Boolean)
    .join("\n");
}

function toGeminiSchemaNode(node: any): any {
  const upperType = String(node?.type || "string").toUpperCase();
  const base: Record<string, any> = {
    type: upperType,
    description: node?.description || "",
  };
  if (upperType === "ARRAY" && node?.items) {
    base.items = toGeminiSchemaNode(node.items);
  }
  if (upperType === "OBJECT" && node?.properties) {
    base.properties = Object.fromEntries(
      Object.entries(node.properties).map(([k, v]) => [k, toGeminiSchemaNode(v)])
    );
  }
  return base;
}

/**
 * Converte JSON Schema simplificado para o formato de FunctionDeclaration da Gemini API.
 */
export function toGeminiDeclarations(tools: ReturnType<typeof getToolsForRole>) {
  return tools.map((t) => {
    const entries = Object.entries(t.inputSchema.properties || {});
    if (entries.length === 0) {
      return {
        name: t.name,
        description: t.description,
      };
    }

    return {
      name: t.name,
      description: t.description,
      parameters: {
        type: "OBJECT",
        properties: Object.fromEntries(
          entries.map(([k, v]: [string, any]) => [k, toGeminiSchemaNode(v)])
        ),
        ...(t.inputSchema.required?.length ? { required: t.inputSchema.required } : {}),
      },
    };
  });
}

async function runWithGemini(params: {
  apiKey: string;
  model?: string;
  endpointBase?: "vertex" | "aistudio";
  message: string;
  history: ChatTurn[];
  ctx: MCPToolContext;
  storeName?: string;
  skillId?: StoreAiSkillId | string | null;
  customInstructions?: string | null;
}): Promise<AgentRunResult> {
  const {
    apiKey,
    model = "gemini-2.5-flash",
    endpointBase,
    message,
    history,
    ctx,
    storeName,
    skillId,
    customInstructions,
  } = params;
  const tools = getToolsForRole(ctx.role);
  const toolsUsed: string[] = [];
  const cartActions: CartAction[] = [];
  const pixActions: PixAction[] = [];

  const contents: any[] = history.slice(-8).map((h) => ({
    role: h.role === "assistant" ? "model" : "user",
    parts: [{ text: h.content }],
  }));
  contents.push({ role: "user", parts: [{ text: message }] });

  const resolvedBase = endpointBase || (apiKey.startsWith("AQ.") ? "vertex" : "aistudio");
  const endpoint =
    resolvedBase === "vertex"
      ? `https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:generateContent`
      : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  for (let round = 0; round < 4; round++) {
    let res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            { text: buildSystemPrompt(ctx, storeName, skillId, customInstructions) },
          ],
        },
        contents,
        tools: [{ functionDeclarations: toGeminiDeclarations(tools) }],
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 1500,
        },
      }),
    });

    // Retry rápido em caso de pico 503 temporário
    if (res.status === 503) {
      await new Promise((r) => setTimeout(r, 700));
      res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              { text: buildSystemPrompt(ctx, storeName, skillId, customInstructions) },
            ],
          },
          contents,
          tools: [{ functionDeclarations: toGeminiDeclarations(tools) }],
          generationConfig: {
            temperature: 0.35,
            maxOutputTokens: 1500,
          },
        }),
      });
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const candidate = data.candidates?.[0]?.content;
    const parts = candidate?.parts || [];

    const functionCalls = parts.filter((p: any) => p.functionCall);
    if (functionCalls.length === 0) {
      const replyText = parts
        .filter((p: any) => p.text)
        .map((p: any) => p.text)
        .join("\n")
        .trim();
      return {
        reply: replyText || "Concluído! Como posso ajudar mais?",
        toolsUsed,
        cartActions,
        pixActions,
        provider: "gemini",
      };
    }

    contents.push({ role: "model", parts });

    const responseParts: any[] = [];
    for (const part of functionCalls) {
      const { name, args } = part.functionCall;
      toolsUsed.push(name);
      let output: any;
      try {
        output = await executeMcpTool(name, args || {}, ctx);
        collectToolActions(output, cartActions, pixActions);
      } catch (e: any) {
        output = { error: e?.message || "Erro ao executar ferramenta MCP." };
      }

      responseParts.push({
        functionResponse: {
          name,
          response: { result: output },
        },
      });
    }

    contents.push({ role: "user", parts: responseParts });
  }

  return {
    reply: "Consultei seus dados! Se precisar de mais algum detalhe, é só perguntar.",
    toolsUsed,
    cartActions,
    pixActions,
    provider: "gemini",
  };
}

async function runWithOpenAI(params: {
  apiKey: string;
  message: string;
  history: ChatTurn[];
  ctx: MCPToolContext;
  storeName?: string;
  skillId?: StoreAiSkillId | string | null;
  customInstructions?: string | null;
}): Promise<AgentRunResult> {
  const { apiKey, message, history, ctx, storeName, skillId, customInstructions } = params;
  const tools = getToolsForRole(ctx.role);
  const toolsUsed: string[] = [];
  const cartActions: CartAction[] = [];
  const pixActions: PixAction[] = [];

  const openAiTools = tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    },
  }));

  const messages: any[] = [
    {
      role: "system",
      content: buildSystemPrompt(ctx, storeName, skillId, customInstructions),
    },
    ...history.slice(-8).map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: message },
  ];

  for (let round = 0; round < 4; round++) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        tools: openAiTools,
        temperature: 0.35,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI API ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const msg = data.choices?.[0]?.message;
    if (!msg) break;

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return {
        reply: (msg.content || "").trim() || "Pronto! Em que posso ajudar?",
        toolsUsed,
        cartActions,
        pixActions,
        provider: "openai",
      };
    }

    messages.push(msg);

    for (const tc of msg.tool_calls) {
      const name = tc.function.name;
      toolsUsed.push(name);
      let args: Record<string, any> = {};
      try {
        args = JSON.parse(tc.function.arguments || "{}");
      } catch {}

      let output: any;
      try {
        output = await executeMcpTool(name, args, ctx);
        collectToolActions(output, cartActions, pixActions);
      } catch (e: any) {
        output = { error: e?.message || "Erro ao executar tool." };
      }

      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: JSON.stringify(output),
      });
    }
  }

  return {
    reply: "Consulta concluída! Precisa de mais alguma coisa?",
    toolsUsed,
    cartActions,
    pixActions,
    provider: "openai",
  };
}

/**
 * Fallback inteligente determinístico usando as mesmas tools MCP reais
 * caso GEMINI_API_KEY e OPENAI_API_KEY ainda não estejam configuradas no ambiente.
 */
async function runLocalMcpFallback(params: {
  message: string;
  ctx: MCPToolContext;
  storeName?: string;
  skillId?: StoreAiSkillId | string | null;
}): Promise<AgentRunResult> {
  const { message, ctx, storeName, skillId } = params;
  const skill = resolveStoreAiSkill(skillId);
  const q = message.toLowerCase().trim();
  const toolsUsed: string[] = [];
  const cartActions: CartAction[] = [];

  if (ctx.role === "merchant") {
    // Comando rápido determinístico de lançamento no fiado (ex: "anota 45 no fiado do Joao")
    const quickFiadoMatch = message.match(
      /(?:anota|lanca|lança|venda)\s+(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)\s+(?:no\s+fiado\s+(?:do|da|de|para)|para|pro|pra)\s+(.+)/i
    );
    if (quickFiadoMatch) {
      const amount = Number(quickFiadoMatch[1].replace(",", "."));
      const rawCustomer = quickFiadoMatch[2].trim();
      if (amount > 0 && rawCustomer.length >= 2) {
        toolsUsed.push("create_fiado_sale");
        const res = await executeMcpTool(
          "create_fiado_sale",
          { customerQuery: rawCustomer, amount, paymentMethod: "Fiado" },
          ctx
        );
        return {
          reply: res.error ? `⚠️ ${res.error}` : `✅ ${res.message}`,
          toolsUsed,
          cartActions,
          provider: "local-mcp",
        };
      }
    }

    if (
      q.includes("sumid") ||
      q.includes("inativ") ||
      q.includes("reativa") ||
      q.includes("sumiu")
    ) {
      toolsUsed.push("list_dormant_customers");
      const res = await executeMcpTool("list_dormant_customers", {}, ctx);
      if (!res.customers?.length) {
        return {
          reply: `✅ Nenhum cliente está sumido há mais de ${res.inactiveDays} dias!`,
          toolsUsed,
          cartActions,
          provider: "local-mcp",
        };
      }
      const lines = res.customers
        .slice(0, 8)
        .map(
          (c: any, idx: number) =>
            `${idx + 1}. *${c.name}* — ${c.daysSinceLastPurchase}d sem pedir (Total: ${c.totalSpentFormatted} • Último: ${c.lastOrderDescription})`
        );
      return {
        reply: `🎯 *Clientes Sumidos (${res.count} há +${res.inactiveDays} dias):*\n\n${lines.join("\n")}\n\n_Dica: abra a aba Relatórios no painel para reativá-los com 1 toque no WhatsApp!_`,
        toolsUsed,
        cartActions,
        provider: "local-mcp",
      };
    }

    if (q.includes("estoque baixo") || q.includes("acabando") || q.includes("esgotad")) {
      toolsUsed.push("get_low_stock_products");
      const res = await executeMcpTool("get_low_stock_products", {}, ctx);
      if (!res.products?.length) {
        return {
          reply: `✅ Nenhum produto está com estoque baixo (≤ ${res.threshold} un) no momento.`,
          toolsUsed,
          cartActions,
          provider: "local-mcp",
        };
      }
      const lines = res.products.map(
        (p: any) =>
          `• *${p.name}* — ${p.stock === 0 ? "ESGOTADO" : `${p.stock} un restantes`} (${p.priceFormatted})`
      );
      return {
        reply: `⚠️ *Alerta de Estoque Baixo (${res.count}):*\n\n${lines.join("\n")}`,
        toolsUsed,
        cartActions,
        provider: "local-mcp",
      };
    }

    if (q.includes("pedido") || q.includes("em aberto") || q.includes("preparo")) {
      toolsUsed.push("list_store_orders");
      const res = await executeMcpTool("list_store_orders", { onlyOpen: true }, ctx);
      if (!res.orders?.length) {
        return {
          reply: "✅ Nenhum pedido em andamento no momento.",
          toolsUsed,
          cartActions,
          provider: "local-mcp",
        };
      }
      const lines = res.orders.map(
        (o: any) =>
          `• *${o.customerName}* — ${o.totalFormatted} [${o.status}] (${o.description})`
      );
      return {
        reply: `🛵 *Pedidos em Andamento (${res.count}):*\n\n${lines.join("\n")}`,
        toolsUsed,
        cartActions,
        provider: "local-mcp",
      };
    }

    if (
      q.includes("atrasad") ||
      q.includes("vencid") ||
      q.includes("devedor") ||
      q.includes("quem deve") ||
      q.includes("devendo")
    ) {
      const onlyLate = q.includes("atrasad") || q.includes("vencid");
      toolsUsed.push("list_debtor_customers");
      const res = await executeMcpTool("list_debtor_customers", { onlyLate }, ctx);
      if (!res.customers?.length) {
        return {
          reply: onlyLate
            ? "✅ Boas notícias! Você não tem nenhum cliente em atraso hoje."
            : "✅ Nenhum cliente possui saldo em aberto no fiado no momento.",
          toolsUsed,
          cartActions,
          provider: "local-mcp",
        };
      }
      const lines = res.customers
        .slice(0, 8)
        .map(
          (c: any, idx: number) =>
            `${idx + 1}. *${c.name}* — ${c.balanceFormatted}${c.isLate ? " ⚠️ (Atrasado)" : ""}`
        );
      return {
        reply: `${
          onlyLate ? "⚠️ *Clientes em atraso:*" : "📒 *Clientes com saldo no fiado:*"
        } (${res.count} totalizando ${res.totalBalanceFormatted})\n\n${lines.join("\n")}`,
        toolsUsed,
        cartActions,
        provider: "local-mcp",
      };
    }

    if (q.includes("produto") || q.includes("estoque") || q.includes("cardapio") || q.includes("cardápio")) {
      toolsUsed.push("search_catalog");
      const res = await executeMcpTool("search_catalog", {}, ctx);
      if (!res.products?.length) {
        return {
          reply: "Você ainda não cadastrou produtos na sua vitrine.",
          toolsUsed,
          cartActions,
          provider: "local-mcp",
        };
      }
      const lines = res.products
        .slice(0, 8)
        .map((p: any) => `• *${p.name}* — ${p.priceFormatted} (Estoque: ${p.stock ?? 0})`);
      return {
        reply: `🛍️ *Seus produtos (${res.count}):*\n\n${lines.join("\n")}`,
        toolsUsed,
        cartActions,
        provider: "local-mcp",
      };
    }

    // Padrão para lojista: resumo completo
    toolsUsed.push("get_store_summary");
    const sum = await executeMcpTool("get_store_summary", {}, ctx);
    return {
      reply: [
        `📊 *Resumo da ${sum.storeName || storeName || "sua loja"}:*`,
        ``,
        `• 📒 A receber no fiado: *${sum.totalReceivableFiadoFormatted}* (${sum.debtorsCount} clientes, ${sum.lateDebtorsCount} atrasados)`,
        `• 💰 Vendas registradas: *${sum.totalSalesAmountFormatted}* (${sum.totalSalesCount} vendas)`,
        `• 📦 Encomendas em aberto: *${sum.pendingEncomendasCount}* (${sum.pendingEncomendasAmountFormatted}) — ${sum.lateEncomendasCount} atrasadas`,
        `• 🛍️ Produtos ativos: *${sum.totalProducts}*`,
        ``,
        `_Dica: pergunte também "quem está atrasado?", "clientes devendo" ou "listar produtos"._`,
      ].join("\n"),
      toolsUsed,
      cartActions,
      provider: "local-mcp",
    };
  }

  // Modo Consumidor (Vitrine / WhatsApp)
  if (q.includes("repetir") || q.includes("pedir de novo") || q.includes("mesmo pedido") || q.includes("ultimo pedido") || q.includes("último pedido")) {
    toolsUsed.push("repeat_last_customer_order");
    const repRes = await executeMcpTool("repeat_last_customer_order", {}, ctx);
    if (!repRes.authenticated) {
      return {
        reply: "🔐 Para repetir seu último pedido em 1 clique, entre com seu celular e senha no topo da loja!",
        toolsUsed,
        cartActions,
        provider: "local-mcp",
      };
    }
    collectToolActions(repRes, cartActions, []);
    return {
      reply: repRes.message || "Prontinho!",
      toolsUsed,
      cartActions,
      provider: "local-mcp",
    };
  }

  const cepMatch = message.match(/\b(\d{5})-?(\d{3})\b/);
  if (cepMatch) {
    toolsUsed.push("calculate_freight_by_cep");
    const cepRes = await executeMcpTool(
      "calculate_freight_by_cep",
      { cep: `${cepMatch[1]}${cepMatch[2]}` },
      ctx
    );
    return {
      reply: cepRes.message || cepRes.error || "Não foi possível consultar esse CEP.",
      toolsUsed,
      cartActions,
      provider: "local-mcp",
    };
  }

  if (q.includes("pedido") || q.includes("compra") || q.includes("historico") || q.includes("histórico") || q.includes("saldo")) {
    toolsUsed.push("get_my_customer_orders");
    const ordRes = await executeMcpTool("get_my_customer_orders", {}, ctx);
    if (!ordRes.authenticated) {
      return {
        reply: "🔐 Para consultar seus pedidos e saldo, clique em *Entrar* no topo da loja usando seu número de celular e senha!",
        toolsUsed,
        cartActions,
        provider: "local-mcp",
      };
    }
    const list = (ordRes.recentOrders || [])
      .slice(0, 5)
      .map((o: any) => `• ${o.totalFormatted} (${o.payment_method}) — ${o.description || "Pedido"}`);
    return {
      reply: list.length
        ? `Olá, *${ordRes.customerName}*! Seu saldo no fiado é *${ordRes.fiadoBalanceFormatted}*.\n\n*Últimas compras:*\n${list.join("\n")}`
        : `Olá, *${ordRes.customerName}*! Você ainda não tem compras registradas aqui.`,
      toolsUsed,
      cartActions,
      provider: "local-mcp",
    };
  }

  if (q.includes("abert") || q.includes("fechad") || q.includes("entrega") || q.includes("frete") || q.includes("horário") || q.includes("horario") || q.includes("bairro")) {
    toolsUsed.push("get_store_delivery_info");
    const info = await executeMcpTool("get_store_delivery_info", {}, ctx);
    const bairrosText =
      info.neighborhoods?.length > 0
        ? `\n\n📍 *Bairros atendidos:* ${info.neighborhoods
            .slice(0, 6)
            .map((b: any) => `${b.name} (${b.feeFormatted})`)
            .join(", ")}`
        : "";
    return {
      reply: `🏪 A *${info.storeName}* está *${info.statusMessage}*!\n⏱️ Tempo médio: ${info.deliveryTime} • Pedido mínimo: ${info.minOrderFormatted}${bairrosText}\n\nSe quiser, me envie seu *CEP* que eu calculo o frete exato para você!`,
      toolsUsed,
      cartActions,
      provider: "local-mcp",
    };
  }

  // Busca de produtos no catálogo ou saudação padrão com cardápio
  const cleanedSearch = q
    .replace(/^(oi|olá|ola|bom dia|boa tarde|boa noite|quais|tem|quero|gostaria|ver|cardapio|cardápio|produtos|menu)\s*/gi, "")
    .trim();

  toolsUsed.push("search_catalog");
  const cat = await executeMcpTool(
    "search_catalog",
    cleanedSearch.length >= 3 && !q.includes("tudo") ? { query: cleanedSearch } : {},
    ctx
  );

  if (!cat.products?.length && cleanedSearch) {
    // Tenta buscar todos se o filtro específico não achou nada
    const allCat = await executeMcpTool("search_catalog", {}, ctx);
    const lines = (allCat.products || [])
      .slice(0, 6)
      .map((p: any) => `• *${p.name}* — ${p.priceFormatted}`);
    return {
      reply: lines.length
        ? `Não encontrei exatamente "${cleanedSearch}", mas veja nossas opções disponíveis na *${storeName || "loja"}*:\n\n${lines.join("\n")}`
        : `No momento estamos atualizando o catálogo da loja.`,
      toolsUsed,
      cartActions,
      provider: "local-mcp",
    };
  }

  const lines = (cat.products || [])
    .slice(0, 8)
    .map((p: any) => `• *${p.name}* — ${p.priceFormatted}${p.description ? ` (${p.description})` : ""}`);

  return {
    reply: lines.length
      ? `Olá! 😊 Veja os produtos disponíveis na *${storeName || "loja"}*:\n\n${lines.join("\n")}\n\n${skill.localSellerTip}`
      : `Olá! Como posso ajudar você hoje na *${storeName || "loja"}*?`,
    toolsUsed,
    cartActions,
    provider: "local-mcp",
  };
}

export async function runAiAgent(params: {
  message: string;
  history?: ChatTurn[];
  ctx: MCPToolContext;
  storeName?: string;
  skillId?: StoreAiSkillId | string | null;
  customInstructions?: string | null;
}): Promise<AgentRunResult> {
  const {
    message,
    history = [],
    ctx,
    storeName,
    skillId,
    customInstructions,
  } = params;
  const geminiKey = (process.env.GEMINI_API_KEY || "").trim();
  const openAiKey = (process.env.OPENAI_API_KEY || "").trim();

  let hadApiError = false;
  const attemptErrors: string[] = [];

  const sanitizeError = (err: unknown) => {
    const raw = err instanceof Error ? err.message : String(err || "");
    return raw
      .replace(/AQ\.[A-Za-z0-9._-]+/g, "[KEY]")
      .replace(/AIza[A-Za-z0-9_-]+/g, "[KEY]")
      .replace(/key=[^&\s]+/gi, "key=[KEY]")
      .replace(/\s+/g, " ")
      .slice(0, 200);
  };

  if (geminiKey) {
    const attempts: Array<{ model: string; endpointBase: "vertex" | "aistudio" }> = [
      { model: "gemini-3.8-flash", endpointBase: "aistudio" },
      ...(geminiKey.startsWith("AQ.")
        ? [{ model: "gemini-3.8-flash", endpointBase: "vertex" as const }]
        : []),
      { model: "gemini-2.5-flash", endpointBase: "aistudio" },
    ];

    for (const attempt of attempts) {
      try {
        const res = await runWithGemini({
          apiKey: geminiKey,
          model: attempt.model,
          endpointBase: attempt.endpointBase,
          message,
          history,
          ctx,
          storeName,
          skillId,
          customInstructions,
        });
        return { ...res, aiDiagnostic: "active" };
      } catch (err) {
        hadApiError = true;
        const msg = `${attempt.endpointBase}/${attempt.model}: ${sanitizeError(err)}`;
        attemptErrors.push(msg);
        console.warn(`⚠️ Falha na chamada Gemini (${msg})`);
      }
    }

    // Descobre automaticamente modelos flash ativos em ordem decrescente
    try {
      const listRes = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
        headers: { "x-goog-api-key": geminiKey },
      });
      if (listRes.ok) {
        const listData = await listRes.json();
        const triedModels = new Set(attempts.map((a) => a.model));
        const candidateModels = (listData.models || [])
          .filter((m: any) => {
            const name = String(m.name || "").toLowerCase();
            return (
              name.includes("flash") &&
              !name.includes("tts") &&
              !name.includes("image") &&
              !name.includes("audio") &&
              !name.includes("live") &&
              Array.isArray(m.supportedGenerationMethods) &&
              m.supportedGenerationMethods.includes("generateContent")
            );
          })
          .map((m: any) => String(m.name).replace(/^models\//, ""))
          .filter((name: string) => !triedModels.has(name))
          .sort((a: string, b: string) => b.localeCompare(a))
          .slice(0, 5);

        if (candidateModels.length === 0) {
          attemptErrors.push(
            `listModels empty/tried: ${(listData.models || [])
              .slice(0, 6)
              .map((m: any) => m.name)
              .join(",")}`
          );
        }

        for (const cleanModel of candidateModels) {
          try {
            const res = await runWithGemini({
              apiKey: geminiKey,
              model: cleanModel,
              endpointBase: "aistudio",
              message,
              history,
              ctx,
              storeName,
              skillId,
              customInstructions,
            });
            return { ...res, aiDiagnostic: "active" };
          } catch (mErr) {
            hadApiError = true;
            attemptErrors.push(`disc/${cleanModel}: ${sanitizeError(mErr)}`);
          }
        }
      } else {
        attemptErrors.push(`listModels HTTP ${listRes.status}`);
      }
    } catch (discErr) {
      hadApiError = true;
      attemptErrors.push(`discovery: ${sanitizeError(discErr)}`);
    }
  }

  if (openAiKey) {
    try {
      const res = await runWithOpenAI({
        apiKey: openAiKey,
        message,
        history,
        ctx,
        storeName,
        skillId,
        customInstructions,
      });
      return { ...res, aiDiagnostic: "active" };
    } catch (err) {
      hadApiError = true;
      const msg = sanitizeError(err);
      attemptErrors.push(`openai: ${msg}`);
      console.warn("⚠️ Falha na chamada OpenAI API, usando fallback MCP:", msg);
    }
  }

  const fallback = await runLocalMcpFallback({
    message,
    ctx,
    storeName,
    skillId,
  });
  const combinedErrors = attemptErrors.join(" | ").slice(0, 900);
  return {
    ...fallback,
    aiDiagnostic: hadApiError ? "api_error" : "missing_key",
    ...(hadApiError && combinedErrors ? { aiDiagnosticDetail: combinedErrors } : {}),
  };
}
