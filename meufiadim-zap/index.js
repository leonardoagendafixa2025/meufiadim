require("dotenv").config();
const express = require("express");
const cron = require("node-cron");
const { createClient } = require("@supabase/supabase-js");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const qrcodeTerminal = require("qrcode-terminal");
const QRCode = require("qrcode");
const pino = require("pino");
const { generatePixCopiaECola } = require("./pix");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;
const API_KEY = process.env.API_KEY || "minha-chave-secreta-meufiadim";

const supabase =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : null;

let sock = null;
let isConnected = false;
let latestQR = null;

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState("./auth_info");
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      latestQR = qr;
      console.log("\n📱 Escaneie o QR Code abaixo no seu WhatsApp:");
      qrcodeTerminal.generate(qr, { small: true });
    }

    if (connection === "close") {
      isConnected = false;
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log("Conexão fechada. Reconectar?", shouldReconnect);
      if (shouldReconnect) {
        connectToWhatsApp();
      } else {
        console.log("Sessão desconectada. Apague a pasta auth_info e rode novamente.");
      }
    } else if (connection === "open") {
      isConnected = true;
      latestQR = null;
      console.log("✅ WhatsApp conectado e pronto para enviar cobranças!");
    }
  });
}

async function sendChargeMessages(phone, text, pixCode) {
  const cleanPhone = String(phone).replace(/\D/g, "");
  const formatted = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
  const [result] = await sock.onWhatsApp(`${formatted}@s.whatsapp.net`);

  if (!result?.exists) throw new Error("Número não encontrado no WhatsApp");

  await sock.sendMessage(result.jid, { text });

  if (pixCode) {
    await new Promise((r) => setTimeout(r, 1500));
    await sock.sendMessage(result.jid, { text: pixCode });
  }
}

app.get("/status", (req, res) => {
  res.json({ connected: isConnected, hasQR: !!latestQR });
});

app.get("/api/qr-json", async (req, res) => {
  const key = req.headers["x-api-key"] || req.query.apiKey;
  if (key !== API_KEY) {
    return res.status(401).json({ error: "API Key inválida." });
  }

  if (isConnected) {
    return res.json({ connected: true, qrDataUrl: null });
  }

  if (!latestQR) {
    return res.json({ connected: false, qrDataUrl: null, waiting: true });
  }

  try {
    const qrDataUrl = await QRCode.toDataURL(latestQR, { width: 320, margin: 2 });
    return res.json({ connected: false, qrDataUrl });
  } catch (err) {
    return res.status(500).json({ error: "Falha ao gerar QR Code em base64." });
  }
});

app.post("/api/disconnect", async (req, res) => {
  const key = req.headers["x-api-key"];
  if (key !== API_KEY) {
    return res.status(401).json({ error: "API Key inválida." });
  }

  try {
    if (sock) {
      await sock.logout();
    }
    isConnected = false;
    latestQR = null;
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Erro ao desconectar." });
  }
});

