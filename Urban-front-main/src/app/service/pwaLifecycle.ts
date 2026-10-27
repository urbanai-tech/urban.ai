export const SERVICE_WORKER_URL = "/sw.js";
export const SERVICE_WORKER_SCOPE = "/";
export const SKIP_WAITING_MESSAGE = "URBAN_SKIP_WAITING";

interface WorkerPort {
  state?: string;
  postMessage: (message: unknown) => void;
  addEventListener?: (type: "statechange", listener: () => void) => void;
}

interface ServiceWorkerRegistrationPort {
  update: () => Promise<unknown>;
  waiting?: WorkerPort | null;
  installing?: WorkerPort | null;
  addEventListener?: (type: "updatefound", listener: () => void) => void;
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
  /**
   * Chamado quando há uma versão nova instalada esperando. `apply()` pede a ativação
   * (skipWaiting) e a página recarrega no `controllerchange`. Nunca dispara na 1ª instalação.
   */
  onUpdateReady?: (apply: () => void) => void;
  onError?: (error: unknown) => void;
}

export function setupPwaLifecycle({
  serviceWorker,
  documentRef,
  windowRef,
  onRegistered,
  onUpdateReady,
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

  const announceUpdate = (worker: WorkerPort | null | undefined) => {
    if (disposed || !hadController || !worker || !onUpdateReady) return;
    onUpdateReady(() => worker.postMessage({ type: SKIP_WAITING_MESSAGE }));
  };

  const watchRegistration = (registration: ServiceWorkerRegistrationPort) => {
    announceUpdate(registration.waiting);
    registration.addEventListener?.("updatefound", () => {
      const installing = registration.installing;
      installing?.addEventListener?.("statechange", () => {
        if (installing.state === "installed") announceUpdate(registration.waiting ?? installing);
      });
    });
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
        watchRegistration(registration);
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
