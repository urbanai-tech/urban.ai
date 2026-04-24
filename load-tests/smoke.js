import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'https://staging-api.myurbanai.com';

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<2000'],
  },
};

export default function () {
  // 1) Health check (deveria existir em /health — criado em F4.1)
  const health = http.get(`${BASE_URL}/health`);
  check(health, {
    'health 200': (r) => r.status === 200,
    'health rápido': (r) => r.timings.duration < 500,
  });

  sleep(1);

  // 2) Landing page do backend (swagger HTML é leve)
  const swagger = http.get(`${BASE_URL}/api`);
  check(swagger, {
    'swagger 200 ou 301': (r) => [200, 301, 302].includes(r.status),
  });

  sleep(1);

  // 3) Plans list (endpoint público)
  const plans = http.get(`${BASE_URL}/plans`);
  check(plans, {
    'plans responde': (r) => [200, 401, 404].includes(r.status),
  });

  sleep(1);
}