app.get(["/", "/qr"], async (req, res) => {
  if (isConnected) {
    return res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>meufiadim-zap • Conectado</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #090D16; color: white; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
          .card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 28px; padding: 36px; max-width: 420px; width: 100%; text-align: center; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); }
          .badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 999px; background: rgba(16,185,129,0.15); color: #34d399; font-size: 13px; font-weight: 700; border: 1px solid rgba(16,185,129,0.3); margin-bottom: 16px; }
          .dot { width: 8px; height: 8px; border-radius: 50%; background: #10b981; }
          h1 { margin: 0 0 10px; font-size: 22px; font-weight: 800; }
          p { color: #94a3b8; font-size: 14px; margin: 0; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge"><span class="dot"></span> Online 24/7</div>
          <h1>WhatsApp Conectado!</h1>
          <p>O robô do <strong>meufiadim</strong> está ativo e pronto para disparar cobranças com Pix Copia e Cola.</p>
        </div>
      </body>
      </html>
    `);
  }

  if (!latestQR) {
    return res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="refresh" content="3">
        <title>meufiadim-zap • Gerando QR Code</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #090D16; color: white; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
          .card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 28px; padding: 36px; max-width: 420px; width: 100%; text-align: center; }
          h1 { font-size: 20px; margin: 0 0 8px; }
          p { color: #94a3b8; font-size: 14px; margin: 0; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Iniciando Baileys...</h1>
          <p>Aguarde alguns segundos, esta página vai atualizar automaticamente com o QR Code.</p>
        </div>
      </body>
      </html>
    `);
  }

  try {
    const qrDataUrl = await QRCode.toDataURL(latestQR, { width: 320, margin: 2 });
    return res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="refresh" content="20">
        <title>Conectar WhatsApp • meufiadim</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #090D16; color: white; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
          .card { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 32px; padding: 32px 24px; max-width: 380px; width: 100%; text-align: center; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.6); }
          h1 { margin: 0 0 6px; font-size: 20px; font-weight: 800; }
          p { color: #94a3b8; font-size: 13px; margin: 0 0 20px; line-height: 1.4; }
          .qr-box { background: white; padding: 12px; border-radius: 24px; display: inline-block; box-shadow: 0 10px 25px rgba(0,0,0,0.3); }
          .qr-box img { display: block; width: 280px; height: 280px; border-radius: 12px; }
          .steps { margin-top: 22px; text-align: left; background: rgba(0,0,0,0.25); padding: 14px 16px; border-radius: 18px; font-size: 12px; color: #cbd5e1; line-height: 1.6; }
          .steps strong { color: #34d399; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Conectar WhatsApp</h1>
          <p>Escaneie o QR Code abaixo com o WhatsApp do seu número de cobrança:</p>
          <div class="qr-box">
            <img src="${qrDataUrl}" alt="QR Code WhatsApp" />
          </div>
          <div class="steps">
            1. Abra o <strong>WhatsApp</strong> no celular<br>
            2. Toque em <strong>Aparelhos Conectados</strong><br>
            3. Toque em <strong>Conectar Aparelho</strong> e aponte para a tela
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    return res.status(500).send("Erro ao renderizar QR Code.");
  }
});

app.post("/send", async (req, res) => {
  const key = req.headers["x-api-key"];
  if (key !== API_KEY) {
    return res.status(401).json({ error: "API Key inválida." });
  }

  if (!isConnected || !sock) {
    return res.status(503).json({ error: "WhatsApp não está conectado." });
  }

  const { phone, text, pix } = req.body;
  if (!phone || !text) {
    return res.status(400).json({ error: "Informe phone e text." });
  }

  try {
    const pixCode = pix?.pixKey ? generatePixCopiaECola(pix) : null;
    await sendChargeMessages(phone, text, pixCode);
    return res.json({ ok: true });
  } catch (err) {
    console.error("Erro ao enviar:", err);
    return res.status(500).json({ error: err.message || "Falha ao enviar mensagem." });
  }
});

cron.schedule("0 9 * * *", async () => {
  if (!isConnected || !sock || !supabase) return;

  const today = new Date().toISOString().split("T")[0];
  console.log(`⏰ Verificando cobranças agendadas para ${today}...`);

  const { data: customers, error } = await supabase
    .from("customers")
    .select("*, stores(name, pix_key, pix_city, status)")
    .gt("balance", 0)
    .or(`notify_date.eq.${today},due_date.eq.${today}`)
    .neq("last_notified_at", today);

  if (error || !customers?.length) return;

  for (const c of customers) {
    if (c.stores?.status === "blocked") continue;

    try {
      const valor = Number(c.balance).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
      const vencimento = c.due_date
        ? new Date(`${c.due_date}T12:00:00`).toLocaleDateString("pt-BR")
        : "hoje";

      const msg = [
        `Olá, ${c.name}! Tudo bem?`,
        `Lembrete do seu fiado em aberto na *${c.stores.name}*:`,
        ``,
        `💰 *Valor:* ${valor}`,
        `📅 *Vencimento:* ${vencimento}`,
        ``,
        c.stores.pix_key
          ? `Para pagar agora, basta tocar em *"Copiar código Pix"* na mensagem abaixo 👇`
          : `Responda por aqui para combinarmos o acerto. Obrigado!`,
      ].join("\n");

      const pixCode = c.stores.pix_key
        ? generatePixCopiaECola({
            pixKey: c.stores.pix_key,
            merchantName: c.stores.name,
            merchantCity: c.stores.pix_city || "BRASIL",
            amount: c.balance,
          })
        : null;

      await sendChargeMessages(c.phone, msg, pixCode);

      await supabase
        .from("customers")
        .update({ last_notified_at: today })
        .eq("id", c.id);

      await new Promise((r) => setTimeout(r, 20000));
    } catch (err) {
      console.error(`Erro ao cobrar ${c.name}:`, err.message);
    }
  }
});

app.listen(PORT, () => {
  console.log(`🚀 API Baileys rodando na porta ${PORT}`);
  connectToWhatsApp();
});
