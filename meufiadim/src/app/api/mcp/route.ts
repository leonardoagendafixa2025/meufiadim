import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/encomendas";
import {
  executeMcpTool,
  getToolsForRole,
  type MCPToolContext,
} from "@/lib/mcp-tools";

export const dynamic = "force-dynamic";

async function resolveMcpContext(
  req: Request,
  bodyParams?: { storeId?: string; storeSlug?: string; customerId?: string }
): Promise<MCPToolContext | null> {
  const supabase = getSupabaseAdmin();
  const authHeader = req.headers.get("authorization");

  // 1. Autenticação como Lojista (Bearer Token Supabase Auth)
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "").trim();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (!error && user) {
      const { data: store } = await supabase
        .from("stores")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (store) {
        return {
          role: "merchant",
          storeId: store.id,
          userId: user.id,
        };
      }
    }
  }

  // 2. Contexto público de Vitrine / Consumidor para uma loja específica
  let storeId = bodyParams?.storeId || "";
  if (!storeId && bodyParams?.storeSlug) {
    const { data: st } = await supabase
      .from("stores")
      .select("id")
      .eq("slug", bodyParams.storeSlug)
      .maybeSingle();
    if (st) storeId = st.id;
  }

  if (storeId) {
    let verifiedCustomerId: string | null = null;
    if (bodyParams?.customerId) {
      const { data: cust } = await supabase
        .from("customers")
        .select("id")
        .eq("id", bodyParams.customerId)
        .eq("store_id", storeId)
        .maybeSingle();
      if (cust) verifiedCustomerId = cust.id;
    }

    return {
      role: "customer",
      storeId,
      customerId: verifiedCustomerId,
    };
  }

  return null;
}

/**
 * GET /api/mcp
 * Retorna capacidades e catálogo de ferramentas públicas/documentadas do Servidor MCP do MEU FIADIM.
 */
export async function GET() {
  return NextResponse.json({
    protocol: "Model Context Protocol (MCP)",
    version: "2024-11-05",
    serverInfo: {
      name: "meufiadim-mcp-server",
      version: "1.0.0",
      description:
        "Servidor MCP oficial do MEU FIADIM para Copiloto Financeiro do Lojista e Vendedor IA.",
    },
    aiEngine: {
      geminiConfigured: Boolean((process.env.GEMINI_API_KEY || "").trim()),
      geminiKeyType: (process.env.GEMINI_API_KEY || "").trim().startsWith("AQ.")
        ? "vertex-express"
        : (process.env.GEMINI_API_KEY || "").trim()
        ? "ai-studio"
        : "none",
      openaiConfigured: Boolean((process.env.OPENAI_API_KEY || "").trim()),
    },
    merchantTools: getToolsForRole("merchant").map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
    customerTools: getToolsForRole("customer").map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  });
}

/**
 * POST /api/mcp
 * Implementa JSON-RPC 2.0 (initialize, tools/list, tools/call).
 */
export async function POST(req: Request) {
  let rpcId: string | number | null = null;

  try {
    const body = await req.json();
    rpcId = body.id ?? null;
    const method = body.method;
    const params = body.params || {};

    if (method === "initialize") {
      return NextResponse.json({
        jsonrpc: "2.0",
        id: rpcId,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "meufiadim-mcp-server", version: "1.0.0" },
        },
      });
    }

    const ctx = await resolveMcpContext(req, params);
    if (!ctx) {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id: rpcId,
          error: {
            code: -32001,
            message: "Não autorizado ou storeId ausente para sessão MCP.",
          },
        },
        { status: 401 }
      );
    }

    if (method === "tools/list") {
      const tools = getToolsForRole(ctx.role).map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      }));
      return NextResponse.json({
        jsonrpc: "2.0",
        id: rpcId,
        result: { tools },
      });
    }

    if (method === "tools/call") {
      const toolName = params.name;
      const toolArgs = params.arguments || {};
      const result = await executeMcpTool(toolName, toolArgs, ctx);
      return NextResponse.json({
        jsonrpc: "2.0",
        id: rpcId,
        result: {
          content: [{ type: "text", text: JSON.stringify(result) }],
          structuredContent: result,
        },
      });
    }

    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: rpcId,
        error: { code: -32601, message: `Método MCP desconhecido: ${method}` },
      },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: rpcId,
        error: { code: -32603, message: err?.message || "Erro interno no servidor MCP." },
      },
      { status: 500 }
    );
  }
}
