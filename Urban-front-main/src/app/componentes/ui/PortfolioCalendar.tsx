"use client";

import React from "react";
import { AppEmptyState } from "./AppEmptyState";
import { Calendar, Check } from "./Icons";

/**
 * <PortfolioCalendar> — grid horizontal/vertical para o `/portfolio` (Gap 1).
 *
 * Roadmap 4 Tracks (semana 3-4, Dev 2):
 *  - Eixo X = datas (colunas 56px) com sticky header.
 *  - Eixo Y = imóveis (linhas 88px) com coluna esquerda sticky (foto + nome +
 *    checkbox de bulk action).
 *  - Bulk action select-all no topo da coluna esquerda do header.
 *  - Atalhos J/K (linha anterior/próxima), H/L (data anterior/próxima) +
 *    aliases ↑↓←→. Não dispara quando foco em input/textarea.
 *  - Virtualização leve manual quando data.length > 20: renderiza apenas a
 *    janela visível + 3 buffer (cálculo simples scrollTop / rowHeight; sem
 *    `react-window` nem `@tanstack/react-virtual`, que não está no package).
 *  - Mobile (<768px): vira lista de cards verticais com scroll horizontal por
 *    cartão (scroll-snap-x mandatory) — sem coluna fixa.
 *  - Empty state via <AppEmptyState>, loading com 5 skeleton rows usando
 *    .urban-app-skeleton (definido em globals.css).
 *
 * Tokens via CSS variables (--app-*). Bebas Neue só nos preços (14px).
 * Zero dependências novas — DOM nativo + CSS sticky + um pequeno cálculo
 * de virtualização.
 */

// ---------- Tipos públicos ----------

export type PortfolioDay = {
  /** ISO YYYY-MM-DD */
  date: string;
  /** Preço sugerido pela IA, ou null se não houver sugestão. */
  sugestao: number | null;
  /** Preço atual configurado. */
  atual: number;
  /** Evento que motiva a sugestão (null = sem evento relevante). */
  evento: { id: string; nome: string; impacto: "alta" | "media" } | null;
};

export type PortfolioProperty = {
  propertyId: string;
  name: string;
  thumbnail: string | null;
  days: PortfolioDay[];
};

export type PortfolioCalendarProps = {
  data: PortfolioProperty[];
  selectedPropertyIds: Set<string>;
  onToggleSelect: (propertyId: string) => void;
  onSelectAll: (allSelected: boolean) => void;
  /** Propriedade focada via teclado (J/K). */
  activeProperty?: string | null;
  /** Data focada via teclado (H/L). ISO YYYY-MM-DD. */
  activeDate?: string | null;
  /** Callback de navegação por teclado. */
  onMoveActive?: (next: { propertyId: string; date: string }) => void;
  /** Click numa célula de dia (futuro: abre RecommendationCard inline). */
  onDayClick?: (propertyId: string, date: string) => void;
  loading?: boolean;
};

// ---------- Constantes de layout ----------

const ROW_HEIGHT = 88;
const HEADER_HEIGHT = 56;
const LEFT_COL_WIDTH = 240;
const DAY_COL_WIDTH = 56;
const MOBILE_DAY_WIDTH = 80;
const VIRTUALIZATION_THRESHOLD = 20;
const VIEWPORT_BUFFER = 3;
const MOBILE_BREAKPOINT = 768;

// ---------- Helpers ----------

const WEEKDAY_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTH_PT = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

function parseISODateLocal(iso: string): Date {
  // Trata YYYY-MM-DD como data local pura (sem UTC offset).
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]) - 1;
    const day = Number(m[3]);
    return new Date(year, month, day);
  }
  return new Date(iso);
}

function isWeekend(iso: string): boolean {
  const d = parseISODateLocal(iso);
  const dow = d.getDay();
  return dow === 0 || dow === 6;
}

function fmtWeekday(iso: string): string {
  const d = parseISODateLocal(iso);
  if (Number.isNaN(d.getTime())) return "";
  return WEEKDAY_PT[d.getDay()];
}

