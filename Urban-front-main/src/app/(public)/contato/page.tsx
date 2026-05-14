"use client";

import { useState, type FormEvent } from "react";
import { createContactSubmission } from "../../service/api";

export default function Contato() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
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
    } catch (err: any) {
      const message = err?.response?.data?.message;
      setErrorMessage(
        Array.isArray(message)
          ? message.join(" ")
          : message || "Nao foi possivel registrar a mensagem agora.",
      );
      setStatus("error");
    }
  }

  return (
    <main className="urban-manifesto urban-public-page">
      <section className="urban-grain urban-public-section" style={{ position: "relative", overflow: "hidden" }}>
        <div
          className="urban-glow"
          style={{ width: 680, height: 680, top: -220, left: -160 }}
        />
        <div className="urban-public-container" style={{ position: "relative", zIndex: 2 }}>
          <p className="urban-eyebrow" style={{ marginBottom: 32 }}>
            Contato
          </p>
          <h1
            className="urban-display"
            style={{
              fontSize: "clamp(72px, 13vw, 190px)",
              lineHeight: 0.88,
              margin: 0,
              textTransform: "uppercase",
            }}
          >
            FALA COM
            <br />
            <span style={{ color: "#E8500A" }}>A URBAN.</span>
          </h1>
          <p className="urban-public-copy" style={{ maxWidth: 700, marginTop: 48 }}>
            Dúvidas, parcerias, suporte ou acesso antecipado. Manda a mensagem e a gente
            responde pelo canal certo.
          </p>
        </div>
      </section>

      <section className="urban-public-section">
        <div
          className="urban-public-container urban-contact-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.7fr) minmax(260px, 0.8fr)",
            gap: 64,
            alignItems: "start",
          }}
        >
          <form onSubmit={handleSubmit} style={{ borderTop: "1px solid rgba(255,255,255,0.10)", paddingTop: 36 }}>
            <Field label="Nome completo" name="name" placeholder="Seu nome" />
            <Field label="E-mail" name="email" placeholder="seu@email.com" type="email" />
            <Field label="Assunto" name="subject" placeholder="Qual o motivo do contato?" />
            <label style={{ display: "block", marginBottom: 28 }}>
              <span className="urban-eyebrow" style={{ display: "block", marginBottom: 12 }}>
                Mensagem
              </span>
              <textarea
                name="message"
                required
                minLength={10}
                rows={6}
                placeholder="Descreva como podemos ajudar..."
                style={fieldStyle}
              />
            </label>
            <button
              type="submit"
              disabled={status === "loading"}
              style={{
                width: "100%",
                padding: "20px 28px",
                border: "none",
                background: "#E8500A",
                color: "#080A0F",
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: 3,
                textTransform: "uppercase",
                cursor: status === "loading" ? "wait" : "pointer",
                opacity: status === "loading" ? 0.7 : 1,
              }}
            >
              {status === "loading" ? "Enviando..." : "Enviar mensagem"}
            </button>
            {status === "success" && (
              <p className="urban-public-copy" role="status" style={{ marginTop: 24, color: "#FFFFFF" }}>
                Mensagem registrada. Nossa equipe retorna em breve.
              </p>
            )}
            {status === "error" && (
              <p className="urban-public-copy" role="alert" style={{ marginTop: 24, color: "#FFB4A0" }}>
                {errorMessage}
              </p>
            )}
          </form>

          <aside className="urban-public-panel" style={{ paddingTop: 36 }}>
            <p className="urban-eyebrow" style={{ marginBottom: 20 }}>
              Canais diretos
            </p>
            <a href="mailto:contato@myurbanai.com" style={contactLinkStyle}>
              contato@myurbanai.com
            </a>
            <a href="mailto:privacidade@myurbanai.com" style={contactLinkStyle}>
              privacidade@myurbanai.com
            </a>
            <p className="urban-public-copy" style={{ fontSize: 15, marginTop: 28 }}>
              Tempo médio de resposta: até 24 horas úteis.
            </p>
          </aside>
        </div>
      </section>
    </main>
  );
}

function Field({
  label,
  name,
  placeholder,
  type = "text",
}: {
  label: string;
  name: string;
  placeholder: string;
  type?: string;
}) {
  return (
    <label style={{ display: "block", marginBottom: 28 }}>
      <span className="urban-eyebrow" style={{ display: "block", marginBottom: 12 }}>
        {label}
      </span>
      <input
        name={name}
        type={type}
        required
        minLength={type === "email" ? undefined : 2}
        placeholder={placeholder}
        style={fieldStyle}
      />
    </label>
  );
}

const fieldStyle: React.CSSProperties = {
  width: "100%",
  background: "transparent",
  border: "none",
  borderBottom: "1px solid rgba(255,255,255,0.22)",
  color: "#FFFFFF",
  fontSize: 19,
  fontWeight: 300,
  lineHeight: 1.5,
  outline: "none",
  padding: "16px 0",
  resize: "vertical",
};

const contactLinkStyle: React.CSSProperties = {
  display: "block",
  color: "#FFFFFF",
  fontSize: 18,
  lineHeight: 1.6,
  textDecoration: "none",
  marginBottom: 12,
};
