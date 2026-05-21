type Evento = {
  nome: string;
  impacto: "Alto" | "Medio" | "Baixo" | "MÃ©dio";
  data: string;
  distancia: string;
  crescimento: string;
};

type EventosProximosProps = {
  height?: string | number;
  eventos?: Evento[];
};

const impactoColors: Record<string, string> = {
  Alto: "#C2342E",
  Medio: "#C8810E",
  "MÃ©dio": "#C8810E",
  Baixo: "#16A06B",
};

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function EventosProximos({
  height = "400px",
  eventos = [
    {
      nome: "NEY MATOGROSSO",
      impacto: "Alto",
      data: "2025-09-15",
      distancia: "2.3 km",
      crescimento: "+35%",
    },
    {
      nome: "Jogo Flamengo",
      impacto: "Medio",
      data: "2025-10-20",
      distancia: "2.3 km",
      crescimento: "+35%",
    },
    {
      nome: "Conferencia Tech",
      impacto: "Baixo",
      data: "2025-08-25",
      distancia: "2.3 km",
      crescimento: "+35%",
    },
  ],
}: EventosProximosProps) {
  return (
    <section
      style={{
        height,
        maxWidth: 600,
        margin: "0 auto",
        overflowY: "auto",
        padding: 24,
        border: "1px solid rgba(14,17,22,0.12)",
        borderRadius: 10,
        background: "#fff",
        boxShadow: "0 1px 2px rgba(14,17,22,0.04)",
      }}
    >
      <h2 style={{ margin: "0 0 24px", color: "#374151", fontSize: 24, letterSpacing: 0.3 }}>
        Eventos Proximos
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {eventos.map((evento, index) => {
          const color = impactoColors[evento.impacto] || "#6B7280";
          return (
            <article key={index} style={{ padding: "0 8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 6 }}>
                <h3
                  style={{
                    flex: 1,
                    minWidth: 0,
                    margin: 0,
                    color: "#374151",
                    fontSize: 20,
                    fontWeight: 750,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {evento.nome}
                </h3>
                <span
                  style={{
                    padding: "4px 14px",
                    borderRadius: 999,
                    background: `${color}1A`,
                    color,
                    fontSize: 12,
                    fontWeight: 750,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                  }}
                >
                  {evento.impacto === "MÃ©dio" ? "Medio" : evento.impacto}
                </span>
              </div>

              <div style={{ display: "flex", gap: 24, flexWrap: "wrap", color: "#6B7280", fontSize: 13, fontWeight: 650 }}>
                <span>{formatDate(evento.data)}</span>
                <span>{evento.distancia}</span>
                <span>{evento.crescimento}</span>
              </div>

              {index !== eventos.length - 1 && (
                <hr style={{ margin: "20px 0 0", border: 0, borderTop: "1px solid rgba(14,17,22,0.12)" }} />
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
