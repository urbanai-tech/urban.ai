const test = require('node:test');
const assert = require('node:assert/strict');

const apiKeyAuth = require('../auth');
const { validatePricingRequest } = require('../validation');

function responseDouble() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('API key falha fechado quando o secret do servidor não existe', () => {
  const previous = process.env.API_KEY;
  delete process.env.API_KEY;
  const response = responseDouble();
  let nextCalled = false;

  apiKeyAuth({ header: () => 'client-key' }, response, () => { nextCalled = true; });

  assert.equal(response.statusCode, 500);
  assert.equal(nextCalled, false);
  if (previous === undefined) delete process.env.API_KEY;
  else process.env.API_KEY = previous;
});

test('API key rejeita credencial ausente ou incorreta', () => {
  const previous = process.env.API_KEY;
  process.env.API_KEY = 'server-key';
  const response = responseDouble();
  let nextCalled = false;

  apiKeyAuth({ header: () => 'wrong-key' }, response, () => { nextCalled = true; });

  assert.equal(response.statusCode, 401);
  assert.equal(nextCalled, false);
  if (previous === undefined) delete process.env.API_KEY;
  else process.env.API_KEY = previous;
});

test('API key válida libera a requisição', () => {
  const previous = process.env.API_KEY;
  process.env.API_KEY = 'server-key';
  const response = responseDouble();
  let nextCalled = false;

  apiKeyAuth({ header: () => 'server-key' }, response, () => { nextCalled = true; });

  assert.equal(nextCalled, true);
  assert.equal(response.statusCode, 200);
  if (previous === undefined) delete process.env.API_KEY;
  else process.env.API_KEY = previous;
});

test('contrato de pricing rejeita coordenada, preço e campos inválidos', () => {
  const response = responseDouble();
  let nextCalled = false;
  validatePricingRequest({ body: {
    property: { id: 1, lat: -123, lng: -46.6, metroDistance: -1, amenitiesCount: 2 },
    event: { name: '', lat: -23.5, lng: -46.6 },
    basePrice: -10,
  } }, response, () => { nextCalled = true; });

  assert.equal(response.statusCode, 400);
  assert.equal(nextCalled, false);
  assert.ok(Array.isArray(response.body.details));
  assert.ok(response.body.details.length >= 4);
});

test('contrato de pricing aceita payload válido', () => {
  const response = responseDouble();
  let nextCalled = false;
  validatePricingRequest({ body: {
    property: { id: 1, lat: -23.55, lng: -46.63, metroDistance: 0.2, amenitiesCount: 10 },
    event: { name: 'Congresso', lat: -23.56, lng: -46.64 },
    basePrice: 320,
  } }, response, () => { nextCalled = true; });

  assert.equal(nextCalled, true);
  assert.equal(response.statusCode, 200);
});
