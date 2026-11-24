import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return createClient(url, key);
}

const SUPERADMIN_EMAIL = "toyesterdayagencia@gmail.com";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseAdmin = getSupabaseAdmin();
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    const userEmail = (user?.email || "").toLowerCase().trim();
    if (authError || !user || userEmail !== SUPERADMIN_EMAIL) {
      return NextResponse.json(
        { error: "Acesso restrito ao SuperAdmin." },
        { status: 403 }
      );
    }

    const meta = user.user_metadata || {};
    return NextResponse.json({
      pix_key: meta.pix_key || "",
      pix_name: meta.pix_name || "MeuFiadim Plataforma",
      pix_city: meta.pix_city || "BRASILIA",
      whatsapp: meta.whatsapp || "",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseAdmin = getSupabaseAdmin();
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    const userEmail = (user?.email || "").toLowerCase().trim();
    if (authError || !user || userEmail !== SUPERADMIN_EMAIL) {
      return NextResponse.json(
        { error: "Acesso restrito ao SuperAdmin." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { pix_key, pix_name, pix_city, whatsapp } = body;

    const { data: updated, error: updateError } =
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...(user.user_metadata || {}),
          pix_key: (pix_key || "").trim(),
          pix_name: (pix_name || "").trim() || "MeuFiadim Plataforma",
          pix_city: (pix_city || "").trim() || "BRASILIA",
          whatsapp: (whatsapp || "").replace(/\D/g, ""),
        },
      });

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      settings: {
        pix_key: updated.user.user_metadata.pix_key,
        pix_name: updated.user.user_metadata.pix_name,
        pix_city: updated.user.user_metadata.pix_city,
        whatsapp: updated.user.user_metadata.whatsapp,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
