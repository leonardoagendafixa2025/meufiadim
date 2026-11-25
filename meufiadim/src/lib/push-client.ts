"use client";

export function isBrowserPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

export function getBrowserNotificationPermission():
  | NotificationPermission
  | "unsupported" {
  if (!isBrowserPushSupported()) return "unsupported";
  return Notification.permission;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function uint8ArrayToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window
    .btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Registra /sw.js, solicita permissão do navegador e salva a assinatura Web Push na loja.
 */
export async function subscribeBrowserPush(params: {
  storeId: string;
  role: "merchant" | "customer";
  customerId?: string | null;
  authToken?: string | null;
}): Promise<{ ok: boolean; reason?: string }> {
  if (!isBrowserPushSupported()) {
    return { ok: false, reason: "Seu navegador não suporta notificações push." };
  }

  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") {
    return {
      ok: false,
      reason: "Permissão de notificação negada. Libere nas configurações do navegador.",
    };
  }

  const registration = await navigator.serviceWorker.register("/sw.js", {
    scope: "/",
  });
  await navigator.serviceWorker.ready;

  const keyRes = await fetch(
    `/api/push/subscribe?storeId=${encodeURIComponent(params.storeId)}`
  );
  const keyData = await keyRes.json();
  if (!keyRes.ok || !keyData?.publicKey) {
    return {
      ok: false,
      reason: keyData?.error || "Não foi possível obter a chave de notificações da loja.",
    };
  }

  const targetKey = String(keyData.publicKey);
  let subscription = await registration.pushManager.getSubscription();

  if (subscription?.options?.applicationServerKey) {
    const existingKey = uint8ArrayToBase64Url(
      new Uint8Array(subscription.options.applicationServerKey)
    );
    if (existingKey !== targetKey) {
      await subscription.unsubscribe();
      subscription = null;
    }
  }

  if (!subscription) {
    const applicationServerKey = urlBase64ToUint8Array(targetKey);
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey as unknown as BufferSource,
    });
  }

  const subJson = subscription.toJSON();
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(params.authToken ? { Authorization: `Bearer ${params.authToken}` } : {}),
    },
    body: JSON.stringify({
      storeId: params.storeId,
      role: params.role,
      customerId: params.customerId || null,
      subscription: {
        endpoint: subJson.endpoint,
        keys: subJson.keys,
      },
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    return { ok: false, reason: data?.error || "Erro ao registrar notificação no servidor." };
  }

  return { ok: true };
}

/**
 * Toca uma campainha dupla agradável ("ding-dong") via Web Audio API sem depender de arquivos MP3.
 */
export function playOrderBellChime(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const AudioCtx =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return false;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const notes = [
      { freq: 880, start: 0, duration: 0.22 },
      { freq: 1174.66, start: 0.16, duration: 0.38 },
    ];

    for (const note of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(note.freq, now + note.start);

      gain.gain.setValueAtTime(0.001, now + note.start);
      gain.gain.exponentialRampToValueAtTime(0.22, now + note.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + note.start + note.duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + note.start);
      osc.stop(now + note.start + note.duration + 0.02);
    }

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 900);
    return true;
  } catch {
    return false;
  }
}
