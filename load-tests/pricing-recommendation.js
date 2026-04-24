import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

/**
 * Cenário CRÍTICO do SLO: 100 anfitriões simultâneos pedindo recomendação
 * de preço. Exercita auth, fetch de imóveis, análise de preço (KNN + ISochrone)
 * e persistência em `analise_preco`.
 *
 * Requer usuários + imóveis pré-cadastrados em staging (ver README).
 */

const BASE_URL = __ENV.BASE_URL || 'https://staging-api.myurbanai.com';
const EMAIL_PREFIX = __ENV.TEST_EMAIL_PREFIX || 'loadtest+';
const PASSWORD = __ENV.TEST_PASSWORD || 'change-me-in-env';
const USER_COUNT = parseInt(__ENV.USER_COUNT || '100', 10);

const users = new SharedArray('users', function () {
  const list = [];
  for (let i = 0; i < USER_COUNT; i++) {
    list.push({
      email: `${EMAIL_PREFIX}${i}@urbanai.test`,
      password: PASSWORD,
    });
  }
  return list;
});

export const options = {
  stages: [
    { duration: '2m', target: 50 },    // ramp-up suave
    { duration: '8m', target: 100 },   // pico 100 VUs
    { duration: '2m', target: 100 },   // sustenta pico
    { duration: '1m', target: 0 },     // ramp-down
  ],
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: [
      'p(50)<500',       // pricing tem KNN + isochrone, um pouco mais largo
      'p(95)<2000',
      'p(99)<5000',
    ],
    checks: ['rate>0.97'],
  },
};

export default function () {
  const user = users[Math.floor(Math.random() * users.length)];

  // Login
  const loginRes = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: user.email, password: user.password }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  if (loginRes.status >= 400) {
    sleep(2);
    return;
  }
  const token = loginRes.json('accessToken');
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  sleep(Math.random() + 0.5);

  // Buscar imóveis do usuário
  const listRes = http.get(`${BASE_URL}/propriedades`, { headers });
  check(listRes, { 'propriedades 200': (r) => r.status === 200 });

  let properties = [];
  try {
    properties = listRes.json('data') || [];
  } catch {
    /* noop */
  }

  if (properties.length === 0) {
    sleep(1);
    return;
  }

  const property = properties[Math.floor(Math.random() * properties.length)];

  sleep(Math.random() + 0.5);

  // Solicitar recomendação de preço — este é o caminho quente do KNN
  const pricing = http.post(
    `${BASE_URL}/propriedades/${property.id}/analise-preco`,
    JSON.stringify({}),
    { headers },
  );
  check(pricing, {
    'pricing 200 ou 201': (r) => [200, 201].includes(r.status),
    'pricing < 3s': (r) => r.timings.duration < 3000,
  });

  sleep(Math.random() * 2 + 1);
}
