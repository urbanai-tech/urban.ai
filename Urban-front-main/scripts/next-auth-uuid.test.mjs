import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);

test("next-auth JWT gera e decodifica token com o uuid sobrescrito", async () => {
  const { encode, decode } = require("next-auth/jwt");
  const uuid = require("uuid");
  const secret = "urban-e2e-next-auth-compatibility-secret";

  assert.equal(require("uuid/package.json").version, "11.1.1");
  assert.match(uuid.v4(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

  const encoded = await encode({
    token: { sub: "e2e-next-auth-user", role: "host" },
    secret,
    maxAge: 60,
  });
  const decoded = await decode({ token: encoded, secret });

  assert.equal(decoded?.sub, "e2e-next-auth-user");
  assert.equal(decoded?.role, "host");
  assert.match(String(decoded?.jti), /^[0-9a-f-]{36}$/);
});
