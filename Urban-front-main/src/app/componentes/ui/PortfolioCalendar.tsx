"use client";

import React from "react";
import Link from "next/link";
import { AppEmptyState } from "./AppEmptyState";
import { Calendar, Check } from "./Icons";
import styles from "./PortfolioCalendar.module.css";
import { brlCompact, brlWhole } from "../../lib/format";

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
 * Tokens via CSS variables (--app-*). Archivo (display) só nos preços (14px).
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
  strategyApplied?: unknown;
  opportunity?: unknown;
  risk?: unknown;
  lift?: unknown;
  confidence?: unknown;
};

export type PortfolioProperty = {
  propertyId: string;
  name: string;
  thumbnail: string | null;
  days: PortfolioDay[];
  strategyApplied?: unknown;
  opportunity?: unknown;
  risk?: unknown;
  lift?: unknown;
  confidence?: unknown;
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
  /** Chaves no formato `${propertyId}|${date}` para datas marcadas no cockpit. */
  selectedDayKeys?: Set<string>;
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
  // Compacto pra célula 56px: "R$ 320" ou "R$ 1,2 mil"
  return brlCompact(value);
}

function fmtBRLFull(value: number): string {
  return brlWhole(value);
}

function fmtStrategy(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const raw = (value as Record<string, unknown>).strategy;
    return typeof raw === "string" ? raw : null;
  }
  return null;
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
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={thumbnail}
        alt={`Foto de ${name}`}
        onError={() => setErrored(true)}
        className={styles.thumbImage}
        style={{ "--thumb-size": `${size}px` } as React.CSSProperties}
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className={styles.thumbInitials}
      style={
        {
          "--thumb-size": `${size}px`,
          "--thumb-font-size": `${Math.round(size * 0.36)}px`,
        } as React.CSSProperties
      }
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
      className={styles.checkboxLabel}
    >
      <span
        aria-hidden="true"
        className={`${styles.checkboxBox} ${visualChecked ? styles.checkboxBoxChecked : styles.checkboxBoxUnchecked}`}
      >
        {checked && <Check size={12} />}
        {!checked && indeterminate && (
          <span
            className={styles.checkboxIndeterminateBar}
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
        className={styles.checkboxNativeInput}
      />
    </label>
  );
}

