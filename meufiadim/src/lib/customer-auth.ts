import crypto from "crypto";

const TOKEN_SECRET =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "meufiadim-customer-auth-token-key-2026";

/**
 * Remove formatação e caracteres não numéricos do telefone.
 */
export function cleanPhone(phone: string): string {
  return (phone || "").replace(/\D/g, "");
}

/**
 * Formata telefone brasileiro para exibição legível (ex: (11) 99999-9999).
 */
export function formatPhoneBR(phone: string): string {
  const digits = cleanPhone(phone);
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

/**
 * Gera hash seguro com salt aleatório usando PBKDF2 SHA-512.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Valida a senha comparando com o hash e salt armazenados de forma timing-safe.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || typeof storedHash !== "string" || !storedHash.includes(":")) {
    return false;
  }
  try {
    const [salt, originalHash] = storedHash.split(":");
    if (!salt || !originalHash) return false;
    const computed = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
    const bufA = Buffer.from(computed, "hex");
    const bufB = Buffer.from(originalHash, "hex");
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Gera um token assinado simples para a sessão do cliente na vitrine.
 */
export function createCustomerSessionToken(payload: {
  customerId: string;
  storeId: string;
  phone: string;
}): string {
  const data = JSON.stringify({
    ...payload,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 30, // 30 dias
  });
  const dataB64 = Buffer.from(data).toString("base64url");
  const signature = crypto
    .createHmac("sha256", TOKEN_SECRET)
    .update(dataB64)
    .digest("base64url");
  return `${dataB64}.${signature}`;
}

/**
 * Valida o token assinado da sessão do cliente.
 */
export function verifyCustomerSessionToken(
  token: string
): { customerId: string; storeId: string; phone: string } | null {
  if (!token || !token.includes(".")) return null;
  try {
    const [dataB64, signature] = token.split(".");
    if (!dataB64 || !signature) return null;
    const expectedSig = crypto
      .createHmac("sha256", TOKEN_SECRET)
      .update(dataB64)
      .digest("base64url");
    if (signature !== expectedSig) return null;
    const json = JSON.parse(Buffer.from(dataB64, "base64url").toString("utf8"));
    if (json.exp && json.exp < Date.now()) return null;
    return {
      customerId: json.customerId,
      storeId: json.storeId,
      phone: json.phone,
    };
  } catch {
    return null;
  }
}
