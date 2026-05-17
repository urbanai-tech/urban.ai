import NextLink from "next/link";

/**
 * 404 — pagina nao encontrada.
 *
 * Manifesto editorial dark, consistente com /landing/lancamento/precos.
 * Sem header/footer — tela full-bleed.
 */
export default function NotFound() {
  return (
    <main
      className="urban-manifesto"
      style={{
        minHeight: "100vh",
        background: "#080A0F",
        color: "#FFFFFF",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        className="urban-glow"
        style={{
          width: 800,
          height: 800,
          top: "-30%",
          left: "50%",
          transform: "translateX(-50%)",
          position: "absolute",
        }}
        aria-hidden
      />
      <div style={{ position: "relative", zIndex: 2, textAlign: "center", maxWidth: 720 }}>
        <p
          style={{
            fontSize: 12,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: "#E8500A",
            fontWeight: 600,
            margin: 0,
            marginBottom: 32,
          }}
        >
          ERRO 404 — PÁGINA NÃO ENCONTRADA
        </p>
        <h1
          className="urban-display"
          style={{
            fontSize: "clamp(72px, 16vw, 200px)",
            lineHeight: 0.88,
            letterSpacing: "-2px",
            fontWeight: 400,
            margin: 0,
            textTransform: "uppercase",
          }}
        >
          ESSA ROTA
          <br />
          <span style={{ color: "#E8500A" }}>NÃO EXISTE.</span>
        </h1>
        <p
          style={{
            marginTop: 40,
            fontSize: 18,
            fontWeight: 300,
            lineHeight: 1.7,
            color: "rgba(255,255,255,0.65)",
          }}
        >
          O endereço que você tentou abrir não existe ou foi movido. Sem stress —
          volte pro início.
        </p>
        <div
          style={{
            marginTop: 48,
            display: "flex",
            gap: 16,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <NextLink
            href="/"
            style={{
              padding: "18px 32px",
              background: "#E8500A",
              color: "#080A0F",
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: 3,
              textTransform: "uppercase",
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            Voltar ao início →
          </NextLink>
          <NextLink
            href="/painel"
            style={{
              padding: "18px 32px",
              border: "1px solid rgba(255,255,255,0.20)",
              color: "#FFFFFF",
              fontWeight: 600,
              fontSize: 13,
              letterSpacing: 3,
              textTransform: "uppercase",
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            Ir pro painel
          </NextLink>
        </div>
      </div>
    </main>
  );
}
