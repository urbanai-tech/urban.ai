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

test("captcha Turnstile só aparece com site key e envia captchaToken", () => {
  const widget = read("src/app/componentes/TurnstileWidget.tsx");
  assert.match(widget, /NEXT_PUBLIC_TURNSTILE_SITE_KEY/);
  assert.match(widget, /https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js/);
  assert.match(widget, /strategy="lazyOnload"/);
  assert.match(widget, /if \(!TURNSTILE_SITE_KEY\) return null;/, "sem chave: nada é renderizado nem carregado");
  assert.doesNotMatch(widget, /style=\{\{/, "sem estilo inline");

  for (const file of forms) {
    const source = read(file);
    assert.match(source, /<TurnstileWidget/, `${file} deve renderizar o widget`);
    assert.match(source, /captchaToken: captchaToken \?\? undefined/, `${file} deve enviar captchaToken`);
  }
  assert.match(read("src/app/service/api/admin.ts"), /captchaToken\?: string;/);
});
