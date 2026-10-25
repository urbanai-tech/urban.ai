/**
 * Persistência do dispositivo de push no navegador.
 *
 * O `secret` do dispositivo NUNCA vai para o localStorage (texto claro,
 * legível por qualquer script da origem). Ele vive apenas no Cache Storage do
 * Service Worker (ver public/sw.js). No localStorage guardamos só a referência
 * não sensível (apiBaseUrl + deviceId).
 */

export type PushDeviceRef = {
  apiBaseUrl: string;
  deviceId: string;
};

export type ParsedStoredDevice = {
  ref: PushDeviceRef | null;
  /** Secret de versões antigas, que gravavam tudo em localStorage; deve ser migrado para o SW. */
  legacySecret: string | null;
};

export function toPersistedDeviceRef(config: PushDeviceRef): string {
  const ref: PushDeviceRef = { apiBaseUrl: config.apiBaseUrl, deviceId: config.deviceId };
  return JSON.stringify(ref);
}

export function parseStoredDevice(raw: string | null): ParsedStoredDevice {
  if (!raw) return { ref: null, legacySecret: null };
  try {
    const parsed = JSON.parse(raw) as Partial<PushDeviceRef> & { secret?: unknown };
    if (!parsed || typeof parsed.deviceId !== "string" || !parsed.deviceId) {
      return { ref: null, legacySecret: null };
    }
    return {
      ref: {
        apiBaseUrl: typeof parsed.apiBaseUrl === "string" ? parsed.apiBaseUrl : "",
        deviceId: parsed.deviceId,
      },
      legacySecret: typeof parsed.secret === "string" && parsed.secret ? parsed.secret : null,
    };
  } catch {
    return { ref: null, legacySecret: null };
  }
}
