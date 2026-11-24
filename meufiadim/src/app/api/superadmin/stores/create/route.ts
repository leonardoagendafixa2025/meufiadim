import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return createClient(url, key);
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
    const superAdmins = [
      "toyesterdayagencia@gmail.com",
      (process.env.NEXT_PUBLIC_SUPERADMIN_EMAIL || "").toLowerCase().trim(),
    ].filter(Boolean);

    if (authError || !user || !superAdmins.includes(userEmail)) {
      return NextResponse.json(
        { error: "Acesso negado. Apenas o SuperAdmin pode criar lojas manualmente." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      name,
      slug,
      email,
      password,
      whatsapp,
      pix_key,
      pix_city,
      commission_rate,
      billing_cycle,
    } = body;

    if (!name || !slug || !email || !password) {
      return NextResponse.json(
        { error: "Nome da loja, slug, e-mail e senha são obrigatórios." },
        { status: 400 }
      );
    }

    const cleanSlug = slug
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    // 1. Verifica se já existe loja com este slug
    const { data: existingStore } = await supabaseAdmin
      .from("stores")
      .select("id")
      .eq("slug", cleanSlug)
      .maybeSingle();

    if (existingStore) {
      return NextResponse.json(
        { error: `O slug "/${cleanSlug}" já está em uso por outra loja. Escolha outro.` },
        { status: 400 }
      );
    }

    // 2. Procura ou cria o usuário de autenticação do Lojista
    const {
      data: { users },
    } = await supabaseAdmin.auth.admin.listUsers();

    let ownerId: string | null = null;
    const existingUser = users.find(
      (u) => u.email?.toLowerCase().trim() === email.toLowerCase().trim()
    );

    if (existingUser) {
      ownerId = existingUser.id;
      // Atualiza a senha se fornecida
      if (password) {
        await supabaseAdmin.auth.admin.updateUserById(ownerId, { password });
      }
    } else {
      const { data: newUser, error: createUserError } =
        await supabaseAdmin.auth.admin.createUser({
          email: email.trim(),
          password: password.trim(),
          email_confirm: true,
        });

      if (createUserError || !newUser?.user) {
        return NextResponse.json(
          {
            error:
              createUserError?.message || "Não foi possível criar o usuário lojista.",
          },
          { status: 400 }
        );
      }
      ownerId = newUser.user.id;
    }

    // 3. Cadastra a nova loja no Supabase
    const { data: store, error: insertError } = await supabaseAdmin
      .from("stores")
      .insert({
        owner_id: ownerId,
        name: name.trim(),
        slug: cleanSlug,
        whatsapp: (whatsapp || "").replace(/\D/g, ""),
        pix_key: pix_key?.trim() || null,
        pix_city: pix_city?.trim() || "BRASILIA",
        commission_rate: Number(commission_rate) || 5.0,
        billing_cycle: billing_cycle === "monthly" ? "monthly" : "weekly",
        status: "active",
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      store,
      credentials: {
        email: email.trim(),
        password: password.trim(),
        loginUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://meufiadim.com"}/login`,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Erro interno ao cadastrar loja." },
      { status: 500 }
    );
  }
}
