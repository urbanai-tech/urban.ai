const STAGING_HOST_PATTERN = /^https:\/\/staging[-.]/i;
const LOCAL_HOST_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i;

export function requireBaseUrl() {
  const baseUrl = (__ENV.BASE_URL || '').trim().replace(/\/+$/, '');
  if (!baseUrl) {
    throw new Error('BASE_URL is required. Point k6 at staging or localhost explicitly.');
  }
  if (!STAGING_HOST_PATTERN.test(baseUrl) && !LOCAL_HOST_PATTERN.test(baseUrl)) {
    throw new Error(`Refusing load test target outside staging/local: ${baseUrl}`);
  }
  return baseUrl;
}

export function requireTestPassword() {
  const password = (__ENV.TEST_PASSWORD || '').trim();
  if (!password || password === 'change-me-in-env') {
    throw new Error('TEST_PASSWORD is required for authenticated load tests.');
  }
  return password;
}

export function getUserCount(defaultValue = 100) {
  const parsed = parseInt(__ENV.USER_COUNT || `${defaultValue}`, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`USER_COUNT must be a positive integer. Received: ${__ENV.USER_COUNT}`);
  }
  return parsed;
}
