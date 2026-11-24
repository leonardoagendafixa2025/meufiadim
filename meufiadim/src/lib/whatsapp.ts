export function formatBRL(value: number): string {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/**
 * Retorna a URL base do serviço oficial de WhatsApp no Railway.
 * Corrige automaticamente casos onde o usuário configurou na Vercel sem o protocolo https://
 * ou apontando para localhost.
 */
export function getZapApiUrl(): string {
  let url = (process.env.ZAP_API_URL || "").trim();
  url = url.replace(/^['"]|['"]$/g, "").trim();

  if (!url || url.includes("localhost") || url.includes("127.0.0.1")) {
    return "https://meufiadim-production.up.railway.app";
  }

  // Se o usuário digitou ou colou apenas o domínio sem http:// ou https://
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }

  return url.replace(/\/$/, "");
}

/**
 * Retorna a chave de autenticação da API de WhatsApp.
 */
export function getZapApiKey(): string {
  return process.env.ZAP_API_KEY?.trim() || "minha-chave-secreta-meufiadim";
}
