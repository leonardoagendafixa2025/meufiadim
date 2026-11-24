import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/encomendas";
import {
  cleanPhone,
  hashPassword,
  verifyPassword,
  createCustomerSessionToken,
} from "@/lib/customer-auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, storeId, name, phone, password } = body;

    if (!storeId) {
      return NextResponse.json(
        { error: "Identificador da loja (storeId) é obrigatório." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // 1. Verificar se a loja existe
    const { data: store, error: storeErr } = await supabase
      .from("stores")
      .select("id, name, status")
      .eq("id", storeId)
      .maybeSingle();

    if (storeErr || !store) {
      return NextResponse.json(
        { error: "Loja não encontrada." },
        { status: 404 }
      );
    }

    const digits = cleanPhone(phone);
    if (!digits || digits.length < 10 || digits.length > 11) {
      return NextResponse.json(
        { error: "Informe um número de celular válido com DDD (10 ou 11 dígitos)." },
        { status: 400 }
      );
    }

    // -------------------------------------------------------------
    // CADASTRO
    // -------------------------------------------------------------
    if (action === "register") {
      if (!name || name.trim().length < 2) {
        return NextResponse.json(
          { error: "Informe seu nome completo (mínimo de 2 caracteres)." },
          { status: 400 }
        );
      }
      if (!password || password.length < 4) {
        return NextResponse.json(
          { error: "A senha deve ter pelo menos 4 caracteres." },
          { status: 400 }
        );
      }

      // Verificar se já existe cliente com esse telefone nessa loja
      const { data: existingCustomer } = await supabase
        .from("customers")
        .select("id, name, phone, password_hash, balance, credit_limit")
        .eq("store_id", storeId)
        .eq("phone", digits)
        .maybeSingle();

      const hashedPassword = hashPassword(password);

      if (existingCustomer) {
        // Se já existe e já tem senha, manda fazer login
        if (existingCustomer.password_hash) {
          return NextResponse.json(
            {
              error:
                "Já existe uma conta cadastrada com este telefone nesta loja. Por favor, faça login com sua senha.",
              alreadyExists: true,
            },
            { status: 409 }
          );
        }

        // Se já existia (ex: cadastrado no fiado pelo lojista), define a senha e ativa a conta
        const { data: updatedCustomer, error: updateErr } = await supabase
          .from("customers")
          .update({
            name: name.trim(),
            password_hash: hashedPassword,
          })
          .eq("id", existingCustomer.id)
          .select("id, store_id, name, phone, balance, credit_limit")
          .single();

        if (updateErr) {
          return NextResponse.json(
            { error: "Erro ao ativar sua conta: " + updateErr.message },
            { status: 500 }
          );
        }

        const token = createCustomerSessionToken({
          customerId: updatedCustomer.id,
          storeId: storeId,
          phone: updatedCustomer.phone,
        });

        return NextResponse.json({
          success: true,
          message: "Conta ativada com sucesso! Bem-vindo(a)!",
          customer: updatedCustomer,
          token,
        });
      }

      // Criar novo cliente
      const { data: newCustomer, error: insertErr } = await supabase
        .from("customers")
        .insert({
          store_id: storeId,
          name: name.trim(),
          phone: digits,
          password_hash: hashedPassword,
          balance: 0,
          credit_limit: 0,
        })
        .select("id, store_id, name, phone, balance, credit_limit")
        .single();

      if (insertErr) {
        return NextResponse.json(
          { error: "Erro ao cadastrar cliente: " + insertErr.message },
          { status: 500 }
        );
      }

      const token = createCustomerSessionToken({
        customerId: newCustomer.id,
        storeId: storeId,
        phone: newCustomer.phone,
      });

      return NextResponse.json({
        success: true,
        message: "Cadastro realizado com sucesso!",
        customer: newCustomer,
        token,
      });
    }

    // -------------------------------------------------------------
    // LOGIN
    // -------------------------------------------------------------
    if (action === "login") {
      if (!password) {
        return NextResponse.json(
          { error: "Informe sua senha para entrar." },
          { status: 400 }
        );
      }

      const { data: customer, error: fetchErr } = await supabase
        .from("customers")
        .select("id, store_id, name, phone, password_hash, balance, credit_limit")
        .eq("store_id", storeId)
        .eq("phone", digits)
        .maybeSingle();

      if (fetchErr) {
        return NextResponse.json(
          { error: "Erro ao buscar cliente: " + fetchErr.message },
          { status: 500 }
        );
      }

      if (!customer) {
        return NextResponse.json(
          {
            error:
              "Nenhum cadastro encontrado com este telefone nesta loja. Crie sua conta em instantes!",
            notRegistered: true,
          },
          { status: 404 }
        );
      }

      // Se o lojista cadastrou o cliente no fiado mas o cliente não tem senha online ainda
      if (!customer.password_hash) {
        // Se a senha foi digitada com min 4 caracteres, ativa e cadastra a senha automaticamente
        if (password.length >= 4) {
          const hashedPassword = hashPassword(password);
          await supabase
            .from("customers")
            .update({ password_hash: hashedPassword })
            .eq("id", customer.id);

          const token = createCustomerSessionToken({
            customerId: customer.id,
            storeId: storeId,
            phone: customer.phone,
          });

          return NextResponse.json({
            success: true,
            message: "Senha cadastrada com sucesso! Bem-vindo(a) de volta!",
            customer: {
              id: customer.id,
              store_id: customer.store_id,
              name: customer.name,
              phone: customer.phone,
              balance: customer.balance,
              credit_limit: customer.credit_limit,
            },
            token,
          });
        }

        return NextResponse.json(
          {
            error:
              "Seu cadastro foi localizado, mas ainda não possui senha. Cadastre sua senha para entrar.",
            needsPasswordSetup: true,
          },
          { status: 400 }
        );
      }

      // Validar senha
      const isPasswordValid = verifyPassword(password, customer.password_hash);
      if (!isPasswordValid) {
        return NextResponse.json(
          { error: "Senha incorreta. Verifique os dados digitados e tente novamente." },
          { status: 401 }
        );
      }

      const token = createCustomerSessionToken({
        customerId: customer.id,
        storeId: storeId,
        phone: customer.phone,
      });

      return NextResponse.json({
        success: true,
        message: `Bem-vindo(a) de volta, ${customer.name.split(" ")[0]}!`,
        customer: {
          id: customer.id,
          store_id: customer.store_id,
          name: customer.name,
          phone: customer.phone,
          balance: customer.balance,
          credit_limit: customer.credit_limit,
        },
        token,
      });
    }

    // -------------------------------------------------------------
    // ATUALIZAR SESSÃO / PERFIL
    // -------------------------------------------------------------
    if (action === "session") {
      const { customerId } = body;
      if (!customerId) {
        return NextResponse.json({ error: "customerId ausente." }, { status: 400 });
      }

      const { data: customer } = await supabase
        .from("customers")
        .select("id, store_id, name, phone, balance, credit_limit")
        .eq("id", customerId)
        .eq("store_id", storeId)
        .maybeSingle();

      if (!customer) {
        return NextResponse.json({ error: "Sessão expirada." }, { status: 404 });
      }

      return NextResponse.json({ success: true, customer });
    }

    return NextResponse.json(
      { error: "Ação inválida. Utilize 'register', 'login' ou 'session'." },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro interno no servidor." },
      { status: 500 }
    );
  }
}
