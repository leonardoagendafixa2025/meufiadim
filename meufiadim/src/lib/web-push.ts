import { generateVAPIDKeys, sendNotification } from "web-push";
import { getSupabaseAdmin } from "@/lib/encomendas";

export type PushRole = "merchant" | "customer";

export interface PushSubscriptionPayload {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface StoredPushSubscription extends PushSubscriptionPayload {
  id?: string;
  storeId: string;
  role: PushRole;
  customerId?: string | null;
  userAgent?: string | null;
  updatedAt?: string;
}

const DEFAULT_VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || "mailto:suporte@meufiadimdigital.vercel.app";

/**
 * Retorna chaves VAPID para Web Push da loja:
 * 1) Prioriza variáveis de ambiente (NEXT_PUBLIC_VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY);
 * 2) Caso contrário, gera uma vez e persiste no metadata do dono da loja (zero-config).
 */
export async function getStoreVapidKeys(storeId: string): Promise<{
  publicKey: string;
  privateKey: string;
  subject: string;
} | null> {
  const envPublic = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "").trim();
  const envPrivate = (process.env.VAPID_PRIVATE_KEY || "").trim();
  if (envPublic && envPrivate) {
    return {
      publicKey: envPublic,
      privateKey: envPrivate,
      subject: DEFAULT_VAPID_SUBJECT,
    };
  }

  const supabase = getSupabaseAdmin();
  const { data: store } = await supabase
    .from("stores")
    .select("id, owner_id")
    .eq("id", storeId)
    .maybeSingle();

  if (!store?.owner_id) return null;

  const { data: ownerRes } = await supabase.auth.admin.getUserById(store.owner_id);
  const user = ownerRes?.user;
  if (!user) return null;

  const existing = user.user_metadata?.vapid_keys;
  if (existing?.publicKey && existing?.privateKey) {
    return {
      publicKey: String(existing.publicKey),
      privateKey: String(existing.privateKey),
      subject: DEFAULT_VAPID_SUBJECT,
    };
  }

  const generated = generateVAPIDKeys();
  await supabase.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...(user.user_metadata || {}),
      vapid_keys: {
        publicKey: generated.publicKey,
        privateKey: generated.privateKey,
        createdAt: new Date().toISOString(),
      },
    },
  });

  return {
    publicKey: generated.publicKey,
    privateKey: generated.privateKey,
    subject: DEFAULT_VAPID_SUBJECT,
  };
}

/**
 * Salva ou atualiza uma assinatura Web Push (SQL + espelho zero-downtime em user_metadata).
 */
export async function savePushSubscription(params: {
  storeId: string;
  role: PushRole;
  customerId?: string | null;
  subscription: PushSubscriptionPayload;
  userAgent?: string | null;
}): Promise<{ ok: boolean }> {
  const endpoint = String(params.subscription?.endpoint || "").trim();
  const p256dh = String(params.subscription?.keys?.p256dh || "").trim();
  const auth = String(params.subscription?.keys?.auth || "").trim();

  if (!endpoint || !p256dh || !auth) {
    throw new Error("Assinatura Web Push inválida.");
  }

  const supabase = getSupabaseAdmin();
  const nowIso = new Date().toISOString();

  // 1. Tenta persistir na tabela dedicada (caso SQL v4 já aplicado)
  try {
    await supabase.from("push_subscriptions").upsert(
      {
        store_id: params.storeId,
        role: params.role,
        customer_id: params.role === "customer" ? params.customerId || null : null,
        endpoint,
        p256dh,
        auth,
        user_agent: params.userAgent ? String(params.userAgent).slice(0, 180) : null,
        updated_at: nowIso,
      },
      { onConflict: "store_id,endpoint" }
    );
  } catch {
    // Fallback automático para user_metadata abaixo
  }

  // 2. Espelho enxuto no metadata do dono da loja (funciona antes mesmo da SQL v4)
  const { data: store } = await supabase
    .from("stores")
    .select("owner_id")
    .eq("id", params.storeId)
    .maybeSingle();

  if (store?.owner_id) {
    const { data: ownerRes } = await supabase.auth.admin.getUserById(store.owner_id);
    const ownerUser = ownerRes?.user;
    if (ownerUser) {
      const meta = ownerUser.user_metadata || {};
      const list: StoredPushSubscription[] = Array.isArray(meta.push_subscriptions)
        ? meta.push_subscriptions
        : [];

      const filtered = list.filter((item) => item.endpoint !== endpoint);
      filtered.push({
        storeId: params.storeId,
        role: params.role,
        customerId: params.role === "customer" ? params.customerId || null : null,
        endpoint,
        keys: { p256dh, auth },
        updatedAt: nowIso,
      });

      await supabase.auth.admin.updateUserById(ownerUser.id, {
        user_metadata: {
          ...meta,
          push_subscriptions: filtered.slice(-30),
        },
      });
    }
  }

  return { ok: true };
}

