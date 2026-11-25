import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/encomendas";
import { canMerchantAccessSystem } from "@/lib/infinitepay";
import {
  DEFAULT_FIADO_BILLING_CONFIG,
  type FiadoBillingConfig,
} from "@/lib/store-features";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    const token = authHeader.replace("Bearer ", "").trim();
    const supabase = getSupabaseAdmin();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser(token);

    if (authErr || !user) {
      return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
    }

    const meta = user.user_metadata || {};
    const config: FiadoBillingConfig = {
      ...DEFAULT_FIADO_BILLING_CONFIG,
      ...(meta.fiado_billing_config || {}),
    };
    const lowStockThreshold =
      meta.low_stock_threshold !== undefined
        ? Number(meta.low_stock_threshold)
        : 3;

    return NextResponse.json({
      ok: true,
      config,
      lowStockThreshold,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    const token = authHeader.replace("Bearer ", "").trim();
    const supabase = getSupabaseAdmin();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser(token);

    if (authErr || !user) {
      return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
    }

    const { data: store } = await supabase
      .from("stores")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!store) {
      return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
    }

    const access = await canMerchantAccessSystem(store.id);
    if (!access.allowed) {
      return NextResponse.json(
        { error: access.reason || "Operação bloqueada financeiramente." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const meta = user.user_metadata || {};
    const updatedMeta: Record<string, any> = { ...meta };

    if (body.config) {
      updatedMeta.fiado_billing_config = {
        enabled: Boolean(body.config.enabled),
        remindBeforeDays: Math.max(0, Math.min(15, Number(body.config.remindBeforeDays ?? 1))),
        remindOnDueDate: body.config.remindOnDueDate !== false,
        remindOverdueDays: Math.max(1, Math.min(30, Number(body.config.remindOverdueDays ?? 3))),
      };
    }

    if (body.lowStockThreshold !== undefined) {
      const thresh = Math.max(0, Math.min(100, Math.round(Number(body.lowStockThreshold))));
      updatedMeta.low_stock_threshold = thresh;
      try {
        await supabase
          .from("stores")
          .update({ low_stock_threshold: thresh } as any)
          .eq("id", store.id);
      } catch {
        // Ignora se coluna SQL ainda não aplicada
      }
    }

    const { error: updErr } = await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: updatedMeta,
    });

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      config: updatedMeta.fiado_billing_config || DEFAULT_FIADO_BILLING_CONFIG,
      lowStockThreshold: updatedMeta.low_stock_threshold ?? 3,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Erro interno" }, { status: 500 });
  }
}
