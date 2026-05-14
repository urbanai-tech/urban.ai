export default function Sobre() {
  return (
    <main className="urban-manifesto urban-public-page">
      <section className="urban-grain urban-public-section" style={{ position: "relative", overflow: "hidden" }}>
        <div
          className="urban-glow"
          style={{ width: 720, height: 720, top: -240, right: -180 }}
        />
        <div className="urban-public-container" style={{ position: "relative", zIndex: 2 }}>
          <p className="urban-eyebrow" style={{ marginBottom: 32 }}>
            Sobre a Urban AI
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
            A CIDADE MUDA.
            <br />
            <span style={{ color: "#E8500A" }}>O PREÇO TAMBÉM.</span>
          </h1>
          <p className="urban-public-copy" style={{ maxWidth: 760, marginTop: 48 }}>
            A Urban AI nasceu para transformar a precificação de aluguéis de curta temporada
            em uma decisão guiada por dados reais: eventos locais, demanda turística,
            sazonalidade e o comportamento do bairro em volta do imóvel.
          </p>
        </div>
      </section>

      <section className="urban-public-section">
        <div className="urban-public-container">
          <div className="urban-public-panel">
            <p className="urban-eyebrow" style={{ marginBottom: 20 }}>
              Nossa tecnologia
            </p>
            <h2>IA, geografia e calendário urbano.</h2>
            <p className="urban-public-copy" style={{ maxWidth: 820, margin: 0 }}>
              Cruzamos informações geográficas, isócronas, base de eventos e sinais de mercado
              para sugerir preços mais competitivos. O objetivo é simples: ajudar o anfitrião
              a capturar dias de alta demanda sem precisar acompanhar manualmente tudo o que
              acontece na cidade.
            </p>
          </div>

          <div className="urban-public-panel">
            <p className="urban-eyebrow" style={{ marginBottom: 20 }}>
              Nossa visão
            </p>
            <h2>Um copiloto de receita para anfitriões.</h2>
            <p className="urban-public-copy" style={{ maxWidth: 820, margin: 0 }}>
              Queremos ser a plataforma de referência para quem administra imóveis de curta
              temporada como negócio: mais previsibilidade, mais clareza e menos decisão no
              escuro quando a cidade começa a se mover.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
