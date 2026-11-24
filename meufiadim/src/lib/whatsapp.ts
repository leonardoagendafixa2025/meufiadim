export function formatBRL(value: number): string {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/**
 * Retorna a URL base do serviço oficial de WhatsApp no Railway.
 * Caso a variável esteja indefinida ou apontando para localhost, utiliza o endpoint oficial em nuvem.
 */
export function getZapApiUrl(): string {
  const url = process.env.ZAP_API_URL?.trim();
  if (!url || url.includes("localhost") || url.includes("127.0.0.1")) {
    return "https://meufiadim-production.up.railway.app";
  }
  return url.replace(/\/$/, "");
}

/**
 * Retorna a chave de autenticação da API de WhatsApp.
 */
export function getZapApiKey(): string {
  return process.env.ZAP_API_KEY?.trim() || "minha-chave-secreta-meufiadim";
}