async function removeExpiredEndpoints(storeId: string, endpoints: string[]) {
  if (endpoints.length === 0) return;
  const expiredSet = new Set(endpoints);
  const supabase = getSupabaseAdmin();

  try {
    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("store_id", storeId)
      .in("endpoint", endpoints);
  } catch {
    // ignora caso tabela ainda não exista
  }

  const { data: store } = await supabase
    .from("stores")
    .select("owner_id")
    .eq("id", storeId)
    .maybeSingle();

  if (store?.owner_id) {
    const { data: ownerRes } = await supabase.auth.admin.getUserById(store.owner_id);
    const ownerUser = ownerRes?.user;
    if (ownerUser) {
      const meta = ownerUser.user_metadata || {};
      const list: StoredPushSubscription[] = Array.isArray(meta.push_subscriptions)
        ? meta.push_subscriptions
        : [];
      const next = list.filter((s) => !expiredSet.has(s.endpoint));
      if (next.length !== list.length) {
        await supabase.auth.admin.updateUserById(ownerUser.id, {
          user_metadata: { ...meta, push_subscriptions: next },
        });
      }
    }
  }
}

/**
 * Dispara notificações Web Push reais para os aparelhos inscritos do lojista ou de um cliente específico.
 */
export async function sendWebPushToStoreTarget(params: {
  storeId: string;
  role: PushRole;
  customerId?: string | null;
  title: string;
  body: string;
  url?: string;
  tag?: string;
}): Promise<{ attempted: number; sent: number; failed: number }> {
  try {
    const vapid = await getStoreVapidKeys(params.storeId);
    if (!vapid) return { attempted: 0, sent: 0, failed: 0 };

    const supabase = getSupabaseAdmin();
    const { data: store } = await supabase
      .from("stores")
      .select("owner_id")
      .eq("id", params.storeId)
      .maybeSingle();

    const byEndpoint = new Map<string, PushSubscriptionPayload>();

    // Lê assinaturas da tabela SQL (se existir)
    try {
      let query = supabase
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth, role, customer_id")
        .eq("store_id", params.storeId)
        .eq("role", params.role);

      if (params.role === "customer") {
        if (!params.customerId) return { attempted: 0, sent: 0, failed: 0 };
        query = query.eq("customer_id", params.customerId);
      }

      const { data: dbSubs, error: dbErr } = await query;
      if (!dbErr && Array.isArray(dbSubs)) {
        for (const sub of dbSubs) {
          if (sub.endpoint && sub.p256dh && sub.auth) {
            byEndpoint.set(sub.endpoint, {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            });
          }
        }
      }
    } catch {
      // fallback metadata
    }

    // Lê também assinaturas em user_metadata
    if (store?.owner_id) {
      const { data: ownerRes } = await supabase.auth.admin.getUserById(store.owner_id);
      const metaSubs: StoredPushSubscription[] = Array.isArray(
        ownerRes?.user?.user_metadata?.push_subscriptions
      )
        ? ownerRes!.user!.user_metadata.push_subscriptions
        : [];

      for (const sub of metaSubs) {
        if (sub.role !== params.role) continue;
        if (params.role === "customer" && sub.customerId !== params.customerId) continue;
        if (sub.endpoint && sub.keys?.p256dh && sub.keys?.auth) {
          byEndpoint.set(sub.endpoint, {
            endpoint: sub.endpoint,
            keys: sub.keys,
          });
        }
      }
    }

    const targets = Array.from(byEndpoint.values());
    if (targets.length === 0) {
      return { attempted: 0, sent: 0, failed: 0 };
    }

    const payload = JSON.stringify({
      title: params.title,
      body: params.body,
      url: params.url || "/",
      tag: params.tag || `meufiadim-${params.role}`,
      icon: "/logo.png",
      badge: "/logo.png",
    });

    let sent = 0;
    let failed = 0;
    const expired: string[] = [];

    const results = await Promise.allSettled(
      targets.map((sub) =>
        sendNotification(sub as any, payload, {
          TTL: 60 * 60 * 4,
          urgency: "high",
          vapidDetails: {
            subject: vapid.subject,
            publicKey: vapid.publicKey,
            privateKey: vapid.privateKey,
          },
        })
      )
    );

    results.forEach((res, idx) => {
      if (res.status === "fulfilled") {
        sent++;
      } else {
        failed++;
        const statusCode = Number((res.reason as any)?.statusCode || 0);
        if (statusCode === 404 || statusCode === 410) {
          expired.push(targets[idx].endpoint);
        }
      }
    });

    if (expired.length > 0) {
      await removeExpiredEndpoints(params.storeId, expired);
    }

    return { attempted: targets.length, sent, failed };
  } catch (err) {
    console.warn("Aviso ao enviar Web Push:", err);
    return { attempted: 0, sent: 0, failed: 0 };
  }
}
