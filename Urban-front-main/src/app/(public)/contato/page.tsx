"use client";

import { useState, type FormEvent } from "react";
import { createContactSubmission } from "../../service/api";

export default function ContatoPage() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setStatus("loading");
    setErrorMessage(null);
    try {
      await createContactSubmission({
        name: String(formData.get("name") || ""),
        email: String(formData.get("email") || ""),
        subject: String(formData.get("subject") || ""),
        message: String(formData.get("message") || ""),
        source: "public-contact",
      });
      form.reset();
      setStatus("success");
    } catch (error: any) {
      const message = error?.response?.data?.message;
      setErrorMessage(Array.isArray(message) ? message.join(" ") : message || "Não foi possível registrar a mensagem agora.");
      setStatus("error");
    }
  }

  return (
    <main className="urban-manifesto urban-public-page">
      <section className="public-page-hero">
        <div className="public-container public-page-hero__grid">
          <div>
            <p className="public-kicker">Contato</p>
            <h1>Vamos entender sua <em>operação.</em></h1>
            <p className="public-page-hero__lead">Fale com a Urban AI sobre planos, integração, parceria, suporte ou uma operação em escala.</p>
          </div>
          <aside className="public-page-hero__aside"><p><strong style={{ color: "var(--theme-public-text)" }}>Direcionamento rápido.</strong><br />Conte quantos imóveis você administra e qual problema quer resolver. Isso ajuda a levar a conversa para o canal certo.</p></aside>
        </div>
      </section>

      <section className="public-section">
        <div className="public-container public-contact-shell">
          <form className="public-contact-form" onSubmit={handleSubmit}>
            <Field label="Nome completo" name="name" placeholder="Seu nome" />
            <Field label="E-mail profissional" name="email" placeholder="seu@email.com" type="email" />
            <label className="public-field"><span>Assunto</span><select name="subject" required defaultValue=""><option value="" disabled>Selecione o motivo</option><option>Quero conhecer o produto</option><option>Planos para minha operação</option><option>Integração e automação</option><option>Suporte</option><option>Parceria</option><option>Privacidade e LGPD</option><option>Outro assunto</option></select></label>
            <label className="public-field"><span>Mensagem</span><textarea name="message" required minLength={10} placeholder="Conte quantos imóveis você administra e como podemos ajudar." /></label>
            <button type="submit" disabled={status === "loading"}>{status === "loading" ? "Enviando…" : "Enviar mensagem"}</button>
            {status === "success" ? <p role="status" style={{ margin: "18px 0 0", color: "var(--theme-public-text)" }}>Mensagem registrada. Nossa equipe retorna pelo e-mail informado.</p> : null}
            {status === "error" ? <p role="alert" style={{ margin: "18px 0 0", color: "#ff8f70" }}>{errorMessage}</p> : null}
          </form>

          <aside className="public-contact-aside">
            <article><h2>Comercial e produto</h2><a href="mailto:contato@myurbanai.com">contato@myurbanai.com</a></article>
            <article><h2>Privacidade e LGPD</h2><a href="mailto:privacidade@myurbanai.com">privacidade@myurbanai.com</a></article>
            <article><h2>Operações em escala</h2><a href="mailto:comercial@myurbanai.com">comercial@myurbanai.com</a></article>
            <article><h2>O que incluir</h2><p>Número de imóveis, cidade, canal de gestão e o objetivo principal da conversa.</p></article>
          </aside>
        </div>
      </section>
    </main>
  );
}

function Field({ label, name, placeholder, type = "text" }: { label: string; name: string; placeholder: string; type?: string }) {
  return <label className="public-field"><span>{label}</span><input name={name} type={type} required minLength={type === "email" ? undefined : 2} placeholder={placeholder} /></label>;
}
