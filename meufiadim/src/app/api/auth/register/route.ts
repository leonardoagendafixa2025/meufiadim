import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Client administrativo com service_role para criar a loja com segurança
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, storeName, slug, whatsapp } = body;

    if (!userId || !storeName || !slug) {
      return NextResponse.json(
        { error: "Informe userId, storeName e slug." },
        { status: 400 }
      );
    }

    // Verifica se já existe loja com esse slug
    const { data: existing } = await supabaseAdmin
      .from("stores")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    const finalSlug = existing ? `${slug}-${Date.now().toString().slice(-4)}` : slug;

    const { data, error } = await supabaseAdmin
      .from("stores")
      .insert({
        owner_id: userId,
        name: storeName.trim(),
        slug: finalSlug,
        whatsapp: (whatsapp || "").replace(/\D/g, ""),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ store: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
