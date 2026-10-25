"use client";

import { api } from "./api";
import { parseStoredDevice, toPersistedDeviceRef, type PushDeviceRef } from "./pwaPushStorage";

const STORAGE_KEY = "urban_ai_push_device";

export type PwaPushSnapshot = {
  supported: boolean;
  enabled: boolean;
  permission: NotificationPermission | "unsupported";
  subscribed: boolean;
  reason?: string;
};

type PushPublicConfig = {
  enabled: boolean;
  publicKey: string | null;
};

type StoredPushDeviceConfig = PushDeviceRef;

type PushDeviceConfigWithSecret = PushDeviceRef & { secret: string };

type BackendSubscriptionResponse = {
  ok: true;
  deviceId: string;
  secret: string;
  enabled: boolean;
};

export function isPwaPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

export async function getPwaPushSnapshot(): Promise<PwaPushSnapshot> {
  if (!isPwaPushSupported()) {
    return {
      supported: false,
      enabled: false,
      permission: "unsupported",
      subscribed: false,
      reason: "unsupported",
    };
  }

  const config = await getPushPublicConfig().catch(() => ({ enabled: false, publicKey: null }));
  const registration = await ensureServiceWorkerRegistration().catch(() => null);
  const subscription = await registration?.pushManager.getSubscription();
  const stored = readStoredConfig();

  return {
    supported: true,
    enabled: Boolean(config.enabled && config.publicKey),
    permission: Notification.permission,
    subscribed: Boolean(subscription && stored?.deviceId),
    reason: config.enabled ? undefined : "backend_disabled",
  };
}

export async function subscribeToPwaPush(): Promise<PwaPushSnapshot> {
  if (!isPwaPushSupported()) {
    throw new Error("Push PWA não suportado neste navegador");
  }

  const config = await getPushPublicConfig();
  if (!config.enabled || !config.publicKey) {
    throw new Error("Push PWA ainda não está configurado no backend");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return getPwaPushSnapshot();
  }

  const registration = await ensureServiceWorkerRegistration();
  const existingSubscription = await registration.pushManager.getSubscription();
  const subscription =
    existingSubscription ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToArrayBuffer(config.publicKey),
    }));

  const serialized = subscription.toJSON() as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  const stored = readStoredConfig();
  const response = await api.post<BackendSubscriptionResponse>("/push/subscriptions", {
    deviceId: stored?.deviceId,
    endpoint: serialized.endpoint,
    keys: {
      p256dh: serialized.keys?.p256dh,
      auth: serialized.keys?.auth,
    },
    platform: navigator.platform || undefined,
  });

  const deviceConfig: PushDeviceConfigWithSecret = {
    apiBaseUrl: process.env.NEXT_PUBLIC_API_URL || "",
    deviceId: response.data.deviceId,
    secret: response.data.secret,
  };
  // O secret vai só para o Service Worker; o localStorage guarda apenas a referência.
  storeConfig({ apiBaseUrl: deviceConfig.apiBaseUrl, deviceId: deviceConfig.deviceId });
  await postConfigToServiceWorker(deviceConfig);

  return getPwaPushSnapshot();
}

export async function unsubscribeFromPwaPush(): Promise<PwaPushSnapshot> {
  if (!isPwaPushSupported()) return getPwaPushSnapshot();

  const registration = await ensureServiceWorkerRegistration().catch(() => null);
  const subscription = await registration?.pushManager.getSubscription();
  const stored = readStoredConfig();

  await api.delete("/push/subscriptions", {
    data: {
      endpoint: subscription?.endpoint,
      deviceId: stored?.deviceId,
    },
  }).catch(() => undefined);

  await subscription?.unsubscribe().catch(() => false);
  clearStoredConfig();
  await postConfigToServiceWorker(null);
  return getPwaPushSnapshot();
}

export async function sendPwaPushTest() {
  const { data } = await api.post("/push/test");
  return data;
}

export async function syncStoredPushConfigWithServiceWorker(): Promise<void> {
  if (!isPwaPushSupported()) return;
  const { ref, legacySecret } = parseStoredDevice(readRawStoredConfig());
  if (!ref) return;
  await ensureServiceWorkerRegistration();
  if (legacySecret) {
    // Migração: versões antigas guardavam o secret em localStorage. Passa para o SW e apaga de lá.
    await postConfigToServiceWorker({ ...ref, secret: legacySecret });
    window.localStorage.setItem(STORAGE_KEY, toPersistedDeviceRef(ref));
  }
}

async function getPushPublicConfig(): Promise<PushPublicConfig> {
  const { data } = await api.get<PushPublicConfig>("/push/public-key");
  return data;
}

async function ensureServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;
  await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  return navigator.serviceWorker.ready;
}

async function postConfigToServiceWorker(config: PushDeviceConfigWithSecret | null): Promise<void> {
  const registration = await navigator.serviceWorker.ready;
  const message = config
    ? { type: "URBAN_PUSH_CONFIG", config }
    : { type: "URBAN_PUSH_CONFIG_CLEAR" };
  registration.active?.postMessage(message);
  navigator.serviceWorker.controller?.postMessage(message);
}

function readRawStoredConfig(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function readStoredConfig(): StoredPushDeviceConfig | null {
  return parseStoredDevice(readRawStoredConfig()).ref;
}

function storeConfig(config: PushDeviceRef): void {
  window.localStorage.setItem(STORAGE_KEY, toPersistedDeviceRef(config));
}

function clearStoredConfig(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}

function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray.buffer.slice(0);
}
