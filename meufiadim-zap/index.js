require("dotenv").config();
const fs = require("fs");
const path = require("path");
const http = require("http");
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

// Tratamento global para impedir encerramento abrupto do processo
process.on("uncaughtException", (err) => {
  console.error("🔥 Erro não tratado (uncaughtException):", err?.message || err);
});
process.on("unhandledRejection", (reason) => {
  console.error("🔥 Promise rejeitada (unhandledRejection):", reason);
});

const app = express();
app.use(express.json());

// Habilita CORS completo para chamadas diretas do painel SuperAdmin
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

const MAIN_PORT = parseInt(process.env.PORT || "8080", 10);
const API_KEY = process.env.API_KEY || "minha-chave-secreta-meufiadim";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

const AUTH_DIR = path.resolve("./auth_info");
const BUCKET = "whatsapp-session";

// 1. Restaura a sessão do Supabase Storage no boot
async function restoreSessionFromSupabase() {
  if (!supabase) return;
  try {
    console.log("🔄 Verificando sessão salva no Supabase Storage...");
    const { data: files, error } = await supabase.storage.from(BUCKET).list();
    if (error || !files || files.length === 0) {
      console.log("ℹ️ Nenhuma sessão anterior encontrada no Supabase. Aguardando novo QR Code...");
      return;
    }

    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }

    for (const file of files) {
      if (!file.name || file.name === ".emptyFolderPlaceholder") continue;
      const { data, error: dlErr } = await supabase.storage.from(BUCKET).download(file.name);
      if (data && !dlErr) {
        const buffer = Buffer.from(await data.arrayBuffer());
        fs.writeFileSync(path.join(AUTH_DIR, file.name), buffer);
      }
    }
    console.log(`✅ Sessão restaurada com sucesso (${files.length} arquivos sincronizados)!`);
  } catch (err) {
    console.warn("⚠️ Aviso ao restaurar sessão:", err?.message || err);
  }
}

// 2. Salva todos os arquivos de sessão no Supabase Storage (com debounce)
let syncTimeout = null;
function scheduleSessionBackup() {
  if (!supabase) return;
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(async () => {
    try {
      if (!fs.existsSync(AUTH_DIR)) return;
      const files = fs.readdirSync(AUTH_DIR);
      for (const fileName of files) {
        const filePath = path.join(AUTH_DIR, fileName);
        if (fs.statSync(filePath).isFile()) {
          const content = fs.readFileSync(filePath);
          await supabase.storage.from(BUCKET).upload(fileName, content, { upsert: true });
        }
      }
      console.log("☁️ Sessão sincronizada no Supabase Storage com sucesso!");
    } catch (err) {
      console.warn("⚠️ Falha ao fazer backup da sessão:", err?.message || err);
    }
  }, 2500);
}

// 3. Limpa a sessão no Supabase quando desconectar
async function clearSessionFromSupabase() {
  if (!supabase) return;
  try {
    const { data: files } = await supabase.storage.from(BUCKET).list();
    if (files && files.length > 0) {
      const fileNames = files.map((f) => f.name).filter(Boolean);
      await supabase.storage.from(BUCKET).remove(fileNames);
    }
    console.log("🗑️ Sessão apagada do Supabase Storage com sucesso.");
  } catch (err) {
    console.warn("⚠️ Falha ao limpar sessão no Supabase:", err?.message || err);
  }
}

let sock = null;
let isConnected = false;
let latestQR = null;

async function connectToWhatsApp() {
  try {
    await restoreSessionFromSupabase();

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    
    // Versão padrão segura caso a chamada de rede falhe
    let version = [2, 3000, 1015901307];
    try {
      const v = await fetchLatestBaileysVersion();
      if (v?.version) version = v.version;
    } catch (verErr) {
      console.warn("⚠️ Aviso: Usando versão estável do motor:", verErr.message);
    }

    sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: "silent" }),
      printQRInTerminal: false,
    });

    sock.ev.on("creds.update", async () => {
      await saveCreds();
      scheduleSessionBackup();
    });

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        latestQR = qr;
        console.log("\n📱 Novo QR Code gerado!");
        qrcodeTerminal.generate(qr, { small: true });
      }

      if (connection === "close") {
        isConnected = false;
        latestQR = null;
        const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        console.log("Conexão fechada. Reconectar?", shouldReconnect, "Status:", statusCode);
        if (shouldReconnect) {
          setTimeout(connectToWhatsApp, 3000);
        } else {
          console.log("Sessão desconectada/expirada. Limpando auth_info para novo QR...");
          try {
            fs.rmSync(AUTH_DIR, { recursive: true, force: true });
          } catch (e) {}
          await clearSessionFromSupabase();
          setTimeout(connectToWhatsApp, 3000);
        }
      } else if (connection === "open") {
        isConnected = true;
        latestQR = null;
        console.log("✅ WhatsApp conectado e pronto para enviar cobranças!");
        scheduleSessionBackup();
      }
    });
  } catch (err) {
    console.error("Erro ao inicializar WhatsApp:", err?.message || err);
    setTimeout(connectToWhatsApp, 5000);
  }
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
      try {
        await sock.logout();
      } catch (e) {}
      try {
        sock.end();
      } catch (e) {}
    }
    isConnected = false;
    latestQR = null;
    try {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    } catch (e) {}
    await clearSessionFromSupabase();
    setTimeout(connectToWhatsApp, 2000);
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
        <title>MeuFiadim • WhatsApp Conectado</title>
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
        <title>MeuFiadim • Gerando QR Code</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #090D16; color: white; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
          .card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 28px; padding: 36px; max-width: 420px; width: 100%; text-align: center; }
          h1 { font-size: 20px; margin: 0 0 8px; }
          p { color: #94a3b8; font-size: 14px; margin: 0; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Iniciando serviço de WhatsApp...</h1>
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
        <title>Conectar WhatsApp • MeuFiadim</title>
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
          <p>Escaneie o QR Code abaixo com o WhatsApp do número oficial de cobrança:</p>
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
            merchantCity: c.stores.pix_city || "BRASILIA",
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

// Listener em todas as portas prováveis para compatibilidade total com o Railway
const ports = Array.from(new Set([MAIN_PORT, 8080, 3001]));
ports.forEach((port) => {
  try {
    const s = http.createServer(app);
    s.listen(port, "0.0.0.0", () => {
      console.log(`🚀 API WhatsApp ativa em 0.0.0.0:${port}`);
    });
    s.on("error", (e) => {
      if (e.code !== "EADDRINUSE") {
        console.warn(`Aviso porta ${port}:`, e.message);
      }
    });
  } catch (err) {
    console.warn(`Porta ${port} não iniciada:`, err?.message || err);
  }
});

// Inicia conexão do WhatsApp
connectToWhatsApp();
