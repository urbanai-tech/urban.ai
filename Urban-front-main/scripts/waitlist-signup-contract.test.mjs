import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const read = (path) => readFileSync(resolve(process.cwd(), path), "utf8");

const forms = [
  "src/app/componentes/WaitlistSignup.tsx",
  "src/app/componentes/WaitlistForm.tsx",
];

test("formulários da waitlist exigem o aceite antes de enviar e mandam acceptedTerms", () => {
  for (const file of forms) {
    const source = read(file);
    assert.match(source, /WaitlistTermsConsent/, `${file} deve renderizar o aceite`);
    assert.match(source, /if \(!acceptedTerms\)/, `${file} deve bloquear o envio sem aceite`);
    assert.match(source, /acceptedTerms: true/, `${file} deve enviar acceptedTerms`);
  }
});

test("o aceite é um checkbox obrigatório e acessível com links para termos e privacidade", () => {
  const source = read("src/app/componentes/WaitlistTermsConsent.tsx");
  assert.match(source, /type="checkbox"/);
  assert.match(source, /required/);
  assert.match(source, /aria-required="true"/);
  assert.match(source, /aria-invalid=\{invalid\}/);
  assert.match(source, /role="alert"/);
  assert.match(source, /marketingUrl\("\/termos"\)/);
  assert.match(source, /marketingUrl\("\/privacidade"\)/);
  assert.doesNotMatch(source, /style=\{\{/, "sem estilo inline");
});

test("o cliente da API tipa acceptedTerms como obrigatório", () => {
  assert.match(read("src/app/service/api/admin.ts"), /acceptedTerms: true;/);
});
