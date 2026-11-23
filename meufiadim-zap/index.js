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
const qrcode = require("qrcode-terminal");
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
      console.log("\n📱 Escaneie o QR Code abaixo no seu WhatsApp:");
      qrcode.generate(qr, { small: true });
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
  res.json({ connected: isConnected });
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