function SkeletonRow({ top }: { top: number }) {
  return (
    <div
      className={styles.skeletonRow}
      style={{ "--row-top": `${top}px` } as React.CSSProperties}
    >
      <div
        className={`urban-app-skeleton ${styles.skeletonAvatar}`}
      />
      <div className={styles.skeletonTextColumn}>
        <div
          className={`urban-app-skeleton ${styles.skeletonTitleLine}`}
        />
        <div
          className={`urban-app-skeleton ${styles.skeletonSubtitleLine}`}
        />
      </div>
      <div
        className={`urban-app-skeleton ${styles.skeletonBlock}`}
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
  selectedDayKeys,
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
        role="status"
        aria-busy="true"
        aria-label="Carregando portfólio"
        className={styles.loadingCard}
        style={
          {
            "--header-height": `${HEADER_HEIGHT}px`,
            "--row-height": `${ROW_HEIGHT}px`,
            "--skeleton-height": `${ROW_HEIGHT * skeletonCount}px`,
          } as React.CSSProperties
        }
      >
        <div className={styles.loadingHeader}>
          <div
            className={`urban-app-skeleton ${styles.skeletonHeaderLine}`}
          />
        </div>
        <div className={styles.loadingBody}>
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
          <Link
            href="/properties"
            className={styles.emptyStateLink}
          >
            Cadastrar primeiro imóvel
          </Link>
        }
      />
    );
  }

  // ============================================================
  // ===================== MOBILE LAYOUT ========================
  // ============================================================
  if (isMobile) {
    return (
      <div
        className={styles.mobileList}
        style={{ "--mobile-day-width": `${MOBILE_DAY_WIDTH}px` } as React.CSSProperties}
      >
        {/* Topbar com select-all */}
        <div
          className={styles.mobileSelectAllBar}
        >
          <div className={styles.selectAllGroup}>
            <StyledCheckbox
              id="portfolio-select-all-mobile"
              checked={allSelected}
              indeterminate={someSelected}
              onChange={() => onSelectAll(!allSelected)}
              label="Selecionar todos os imóveis"
            />
            <span
              className={styles.selectAllCount}
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
              className={`${styles.mobilePropertyCard} ${isActiveRow ? styles.mobilePropertyCardActive : styles.mobilePropertyCardIdle}`}
            >
              <header
                className={styles.mobilePropertyHeader}
              >
                <StyledCheckbox
                  id={`portfolio-mobile-${prop.propertyId}`}
                  checked={selected}
                  onChange={() => onToggleSelect(prop.propertyId)}
                  label={`Selecionar ${prop.name}`}
                />
                <PropertyThumb thumbnail={prop.thumbnail} name={prop.name} />
                <div className={styles.propertyInfo}>
                  <div
                    className={styles.mobilePropertyName}
                  >
                    {prop.name}
                  </div>
                  <div
                    className={styles.mobilePropertyMeta}
                  >
                    {prop.days.length} dias na janela
                  </div>
                </div>
              </header>

              <div
                role="group"
                aria-label={`Dias de ${prop.name}`}
                className={styles.mobileDayStrip}
              >
                {prop.days.map((day) => {
                  const isActive =
                    activeProperty === prop.propertyId && activeDate === day.date;
                  const isSelectedDay =
                    selectedDayKeys?.has(`${prop.propertyId}|${day.date}`) ?? false;
                  const weekend = isWeekend(day.date);
                  return (
                    <button
                      key={day.date}
                      type="button"
                      onClick={() => onDayClick?.(prop.propertyId, day.date)}
                      aria-label={`${fmtWeekday(day.date)} ${fmtDayMonth(day.date)}${
                        day.evento ? `, ${day.evento.nome}` : ""
                      }${isSelectedDay ? ", data selecionada" : ""}${
                        fmtStrategy(day.strategyApplied) ? `, modo ${fmtStrategy(day.strategyApplied)}` : ""
                      }, preço atual ${fmtBRLFull(day.atual)}${
                        day.sugestao !== null
                          ? `, sugestão ${fmtBRLFull(day.sugestao)}`
                          : ""
                      }`}
                      title={`${fmtWeekday(day.date)} ${fmtDayMonth(day.date)}${
                        day.evento ? ` · ${day.evento.nome}` : ""
                      } · atual ${fmtBRLFull(day.atual)}${
                        day.sugestao !== null
                          ? ` · sugestão ${fmtBRLFull(day.sugestao)}`
                          : ""
                      }`}
                      className={[
                        "urban-focus-ring",
                        styles.mobileDayCell,
                        weekend ? styles.mobileDayCellWeekend : "",
                        isSelectedDay ? styles.mobileDayCellSelected : "",
                        isActive || isSelectedDay ? styles.mobileDayCellMarked : "",
                        onDayClick ? styles.mobileDayCellClickable : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {isSelectedDay && (
                        <span
                          aria-hidden="true"
                          className={styles.mobileSelectedCheck}
                        >
                          <Check size={10} />
                        </span>
                      )}
                      {day.evento && (
                        <span
                          aria-hidden="true"
                          className={`${styles.impactDot} ${day.evento.impacto === "alta" ? styles.impactDotHigh : styles.impactDotLow}`}
                        />
                      )}
                      <span
                        className={styles.mobileDayLabel}
                      >
                        {fmtWeekday(day.date)} {fmtDayMonth(day.date)}
                      </span>
                      <span
                        className={`urban-app-display ${styles.mobileDayPrice} ${day.sugestao !== null ? styles.textAccent : styles.textMuted}`}
                      >
                        {day.sugestao !== null
                          ? fmtBRLShort(day.sugestao)
                          : fmtBRLShort(day.atual)}
                      </span>
                      {day.evento && (
                        <span
                          className={styles.mobileDayEventName}
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
      className={styles.desktopGridCard}
      style={
        {
          "--header-height": `${HEADER_HEIGHT}px`,
          "--row-height": `${ROW_HEIGHT}px`,
          "--left-col-width": `${LEFT_COL_WIDTH}px`,
          "--day-col-width": `${DAY_COL_WIDTH}px`,
          "--dates-width": `${dates.length * DAY_COL_WIDTH}px`,
          "--grid-width": `${totalGridWidth}px`,
          "--body-height": `${totalBodyHeight}px`,
        } as React.CSSProperties
      }
    >
      {/* ===== HEADER STICKY ===== */}
      <div className={styles.gridHeaderRow}>
        {/* Header esquerdo fixo (select all + contador) */}
        <div className={styles.gridHeaderLeft}>
          <StyledCheckbox
            id="portfolio-select-all"
            checked={allSelected}
            indeterminate={someSelected}
            onChange={() => onSelectAll(!allSelected)}
            label="Selecionar todos os imóveis"
          />
          <span
            className={styles.headerSelectAllCount}
          >
            {selectedPropertyIds.size} de {data.length} imóveis
          </span>
        </div>

        {/* Header direito scrollável (datas) */}
        <div
          ref={headerScrollRef}
          className={styles.headerDatesScroller}
        >
          <div className={styles.gridHeaderDates}>
            {dates.map((d) => {
              const weekend = isWeekend(d);
              const isActiveCol = activeDate === d;
              return (
                <div
                  key={d}
                  className={[
                    styles.gridHeaderDay,
                    weekend ? styles.gridHeaderDayWeekend : "",
                    isActiveCol ? styles.gridHeaderDayActive : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <span className={styles.headerWeekday}>
                    {fmtWeekday(d)}
                  </span>
                  <span
                    className={`${styles.headerDayMonth} ${isActiveCol ? styles.textAccent : styles.textDefault}`}
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
        className={styles.bodyScroller}
      >
        <div className={styles.gridBodyInner}>
          {visibleRows.map((prop, localIdx) => {
            const i = startIndex + localIdx;
            const selected = selectedPropertyIds.has(prop.propertyId);
            const isActiveRow = activeProperty === prop.propertyId;
            return (
              <div
                key={prop.propertyId}
                className={`${styles.gridRow} ${isActiveRow ? styles.gridRowActive : ""}`}
                style={{ "--row-top": `${i * ROW_HEIGHT}px` } as React.CSSProperties}
              >
                {/* Coluna esquerda sticky (imóvel) */}
                <div className={styles.gridRowLeft}>
                  <StyledCheckbox
                    id={`portfolio-row-${prop.propertyId}`}
                    checked={selected}
                    onChange={() => onToggleSelect(prop.propertyId)}
                    label={`Selecionar ${prop.name}`}
                  />
                  <PropertyThumb thumbnail={prop.thumbnail} name={prop.name} />
                  <div className={styles.propertyInfo}>
                    <div
                      className={styles.desktopPropertyName}
                      title={prop.name}
                    >
                      {prop.name}
                    </div>
                    <div
                      className={styles.desktopPropertyRate}
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
                  const isSelectedDay =
                    selectedDayKeys?.has(`${prop.propertyId}|${day.date}`) ?? false;
                  const weekend = isWeekend(day.date);
                  const hasEvento = !!day.evento;
                  return (
                    <button
                      type="button"
                      key={day.date}
                      onClick={() => onDayClick?.(prop.propertyId, day.date)}
                      aria-label={`${prop.name}, ${fmtWeekday(day.date)} ${fmtDayMonth(day.date)}${
                        hasEvento ? `, ${day.evento!.nome}` : ""
                      }${isSelectedDay ? ", data selecionada" : ""}${
                        fmtStrategy(day.strategyApplied) ? `, modo ${fmtStrategy(day.strategyApplied)}` : ""
                      }, preço atual ${fmtBRLFull(day.atual)}${
                        day.sugestao !== null
                          ? `, sugestão ${fmtBRLFull(day.sugestao)}`
                          : ""
                      }`}
                      title={`${fmtWeekday(day.date)} ${fmtDayMonth(day.date)}${
                        hasEvento ? ` · ${day.evento!.nome}` : ""
                      } · atual ${fmtBRLFull(day.atual)}${
                        day.sugestao !== null
                          ? ` · sugestão ${fmtBRLFull(day.sugestao)}`
                          : ""
                      }`}
                      className={[
                        "urban-focus-ring",
                        styles.dayCell,
                        weekend ? styles.dayCellWeekend : "",
                        isSelectedDay ? styles.dayCellSelected : "",
                        isActive || isSelectedDay ? styles.dayCellMarked : "",
                        onDayClick ? styles.dayCellClickable : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {isSelectedDay && (
                        <span
                          aria-hidden="true"
                          className={styles.desktopSelectedCheck}
                        >
                          <Check size={10} />
                        </span>
                      )}
                      {hasEvento && (
                        <>
                          <span
                            aria-hidden="true"
                            className={`${styles.impactDot} ${day.evento!.impacto === "alta" ? styles.impactDotHigh : styles.impactDotLow}`}
                          />
                          <span
                            aria-hidden="true"
                            className={`${styles.eventTag} ${day.evento!.impacto === "alta" ? styles.eventTagHigh : ""}`}
                          >
                            {day.evento!.impacto === "alta" ? "Alta" : "Evento"}
                          </span>
                        </>
                      )}
                      {day.sugestao !== null ? (
                        <span
                          className={`urban-app-display ${styles.cellSuggestedPrice}`}
                        >
                          {fmtBRLShort(day.sugestao)}
                        </span>
                      ) : day.atual > 0 ? (
                        <span
                          className={`urban-app-display ${styles.cellCurrentPrice}`}
                        >
                          {fmtBRLShort(day.atual)}
                        </span>
                      ) : (
                        <span
                          aria-label="sem preço"
                          className={styles.cellNoPriceDash}
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
