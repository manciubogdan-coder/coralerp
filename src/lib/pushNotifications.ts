// Helpers pentru Web Push notifications.
// Service worker-ul `/sw-push.js` se înregistrează DOAR în producție și NU în iframe-ul Lovable
// (altfel ar bloca preview-ul). Vezi memory-ul proiectului despre PWA.

import { supabase } from "@/integrations/supabase/client";

// Cheia VAPID publică (NU e secretă; e safe în client)
const VAPID_PUBLIC_KEY =
  "BEmABGwlMAirCHjJux58gCgDxro_Finw-CLb-fp-w0M81tgWED9-Fvs81MoCljttfK_PFFhjLvfsrEuOM32O7rM";

const SW_PATH = "/sw-push.js";

const isInIframe = () => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
};

const isLovableEditorPreview = () => {
  const h = window.location.hostname;
  return h.includes("id-preview--") && h.includes("lovableproject.com");
};

export const isPushSupported = (): boolean => {
  if (typeof window === "undefined") return false;
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
};

/** Permitem doar pe device-uri reale, NU în iframe-ul Lovable Editor (care bagă SW-ul în baga lui). */
export const isPushAllowedHere = (): boolean => {
  if (!isPushSupported()) return false;
  if (isLovableEditorPreview() && isInIframe()) return false;
  return true;
};

export const getPermissionState = (): NotificationPermission => {
  if (!isPushSupported()) return "denied";
  return Notification.permission;
};

const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
};

const arrayBufferToBase64 = (buffer: ArrayBuffer | null): string => {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

const registerSW = async (): Promise<ServiceWorkerRegistration> => {
  // Folosim un scope explicit ca să NU intre în coliziune cu eventuale alte SW-uri
  const reg = await navigator.serviceWorker.register(SW_PATH, { scope: "/" });
  await navigator.serviceWorker.ready;
  return reg;
};

const detectDeviceLabel = (): string => {
  const ua = navigator.userAgent;
  if (/iPad/i.test(ua)) return "iPad";
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/Android.*Tablet|Tablet.*Android/i.test(ua)) return "Tabletă Android";
  if (/Android/i.test(ua)) return "Telefon Android";
  if (/Windows/i.test(ua)) return "Windows PC";
  if (/Mac/i.test(ua)) return "Mac";
  if (/Linux/i.test(ua)) return "Linux PC";
  return "Acest dispozitiv";
};

export interface SubscribeResult {
  ok: boolean;
  endpoint?: string;
  error?: string;
}

/** Cere permisiune, se abonează la push și salvează subscription-ul în DB. */
export const enablePushOnThisDevice = async (
  customLabel?: string
): Promise<SubscribeResult> => {
  if (!isPushAllowedHere()) {
    return { ok: false, error: "Push nu e disponibil în această fereastră (preview Lovable). Deschide aplicația publicată." };
  }

  // 1. Permisiune
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, error: "Permisiunea pentru notificări a fost refuzată." };
  }

  // 2. Înregistrare service worker
  const reg = await registerSW();

  // 3. Subscribe la push
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const json = sub.toJSON();
  const endpoint = json.endpoint || sub.endpoint;
  const p256dh = json.keys?.p256dh ?? arrayBufferToBase64(sub.getKey("p256dh"));
  const auth = json.keys?.auth ?? arrayBufferToBase64(sub.getKey("auth"));

  if (!endpoint || !p256dh || !auth) {
    return { ok: false, error: "Browserul nu a returnat cheile de criptare." };
  }

  // 4. Salvează în DB
  const { error } = await (supabase as any).rpc("register_push_subscription", {
    p_endpoint: endpoint,
    p_p256dh: p256dh,
    p_auth: auth,
    p_device_label: customLabel || detectDeviceLabel(),
    p_user_agent: navigator.userAgent,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, endpoint };
};

/** Dezabonează acest device. */
export const disablePushOnThisDevice = async (): Promise<SubscribeResult> => {
  if (!isPushSupported()) return { ok: false, error: "Nu e suportat" };
  try {
    const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      await (supabase as any).rpc("delete_push_subscription", { p_endpoint: endpoint });
      return { ok: true, endpoint };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message };
  }
};

/** Verifică dacă acest device e abonat acum. */
export const isThisDeviceSubscribed = async (): Promise<boolean> => {
  if (!isPushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
    const sub = await reg?.pushManager.getSubscription();
    return !!sub;
  } catch {
    return false;
  }
};

/** Curăță badge-ul de pe iconița aplicației (când userul deschide app-ul). */
export const clearAppBadge = async () => {
  try {
    // @ts-ignore
    if ("clearAppBadge" in navigator) await (navigator as any).clearAppBadge();
  } catch {}
};

/** Setează un număr pe badge (ex: număr notificări necitite). */
export const setAppBadge = async (count: number) => {
  try {
    // @ts-ignore
    if ("setAppBadge" in navigator) await (navigator as any).setAppBadge(count);
  } catch {}
};
