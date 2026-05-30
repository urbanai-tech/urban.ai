type FiltroProps = {
  height?: string | number;
};

export default function Filtro({ height }: FiltroProps) {
  return (
    <aside
      style={{
        height,
        width: "min(320px, 100%)",
        maxWidth: 320,
        overflowY: "auto",
        padding: 16,
        border: "1px solid rgba(14,17,22,0.12)",
        borderRadius: 8,
        background: "#fff",
        boxShadow: "0 1px 2px rgba(14,17,22,0.04)",
      }}
    >
      <h2 style={{ margin: "0 0 16px", color: "#1F2937", fontSize: 16, fontWeight: 750 }}>
        Filtros
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <FilterSelect label="Raio de busca" placeholder="Selecione o raio">
          <option value="5">5 km</option>
          <option value="10">10 km</option>
          <option value="20">20 km</option>
          <option value="50">50 km</option>
        </FilterSelect>

        <FilterSelect label="Tipo de evento" placeholder="Selecione o tipo">
          <option value="incendio">Incendio</option>
          <option value="enchente">Enchente</option>
          <option value="deslizamento">Deslizamento</option>
          <option value="outro">Outro</option>
        </FilterSelect>

        <div>
          <p style={{ margin: "0 0 12px", color: "#1F2937", fontSize: 14, fontWeight: 650 }}>
            Impacto esperado
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <ImpactBadge color="#C2342E">Alto</ImpactBadge>
            <ImpactBadge color="#C8810E">Medio</ImpactBadge>
            <ImpactBadge color="#16A06B">Baixo</ImpactBadge>
          </div>
        </div>
      </div>
    </aside>
  );
}

function FilterSelect({
  label,
  placeholder,
  children,
}: {
  label: string;
  placeholder: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ display: "block", marginBottom: 8, color: "#1F2937", fontSize: 14, fontWeight: 650 }}>
        {label}
      </span>
      <select
        defaultValue=""
        style={{
          width: "100%",
          height: 36,
          padding: "0 12px",
          border: "1px solid rgba(14,17,22,0.16)",
          borderRadius: 6,
          background: "#fff",
          color: "#1F2937",
          fontSize: 13,
        }}
      >
        <option value="" disabled>{placeholder}</option>
        {children}
      </select>
    </label>
  );
}

function ImpactBadge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      style={{
        padding: "7px 12px",
        borderRadius: 8,
        background: `${color}1A`,
        color,
        fontSize: 13,
        fontWeight: 750,
        cursor: "pointer",
      }}
    >
      {children}
    </span>
  );
}
