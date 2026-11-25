import {
  executeMcpTool,
  getToolsForRole,
  type MCPToolContext,
} from "@/lib/mcp-tools";
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

export interface AgentRunResult {
  reply: string;
  toolsUsed: string[];
  cartActions: CartAction[];
  provider: "gemini" | "openai" | "local-mcp";
  aiDiagnostic?: "active" | "missing_key" | "api_error";
  aiDiagnosticDetail?: string;
}

function buildSystemPrompt(ctx: MCPToolContext, storeName?: string): string {
  const today = new Date().toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });

  if (ctx.role === "merchant") {
    return [
      `Você é o Assistente oficial da loja "${storeName || "MEU FIADIM"}" no MEU FIADIM.`,
      `Data de hoje em Brasília: ${today}.`,
      `Você conversa com o LOJISTA dono do negócio em português do Brasil claro, direto, amigável e prático.`,
      `Use SEMPRE suas ferramentas para consultar números, clientes, saldos, encomendas e cardápio — nunca invente valores ou clientes.`,
      `REGRA DE SEGURANÇA PARA AÇÕES SENSÍVEIS:`,
      `- Para ações de escrita ou envio no WhatsApp (create_encomenda, send_whatsapp_charge), se o usuário já informou explicitamente todos os dados e pediu para executar, execute; se faltar algum dado obrigatório (ex: valor ou data combinada de pagamento) ou se for um comando ambíguo, peça confirmação antes de chamar a tool.`,
      `- Nunca altere comissões da plataforma nem prometa recursos inexistentes.`,
      `Formate valores monetários em Real (R$) e use listas curtas e legíveis.`,
    ].join("\n");
  }

  return [
    `Você é o Vendedor e Atendente Virtual IA oficial da loja "${storeName || "MEU FIADIM"}".`,
    `Data de hoje em Brasília: ${today}.`,
    `Você conversa com o CLIENTE final da loja em português do Brasil simpático, rápido e vendedor (ajuda o cliente a escolher produtos, tirar dúvidas de entrega/frete e fechar a compra).`,
    `REGRAS IMPORTANTES:`,
    `1. Use SEMPRE as ferramentas MCP reais (search_catalog, get_store_delivery_info, calculate_freight_by_cep, get_my_customer_orders, add_to_cart_suggestion) antes de responder sobre preços, produtos, frete ou pedidos.`,
    `2. NUNCA invente produtos, preços ou taxas de entrega que não vieram das ferramentas.`,
    `3. Se o cliente pedir para adicionar um item na sacola/carrinho, use add_to_cart_suggestion com o productId exato obtido de search_catalog.`,
    `4. Se o cliente perguntar sobre pedidos anteriores ou saldo dele sem estar logado, oriente-o a fazer login com celular e senha no topo da loja.`,
    `5. Lembre de informar que para finalizar o pedido na vitrine é necessário estar conectado com celular e senha.`,
  ].join("\n");
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
          entries.map(([k, v]: [string, any]) => [
            k,
            {
              type: String(v.type || "string").toUpperCase(),
              description: v.description || "",
            },
          ])
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
}): Promise<AgentRunResult> {
  const {
    apiKey,
    model = "gemini-2.5-flash",
    endpointBase,
    message,
    history,
    ctx,
    storeName,
  } = params;
  const tools = getToolsForRole(ctx.role);
  const toolsUsed: string[] = [];
  const cartActions: CartAction[] = [];

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
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: buildSystemPrompt(ctx, storeName) }],
        },
        contents,
        tools: [{ functionDeclarations: toGeminiDeclarations(tools) }],
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 1500,
        },
      }),
    });

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
        if (output?.cartAction?.type === "add_to_cart") {
          cartActions.push(output.cartAction);
        }
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
    provider: "gemini",
  };
}

async function runWithOpenAI(params: {
  apiKey: string;
  message: string;
  history: ChatTurn[];
  ctx: MCPToolContext;
  storeName?: string;
}): Promise<AgentRunResult> {
  const { apiKey, message, history, ctx, storeName } = params;
  const tools = getToolsForRole(ctx.role);
  const toolsUsed: string[] = [];
  const cartActions: CartAction[] = [];

  const openAiTools = tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    },
  }));

  const messages: any[] = [
    { role: "system", content: buildSystemPrompt(ctx, storeName) },
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
        if (output?.cartAction?.type === "add_to_cart") {
          cartActions.push(output.cartAction);
        }
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
}): Promise<AgentRunResult> {
  const { message, ctx, storeName } = params;
  const q = message.toLowerCase().trim();
  const toolsUsed: string[] = [];
  const cartActions: CartAction[] = [];

  if (ctx.role === "merchant") {
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
      ? `Olá! 😊 Veja os produtos disponíveis na *${storeName || "loja"}*:\n\n${lines.join("\n")}\n\nPosso verificar o frete pelo seu *CEP* ou responder sobre entrega e horários!`
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
}): Promise<AgentRunResult> {
  const { message, history = [], ctx, storeName } = params;
  const geminiKey = (process.env.GEMINI_API_KEY || "").trim();
  const openAiKey = (process.env.OPENAI_API_KEY || "").trim();

  let hadApiError = false;
  let lastErrorDetail = "";

  const sanitizeError = (err: unknown) => {
    const raw = err instanceof Error ? err.message : String(err || "");
    return raw
      .replace(/AQ\.[A-Za-z0-9._-]+/g, "[KEY]")
      .replace(/AIza[A-Za-z0-9_-]+/g, "[KEY]")
      .replace(/key=[^&\s]+/gi, "key=[KEY]")
      .slice(0, 220);
  };

  if (geminiKey) {
    const attempts: Array<{ model: string; endpointBase: "vertex" | "aistudio" }> =
      geminiKey.startsWith("AQ.")
        ? [
            { model: "gemini-2.5-flash", endpointBase: "vertex" },
            { model: "gemini-2.0-flash", endpointBase: "vertex" },
            { model: "gemini-2.5-flash", endpointBase: "aistudio" },
          ]
        : [
            { model: "gemini-2.5-flash", endpointBase: "aistudio" },
            { model: "gemini-2.0-flash", endpointBase: "aistudio" },
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
        });
        return { ...res, aiDiagnostic: "active" };
      } catch (err) {
        hadApiError = true;
        lastErrorDetail = `${attempt.endpointBase}/${attempt.model}: ${sanitizeError(err)}`;
        console.warn(`⚠️ Falha na chamada Gemini (${lastErrorDetail})`);
      }
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
      });
      return { ...res, aiDiagnostic: "active" };
    } catch (err) {
      hadApiError = true;
      lastErrorDetail = sanitizeError(err);
      console.warn("⚠️ Falha na chamada OpenAI API, usando fallback MCP:", lastErrorDetail);
    }
  }

  const fallback = await runLocalMcpFallback({ message, ctx, storeName });
  return {
    ...fallback,
    aiDiagnostic: hadApiError ? "api_error" : "missing_key",
    ...(hadApiError && lastErrorDetail ? { aiDiagnosticDetail: lastErrorDetail } : {}),
  };
}