function fmtDayMonth(iso: string): string {
  const d = parseISODateLocal(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  return `${dd}/${MONTH_PT[d.getMonth()]}`;
}

function fmtBRLShort(value: number): string {
  // Compacto pra célula 56px: "R$ 320" ou "R$ 1,2k"
  if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(1).replace(".", ",")}k`;
  }
  return `R$ ${Math.round(value)}`;
}

function fmtBRLFull(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** SSR-safe — true quando viewport < 768px. */
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);
  return isMobile;
}

// ---------- Subcomponentes ----------

function PropertyThumb({
  thumbnail,
  name,
  size = 32,
}: {
  thumbnail: string | null;
  name: string;
  size?: number;
}) {
  const [errored, setErrored] = React.useState(false);
  if (thumbnail && !errored) {
    /* eslint-disable-next-line @next/next/no-img-element */
    return (
      <img
        src={thumbnail}
        alt={`Foto de ${name}`}
        onError={() => setErrored(true)}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          flexShrink: 0,
          border: "1px solid var(--app-divider)",
          background: "var(--app-surface-muted)",
        }}
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        background: "var(--app-surface-muted)",
        border: "1px solid var(--app-divider)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.round(size * 0.36),
        fontWeight: 600,
        color: "var(--app-text-muted)",
        fontFamily: "'Inter', sans-serif",
        letterSpacing: 0.5,
      }}
    >
      {initialsFromName(name)}
    </div>
  );
}

function StyledCheckbox({
  checked,
  indeterminate,
  onChange,
  label,
  id,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  label: string;
  id?: string;
}) {
  const ref = React.useRef<HTMLInputElement | null>(null);
  React.useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate && !checked;
  }, [indeterminate, checked]);

  const visualChecked = checked || !!indeterminate;
  return (
    <label
      htmlFor={id}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0,
        cursor: "pointer",
        flexShrink: 0,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 18,
          height: 18,
          borderRadius: 4,
          border: visualChecked
            ? "1.5px solid var(--app-accent)"
            : "1.5px solid var(--app-divider-strong)",
          background: visualChecked
            ? "var(--app-accent)"
            : "var(--app-surface)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          transition: "background 120ms ease, border-color 120ms ease",
        }}
      >
        {checked && <Check size={12} />}
        {!checked && indeterminate && (
          <span
            style={{
              width: 8,
              height: 2,
              background: "#fff",
              borderRadius: 1,
            }}
          />
        )}
      </span>
      <input
        ref={ref}
        id={id}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        aria-label={label}
        style={{
          position: "absolute",
          opacity: 0,
          pointerEvents: "none",
          width: 0,
          height: 0,
        }}
      />
    </label>
  );
}

function SkeletonRow({ top }: { top: number }) {
  return (
    <div
      style={{
        position: "absolute",
        top,
        left: 0,
        right: 0,
        height: ROW_HEIGHT,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "0 16px",
        borderBottom: "1px solid var(--app-divider)",
      }}
    >
      <div
        className="urban-app-skeleton"
        style={{ width: 32, height: 32, borderRadius: "50%" }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
        <div
          className="urban-app-skeleton"
          style={{ width: "60%", height: 12, borderRadius: 4 }}
        />
        <div
          className="urban-app-skeleton"
          style={{ width: "30%", height: 10, borderRadius: 4 }}
        />
      </div>
      <div
        className="urban-app-skeleton"
        style={{ flex: 2, height: 56, borderRadius: 6 }}
      />
    </div>
  );
}

// ---------- Componente principal ----------

export function PortfolioCalendar({
  data,
  selectedPropertyIds,
  onToggleSelect,
  onSelectAll,
  activeProperty,
  activeDate,
  onMoveActive,
  onDayClick,
  loading,
}: PortfolioCalendarProps) {
  const isMobile = useIsMobile();

  // Lista de datas únicas (usa o primeiro imóvel como referência;
  // assume payload do Contrato B garante mesma janela em todos os imóveis).
  const dates = React.useMemo<string[]>(() => {
    if (!data || data.length === 0) return [];
    return data[0].days.map((d) => d.date);
  }, [data]);

  const datesIndex = React.useMemo<Map<string, number>>(() => {
    const m = new Map<string, number>();
    dates.forEach((d, i) => m.set(d, i));
    return m;
  }, [dates]);

  const propertyIndex = React.useMemo<Map<string, number>>(() => {
    const m = new Map<string, number>();
    data.forEach((p, i) => m.set(p.propertyId, i));
    return m;
  }, [data]);

  // Estado seleção
  const allSelected =
    data.length > 0 && data.every((p) => selectedPropertyIds.has(p.propertyId));
  const someSelected =
    !allSelected && data.some((p) => selectedPropertyIds.has(p.propertyId));

  // -------- Scroll sync (desktop) --------
  const headerScrollRef = React.useRef<HTMLDivElement | null>(null);
  const bodyScrollRef = React.useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = React.useState(0);

  const handleBodyScroll = React.useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      setScrollTop(el.scrollTop);
      if (headerScrollRef.current) {
        headerScrollRef.current.scrollLeft = el.scrollLeft;
      }
    },
    [],
  );

  // -------- Virtualização leve --------
  const useVirtualization = data.length > VIRTUALIZATION_THRESHOLD;
  const [viewportHeight, setViewportHeight] = React.useState(0);

  React.useEffect(() => {
    if (!useVirtualization) return;
    const el = bodyScrollRef.current;
    if (!el) return;
    const update = () => setViewportHeight(el.clientHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [useVirtualization]);

  const { startIndex, endIndex } = React.useMemo(() => {
    if (!useVirtualization) {
      return { startIndex: 0, endIndex: data.length };
    }
    const start = Math.max(
      0,
      Math.floor(scrollTop / ROW_HEIGHT) - VIEWPORT_BUFFER,
    );
    const visibleCount = Math.ceil(viewportHeight / ROW_HEIGHT) + VIEWPORT_BUFFER * 2;
    const end = Math.min(data.length, start + visibleCount);
    return { startIndex: start, endIndex: end };
  }, [useVirtualization, scrollTop, viewportHeight, data.length]);

  // -------- Atalhos de teclado --------
  React.useEffect(() => {
    if (!onMoveActive) return;
    if (isMobile) return; // navegação por teclado só faz sentido no desktop

    const handler = (e: KeyboardEvent) => {
      // Bloqueia quando foco está em input editável (evita conflitar com bulk filter, etc).
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        target?.isContentEditable
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();
      const isDownKey = key === "j" || e.key === "ArrowDown";
      const isUpKey = key === "k" || e.key === "ArrowUp";
      const isLeftKey = key === "h" || e.key === "ArrowLeft";
      const isRightKey = key === "l" || e.key === "ArrowRight";

      if (!(isDownKey || isUpKey || isLeftKey || isRightKey)) return;
      if (data.length === 0 || dates.length === 0) return;

      const curPropIdx = activeProperty
        ? (propertyIndex.get(activeProperty) ?? 0)
        : 0;
      const curDateIdx = activeDate ? (datesIndex.get(activeDate) ?? 0) : 0;

      let nextPropIdx = curPropIdx;
      let nextDateIdx = curDateIdx;

      if (isDownKey) {
        nextPropIdx = Math.min(data.length - 1, curPropIdx + 1);
      } else if (isUpKey) {
        nextPropIdx = Math.max(0, curPropIdx - 1);
      } else if (isLeftKey) {
        nextDateIdx = Math.max(0, curDateIdx - 1);
      } else if (isRightKey) {
        nextDateIdx = Math.min(dates.length - 1, curDateIdx + 1);
      }

      if (nextPropIdx === curPropIdx && nextDateIdx === curDateIdx) return;

      e.preventDefault();
      onMoveActive({
        propertyId: data[nextPropIdx].propertyId,
        date: dates[nextDateIdx],
      });
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    onMoveActive,
    activeProperty,
    activeDate,
    data,
    dates,
    propertyIndex,
    datesIndex,
    isMobile,
  ]);

  // -------- Loading state --------
  if (loading) {
    const skeletonCount = 5;
    return (
      <div
        aria-busy="true"
        aria-label="Carregando portfólio"
        style={{
          background: "var(--app-surface)",
          border: "1px solid var(--app-divider)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: HEADER_HEIGHT,
            background: "var(--app-surface-muted)",
            borderBottom: "1px solid var(--app-divider)",
            display: "flex",
            alignItems: "center",
            padding: "0 16px",
          }}
        >
          <div
            className="urban-app-skeleton"
            style={{ width: 180, height: 14, borderRadius: 4 }}
          />
        </div>
        <div
          style={{
            position: "relative",
            height: ROW_HEIGHT * skeletonCount,
          }}
        >
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <SkeletonRow key={i} top={i * ROW_HEIGHT} />
          ))}
        </div>
      </div>
    );
  }

  // -------- Empty state --------
  if (!data || data.length === 0) {
    return (
      <AppEmptyState
        eyebrow="PORTFÓLIO VAZIO"
        title="Nenhum imóvel cadastrado ainda"
        body="Cadastre o primeiro imóvel pra começar a ver sugestões de preço por dia, por imóvel, lado a lado."
        icon={<Calendar size={32} />}
        action={
          <a
            href="/properties"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 18px",
              borderRadius: 8,
              background: "var(--app-accent)",
              color: "#fff",
              fontWeight: 600,
              fontSize: 14,
              textDecoration: "none",
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Cadastrar primeiro imóvel
          </a>
        }
      />
    );
  }

  // ============================================================
  // ===================== MOBILE LAYOUT ========================
  // ============================================================
  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Topbar com select-all */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 14px",
            background: "var(--app-surface)",
            border: "1px solid var(--app-divider)",
            borderRadius: 10,
          }}
        >
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <StyledCheckbox
              id="portfolio-select-all-mobile"
              checked={allSelected}
              indeterminate={someSelected}
              onChange={() => onSelectAll(!allSelected)}
              label="Selecionar todos os imóveis"
            />
            <span
              style={{
                fontSize: 13,
                color: "var(--app-text)",
                fontFamily: "'Inter', sans-serif",
                fontWeight: 500,
              }}
            >
              {selectedPropertyIds.size} de {data.length} imóveis
            </span>
          </div>
        </div>

        {data.map((prop) => {
          const selected = selectedPropertyIds.has(prop.propertyId);
          const isActiveRow = activeProperty === prop.propertyId;
          return (
            <article
              key={prop.propertyId}
              style={{
                background: "var(--app-surface)",
                border: isActiveRow
                  ? "2px solid var(--app-accent)"
                  : "1px solid var(--app-divider)",
                borderRadius: 12,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <header
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  borderBottom: "1px solid var(--app-divider)",
                }}
              >
                <StyledCheckbox
                  id={`portfolio-mobile-${prop.propertyId}`}
                  checked={selected}
                  onChange={() => onToggleSelect(prop.propertyId)}
                  label={`Selecionar ${prop.name}`}
                />
                <PropertyThumb thumbnail={prop.thumbnail} name={prop.name} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "var(--app-text)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontFamily: "'Inter', sans-serif",
                    }}
                  >
                    {prop.name}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--app-text-muted)",
                      marginTop: 2,
                      fontFamily: "'Inter', sans-serif",
                    }}
                  >
                    {prop.days.length} dias na janela
                  </div>
                </div>
              </header>

              <div
                role="list"
                style={{
                  display: "flex",
                  overflowX: "auto",
                  scrollSnapType: "x mandatory",
                  WebkitOverflowScrolling: "touch",
                  padding: "12px 8px",
                  gap: 6,
                }}
              >
                {prop.days.map((day) => {
                  const isActive =
                    activeProperty === prop.propertyId && activeDate === day.date;
                  const weekend = isWeekend(day.date);
                  return (
                    <button
                      key={day.date}
                      type="button"
                      onClick={() => onDayClick?.(prop.propertyId, day.date)}
                      role="listitem"
                      aria-label={`${fmtWeekday(day.date)} ${fmtDayMonth(day.date)}${
                        day.evento ? `, ${day.evento.nome}` : ""
                      }, preco atual ${fmtBRLFull(day.atual)}${
                        day.sugestao !== null
                          ? `, sugestao ${fmtBRLFull(day.sugestao)}`
                          : ""
                      }`}
                      title={`${fmtWeekday(day.date)} ${fmtDayMonth(day.date)}${
                        day.evento ? ` · ${day.evento.nome}` : ""
                      } · atual ${fmtBRLFull(day.atual)}${
                        day.sugestao !== null
                          ? ` · sugestão ${fmtBRLFull(day.sugestao)}`
                          : ""
                      }`}
                      className="focus-visible:outline-2 focus-visible:outline-[var(--app-accent)] focus-visible:outline-offset-2"
                      style={{
                        all: "unset",
                        scrollSnapAlign: "start",
                        flexShrink: 0,
                        width: MOBILE_DAY_WIDTH,
                        height: 76,
                        minHeight: 44,
                        cursor: onDayClick ? "pointer" : "default",
                        borderRadius: 8,
                        border: isActive
                          ? "2px solid var(--app-accent)"
                          : "1px solid var(--app-divider)",
                        background: weekend
                          ? "var(--app-surface-muted)"
                          : "var(--app-surface)",
                        position: "relative",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 2,
                        padding: "6px 4px",
                      }}
                    >
                      {day.evento && (
                        <span
                          aria-hidden="true"
                          style={{
                            position: "absolute",
                            top: 6,
                            right: 6,
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background:
                              day.evento.impacto === "alta"
                                ? "var(--app-accent)"
                                : "var(--app-text-muted)",
                          }}
                        />
                      )}
                      <span
                        style={{
                          fontSize: 10,
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                          color: "var(--app-text-muted)",
                          fontFamily: "'Inter', sans-serif",
                          fontWeight: 600,
                        }}
                      >
                        {fmtWeekday(day.date)} {fmtDayMonth(day.date)}
                      </span>
                      <span
                        className="urban-app-display"
                        style={{
                          fontSize: 14,
                          color:
                            day.sugestao !== null
                              ? "var(--app-accent)"
                              : "var(--app-text-muted)",
                          letterSpacing: 0.5,
                          lineHeight: 1,
                        }}
                      >
                        {day.sugestao !== null
                          ? fmtBRLShort(day.sugestao)
                          : fmtBRLShort(day.atual)}
                      </span>
                      {day.evento && (
                        <span
                          style={{
                            fontSize: 9,
                            color: "var(--app-text-dim)",
                            textOverflow: "ellipsis",
                            overflow: "hidden",
                            whiteSpace: "nowrap",
                            maxWidth: "100%",
                            fontFamily: "'Inter', sans-serif",
                          }}
                        >
                          {day.evento.nome}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
    );
  }

  // ============================================================
  // ===================== DESKTOP LAYOUT =======================
  // ============================================================
  const totalGridWidth = LEFT_COL_WIDTH + dates.length * DAY_COL_WIDTH;
  const totalBodyHeight = data.length * ROW_HEIGHT;
  const visibleRows = data.slice(startIndex, endIndex);

  return (
    <div
      style={{
        background: "var(--app-surface)",
        border: "1px solid var(--app-divider)",
        borderRadius: 12,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ===== HEADER STICKY ===== */}
      <div
        style={{
          display: "flex",
          background: "var(--app-surface-muted)",
          borderBottom: "1px solid var(--app-divider-strong)",
          height: HEADER_HEIGHT,
        }}
      >
        {/* Header esquerdo fixo (select all + contador) */}
        <div
          style={{
            width: LEFT_COL_WIDTH,
            flexShrink: 0,
            borderRight: "1px solid var(--app-divider-strong)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "0 16px",
            background: "var(--app-surface-muted)",
            position: "sticky",
            left: 0,
            zIndex: 2,
          }}
        >
          <StyledCheckbox
            id="portfolio-select-all"
            checked={allSelected}
            indeterminate={someSelected}
            onChange={() => onSelectAll(!allSelected)}
            label="Selecionar todos os imóveis"
          />
          <span
            style={{
              fontSize: 12,
              color: "var(--app-text-muted)",
              fontFamily: "'Inter', sans-serif",
              fontWeight: 600,
              letterSpacing: 0.3,
            }}
          >
            {selectedPropertyIds.size} de {data.length} imóveis
          </span>
        </div>

        {/* Header direito scrollável (datas) */}
        <div
          ref={headerScrollRef}
          style={{
            flex: 1,
            overflowX: "hidden",
            overflowY: "hidden",
          }}
        >
          <div
            style={{
              width: dates.length * DAY_COL_WIDTH,
              height: HEADER_HEIGHT,
              display: "flex",
            }}
          >
            {dates.map((d) => {
              const weekend = isWeekend(d);
              const isActiveCol = activeDate === d;
              return (
                <div
                  key={d}
                  style={{
                    width: DAY_COL_WIDTH,
                    flexShrink: 0,
                    height: HEADER_HEIGHT,
                    borderRight: "1px solid var(--app-divider)",
                    background: weekend
                      ? "rgba(14, 17, 22, 0.025)"
                      : "transparent",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 2,
                    color: isActiveCol
                      ? "var(--app-accent)"
                      : "var(--app-text-muted)",
                    fontFamily: "'Inter', sans-serif",
                    fontWeight: isActiveCol ? 700 : 600,
                    letterSpacing: 0.3,
                  }}
                >
                  <span style={{ fontSize: 10, textTransform: "uppercase" }}>
                    {fmtWeekday(d)}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: isActiveCol ? "var(--app-accent)" : "var(--app-text)",
                    }}
                  >
                    {fmtDayMonth(d)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ===== BODY SCROLL ===== */}
      <div
        ref={bodyScrollRef}
        onScroll={handleBodyScroll}
        style={{
          maxHeight: 640,
          overflow: "auto",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "relative",
            width: totalGridWidth,
            height: totalBodyHeight,
          }}
        >
          {visibleRows.map((prop, localIdx) => {
            const i = startIndex + localIdx;
            const selected = selectedPropertyIds.has(prop.propertyId);
            const isActiveRow = activeProperty === prop.propertyId;
            return (
              <div
                key={prop.propertyId}
                style={{
                  position: "absolute",
                  top: i * ROW_HEIGHT,
                  left: 0,
                  height: ROW_HEIGHT,
                  width: totalGridWidth,
                  display: "flex",
                  borderBottom: "1px solid var(--app-divider)",
                  background: isActiveRow
                    ? "var(--app-accent-soft)"
                    : "transparent",
                  transition: "background 120ms ease",
                }}
              >
                {/* Coluna esquerda sticky (imóvel) */}
                <div
                  style={{
                    width: LEFT_COL_WIDTH,
                    flexShrink: 0,
                    height: ROW_HEIGHT,
                    background: "var(--app-surface)",
                    borderRight: "1px solid var(--app-divider-strong)",
                    position: "sticky",
                    left: 0,
                    zIndex: 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "0 16px",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background =
                      "var(--app-surface-muted)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background =
                      "var(--app-surface)";
                  }}
                >
                  <StyledCheckbox
                    id={`portfolio-row-${prop.propertyId}`}
                    checked={selected}
                    onChange={() => onToggleSelect(prop.propertyId)}
                    label={`Selecionar ${prop.name}`}
                  />
                  <PropertyThumb thumbnail={prop.thumbnail} name={prop.name} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "var(--app-text)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontFamily: "'Inter', sans-serif",
                        lineHeight: 1.3,
                      }}
                      title={prop.name}
                    >
                      {prop.name}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--app-text-muted)",
                        marginTop: 2,
                        fontFamily: "'Inter', sans-serif",
                      }}
                    >
                      {prop.days[0]
                        ? `${fmtBRLFull(prop.days[0].atual)} / diária`
                        : ""}
                    </div>
                  </div>
                </div>

                {/* Células de dia */}
                {prop.days.map((day) => {
                  const isActive =
                    activeProperty === prop.propertyId && activeDate === day.date;
                  const weekend = isWeekend(day.date);
                  const hasEvento = !!day.evento;
                  return (
                    <button
                      type="button"
                      key={day.date}
                      onClick={() => onDayClick?.(prop.propertyId, day.date)}
                      aria-label={`${prop.name}, ${fmtWeekday(day.date)} ${fmtDayMonth(day.date)}${
                        hasEvento ? `, ${day.evento!.nome}` : ""
                      }, preco atual ${fmtBRLFull(day.atual)}${
                        day.sugestao !== null
                          ? `, sugestao ${fmtBRLFull(day.sugestao)}`
                          : ""
                      }`}
                      title={`${fmtWeekday(day.date)} ${fmtDayMonth(day.date)}${
                        hasEvento ? ` · ${day.evento!.nome}` : ""
                      } · atual ${fmtBRLFull(day.atual)}${
                        day.sugestao !== null
                          ? ` · sugestão ${fmtBRLFull(day.sugestao)}`
                          : ""
                      }`}
                      className="focus-visible:outline-2 focus-visible:outline-[var(--app-accent)]"
                      style={{
                        all: "unset",
                        width: DAY_COL_WIDTH,
                        flexShrink: 0,
                        height: ROW_HEIGHT,
                        cursor: onDayClick ? "pointer" : "default",
                        borderRight: "1px solid var(--app-divider)",
                        background: weekend
                          ? "rgba(14, 17, 22, 0.018)"
                          : "transparent",
                        position: "relative",
                        boxSizing: "border-box",
                        outline: isActive
                          ? "2px solid var(--app-accent)"
                          : "none",
                        outlineOffset: -2,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 4,
                      }}
                    >
                      {hasEvento && (
                        <>
                          <span
                            aria-hidden="true"
                            style={{
                              position: "absolute",
                              top: 6,
                              right: 6,
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background:
                                day.evento!.impacto === "alta"
                                  ? "var(--app-accent)"
                                  : "var(--app-text-muted)",
                            }}
                          />
                          <span
                            aria-hidden="true"
                            style={{
                              position: "absolute",
                              top: 4,
                              left: 4,
                              fontSize: 8,
                              color: "var(--app-text-dim)",
                              writingMode: "vertical-rl",
                              transform: "rotate(180deg)",
                              textOverflow: "ellipsis",
                              overflow: "hidden",
                              maxHeight: ROW_HEIGHT - 12,
                              whiteSpace: "nowrap",
                              fontFamily: "'Inter', sans-serif",
                              letterSpacing: 0.3,
                              textTransform: "uppercase",
                              fontWeight: 600,
                              pointerEvents: "none",
                            }}
                          >
                            {day.evento!.nome}
                          </span>
                        </>
                      )}
                      {day.sugestao !== null ? (
                        <span
                          className="urban-app-display"
                          style={{
                            fontSize: 14,
                            color: "var(--app-accent)",
                            lineHeight: 1,
                            letterSpacing: 0.5,
                          }}
                        >
                          {fmtBRLShort(day.sugestao)}
                        </span>
                      ) : day.atual > 0 ? (
                        <span
                          className="urban-app-display"
                          style={{
                            fontSize: 14,
                            color: "var(--app-text-muted)",
                            lineHeight: 1,
                            letterSpacing: 0.5,
                          }}
                        >
                          {fmtBRLShort(day.atual)}
                        </span>
                      ) : (
                        <span
                          aria-label="sem preco"
                          style={{
                            fontSize: 14,
                            color: "var(--app-text-muted)",
                            fontFamily: "'Inter', sans-serif",
                          }}
                        >
                          —
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
