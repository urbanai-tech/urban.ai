import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

const BASE_URL = __ENV.BASE_URL || 'https://staging-api.myurbanai.com';
const EMAIL_PREFIX = __ENV.TEST_EMAIL_PREFIX || 'loadtest+';
const PASSWORD = __ENV.TEST_PASSWORD || 'change-me-in-env';
const USER_COUNT = parseInt(__ENV.USER_COUNT || '100', 10);

// Pool de usuários pré-cadastrados em staging (ver load-tests/README.md).
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
    { duration: '1m', target: 25 },   // ramp-up
    { duration: '3m', target: 50 },   // sustentado 50 VUs
    { duration: '1m', target: 0 },    // ramp-down
  ],
  thresholds: {
    http_req_failed: ['rate<0.02'],       // <2% erro
    http_req_duration: [
      'p(50)<300',
      'p(95)<1000',
      'p(99)<3000',
    ],
    checks: ['rate>0.98'],
  },
};

export default function () {
  const user = users[Math.floor(Math.random() * users.length)];

  // 1) Login
  const loginRes = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: user.email, password: user.password }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  const loginOk = check(loginRes, {
    'login 201': (r) => r.status === 201 || r.status === 200,
    'login tem accessToken': (r) => {
      try {
        const body = r.json();
        return !!body.accessToken;
      } catch {
        return false;
      }
    },
  });

  if (!loginOk) {
    sleep(1);
    return;
  }

  const token = loginRes.json('accessToken');
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  sleep(Math.random() * 2 + 0.5);

  // 2) Profile
  const profile = http.get(`${BASE_URL}/auth/profile`, { headers: authHeaders });
  check(profile, {
    'profile 200': (r) => r.status === 200,
    'profile tem email': (r) => {
      try {
        return !!r.json('email');
      } catch {
        return false;
      }
    },
  });

  sleep(Math.random() * 2 + 0.5);

  // 3) Dashboard (listar imóveis)
  const properties = http.get(`${BASE_URL}/propriedades`, { headers: authHeaders });
  check(properties, {
    'propriedades 200': (r) => r.status === 200,
  });

  sleep(Math.random() * 3 + 1);
}
