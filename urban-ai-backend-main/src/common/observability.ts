import { randomUUID } from 'crypto';

const REDACTED = '[REDACTED]';
const SENSITIVE_KEY = /(?:password|passwd|secret|token|authorization|cookie|dsn|api[_-]?key|client[_-]?secret|card[_-]?number|cpf)/i;
const PII_KEY = /^(?:email|phone|telephone|username|ip_address|remote_addr)$/i;
const VALID_REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;
const UNSAFE_REQUEST_ID = /@|^(?:Bearer|Basic)[ .:_-]|^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./i;

export type ObservabilityRuntime = {
  environment: string;
  release: string;
};

export function resolveObservabilityRuntime(
  env: NodeJS.ProcessEnv = process.env,
): ObservabilityRuntime {
  return {
    environment: env.APP_ENV || env.NODE_ENV || 'development',
    release:
      env.SENTRY_RELEASE ||
      env.RAILWAY_GIT_COMMIT_SHA ||
      env.GITHUB_SHA ||
      env.npm_package_version ||
      'unknown',
  };
}

export function normalizeRequestId(
  raw: string | string[] | undefined,
  fallback: () => string = randomUUID,
): string {
  const candidate = (Array.isArray(raw) ? raw[0] : raw)?.trim() || '';
  return VALID_REQUEST_ID.test(candidate) && !UNSAFE_REQUEST_ID.test(candidate)
    ? candidate
    : fallback();
}

export function redactObservabilityData<T>(value: T): T {
  return redactValue(value, new WeakSet()) as T;
}

function redactValue(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === 'string') return redactString(value);
  if (Array.isArray(value)) return value.map((item) => redactValue(item, seen));
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return '[CIRCULAR]';
  seen.add(value);

  const result: Record<string, unknown> = {};
  for (const [key, candidate] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(key) || PII_KEY.test(key)) result[key] = REDACTED;
    else result[key] = redactValue(candidate, seen);
  }
  seen.delete(value);
  return result;
}

function redactString(value: string): string {
  return value
    .replace(/(mysql2?:\/\/)([^:\s/@]+):([^@\s/]+)@/gi, '$1[REDACTED]:[REDACTED]@')
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/-]+=*/gi, '$1 [REDACTED]')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[REDACTED_EMAIL]')
    .replace(/([?&](?:token|secret|key|password|authorization)=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/\b((?:api[_-]?key|access[_-]?token|auth[_-]?token|password|secret|token)=)[^\s&]+/gi, '$1[REDACTED]')
    .replace(/\b(cookie|set-cookie|authorization):\s*[^\s,;]+/gi, '$1: [REDACTED]')
    .replace(/\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9_-]+\b/g, '[REDACTED_KEY]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED_JWT]');
}

export function safeRouteTemplate(req: {
  baseUrl?: string;
  route?: { path?: string };
  path?: string;
}): string {
  const template = `${req.baseUrl || ''}${req.route?.path || req.path || '/'}`;
  return redactString(template.split('?')[0]).slice(0, 240);
}
