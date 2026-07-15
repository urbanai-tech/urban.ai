export const SERVICE_WORKER_URL = "/sw.js";
export const SERVICE_WORKER_SCOPE = "/";

interface ServiceWorkerRegistrationPort {
  update: () => Promise<unknown>;
}

interface ServiceWorkerContainerPort {
  controller: unknown;
  register: (
    url: string,
    options: { scope: string; updateViaCache: "none" },
  ) => Promise<ServiceWorkerRegistrationPort>;
  getRegistration: (scope: string) => Promise<ServiceWorkerRegistrationPort | undefined>;
  addEventListener: (type: "controllerchange", listener: () => void) => void;
  removeEventListener: (type: "controllerchange", listener: () => void) => void;
}

interface DocumentPort {
  readyState: string;
  visibilityState: string;
  addEventListener: (type: "visibilitychange", listener: () => void) => void;
  removeEventListener: (type: "visibilitychange", listener: () => void) => void;
}

interface WindowPort {
  location: { reload: () => void };
  addEventListener: (type: "load" | "online", listener: () => void, options?: { once?: boolean }) => void;
  removeEventListener: (type: "load" | "online", listener: () => void) => void;
}

export interface PwaLifecycleOptions {
  serviceWorker: ServiceWorkerContainerPort;
  documentRef: DocumentPort;
  windowRef: WindowPort;
  onRegistered?: () => void | Promise<void>;
  onError?: (error: unknown) => void;
}

export function setupPwaLifecycle({
  serviceWorker,
  documentRef,
  windowRef,
  onRegistered,
  onError,
}: PwaLifecycleOptions): () => void {
  const hadController = Boolean(serviceWorker.controller);
  let disposed = false;
  let reloading = false;
  let updateInFlight: Promise<void> | null = null;

  const reportError = (error: unknown) => {
    if (!disposed) onError?.(error);
  };

  const requestUpdate = () => {
    if (disposed || updateInFlight) return updateInFlight;
    updateInFlight = serviceWorker
      .getRegistration(SERVICE_WORKER_SCOPE)
      .then((registration) => registration?.update())
      .then(() => undefined)
      .catch(reportError)
      .finally(() => {
        updateInFlight = null;
      });
    return updateInFlight;
  };

  const register = () => {
    if (disposed) return;
    serviceWorker
      .register(SERVICE_WORKER_URL, {
        scope: SERVICE_WORKER_SCOPE,
        updateViaCache: "none",
      })
      .then(async (registration) => {
        if (disposed) return;
        await onRegistered?.();
        await registration.update();
      })
      .catch(reportError);
  };

  const handleControllerChange = () => {
    if (!hadController || reloading || disposed) return;
    reloading = true;
    windowRef.location.reload();
  };
  const handleVisibilityChange = () => {
    if (documentRef.visibilityState === "visible") void requestUpdate();
  };
  const handleOnline = () => {
    void requestUpdate();
  };

  serviceWorker.addEventListener("controllerchange", handleControllerChange);
  documentRef.addEventListener("visibilitychange", handleVisibilityChange);
  windowRef.addEventListener("online", handleOnline);

  if (documentRef.readyState === "complete") register();
  else windowRef.addEventListener("load", register, { once: true });

  return () => {
    disposed = true;
    serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    documentRef.removeEventListener("visibilitychange", handleVisibilityChange);
    windowRef.removeEventListener("online", handleOnline);
    windowRef.removeEventListener("load", register);
  };
}
