import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import QRCode from "qrcode";
import { generatePixCopiaECola } from "@/lib/pix";

export const dynamic = "force-dynamic";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return createClient(url, key);
}

const SUPERADMIN_EMAIL = "toyesterdayagencia@gmail.com";

export async function POST(req: Request) {
  try {
    const { storeId, storeName, amount } = await req.json();

    if (!storeId || !amount || Number(amount) <= 0) {
      return NextResponse.json(
        { error: "Dados da fatura inválidos para pagamento." },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Busca configurações e chave Pix do SuperAdmin
    const {
      data: { users },
    } = await supabaseAdmin.auth.admin.listUsers();

    const superAdminUser = users?.find(
      (u) => u.email?.toLowerCase().trim() === SUPERADMIN_EMAIL
    );

    const meta = superAdminUser?.user_metadata || {};
    const adminPixKey = meta.pix_key || process.env.ADMIN_PIX_KEY || "";
    const adminPixName = meta.pix_name || "MEUFIADIM";
    const adminPixCity = meta.pix_city || "BRASILIA";
    const adminWhatsapp = meta.whatsapp || "31993305095";

    // 2. Se o SuperAdmin configurou a chave Pix direta, gera Pix Copia e Cola oficial do Banco Central
    if (adminPixKey) {
      const pixCode = generatePixCopiaECola({
        pixKey: adminPixKey,
        merchantName: adminPixName,
        merchantCity: adminPixCity,
        amount: Number(amount),
        txid: `FAT${Date.now().toString().slice(-6)}`,
      });

      const qrDataUrl = await QRCode.toDataURL(pixCode, {
        width: 320,
        margin: 2,
      });

      const qrCodeBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, "");

      return NextResponse.json({
        ok: true,
        method: "direct_pix",
        qr_code: pixCode,
        qr_code_base64: qrCodeBase64,
        admin_pix_key: adminPixKey,
        admin_pix_name: adminPixName,
        admin_whatsapp: adminWhatsapp,
      });
    }

    // 3. Fallback: Se não houver chave Pix direta, tenta Mercado Pago (caso haja token)
    if (process.env.MP_ACCESS_TOKEN) {
      const response = await fetch("https://api.mercadopago.com/v1/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
          "X-Idempotency-Key": `${storeId}-${Date.now()}`,
        },
        body: JSON.stringify({
          transaction_amount: Number(amount),
          description: `Comissão meufiadim - ${storeName || "Loja"}`,
          payment_method_id: "pix",
          external_reference: storeId,
          notification_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/mercadopago/webhook`,
          payer: {
            email: "fatura@meufiadim.com",
          },
        }),
      });

      const data = await response.json();
      if (response.ok) {
        const txData = data.point_of_interaction?.transaction_data;
        return NextResponse.json({
          ok: true,
          method: "mercadopago",
          payment_id: data.id,
          qr_code: txData?.qr_code,
          qr_code_base64: txData?.qr_code_base64,
        });
      }
    }

    return NextResponse.json(
      {
        error:
          "O dono da plataforma ainda não cadastrou a Chave Pix oficial de recebimento no painel SuperAdmin.",
      },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Erro ao gerar cobrança Pix da fatura." },
      { status: 500 }
    );
  }
}
