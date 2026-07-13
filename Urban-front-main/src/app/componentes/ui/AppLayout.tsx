import React from "react";

/**
 * DS-2 — primitivos de layout.
 *
 * Substituem os `style={{ display: 'flex', gap: 16, ... }}` inline espalhados
 * pelas telas por componentes semânticos e consistentes. Escala de gap única
 * alinhada ao design system (4/8/12/16/24/32).
 */

export type GapToken = "none" | "xs" | "sm" | "md" | "lg" | "xl";

const GAP: Record<GapToken, number> = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

type Align = React.CSSProperties["alignItems"];
type Justify = React.CSSProperties["justifyContent"];

type StackProps = React.HTMLAttributes<HTMLDivElement> & {
  direction?: "row" | "column";
  gap?: GapToken;
  align?: Align;
  justify?: Justify;
  wrap?: boolean;
  fullWidth?: boolean;
};

export const AppStack = React.forwardRef<HTMLDivElement, StackProps>(function AppStack(
  { direction = "column", gap = "md", align, justify, wrap, fullWidth, style, children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      style={{
        display: "flex",
        flexDirection: direction,
        gap: GAP[gap],
        alignItems: align,
        justifyContent: justify,
        flexWrap: wrap ? "wrap" : undefined,
        width: fullWidth ? "100%" : undefined,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
});

/** Atalho horizontal (row). */
export const AppHStack = React.forwardRef<HTMLDivElement, Omit<StackProps, "direction">>(
  function AppHStack(props, ref) {
    return <AppStack ref={ref} direction="row" {...props} />;
  },
);

/** Atalho vertical (column). */
export const AppVStack = React.forwardRef<HTMLDivElement, Omit<StackProps, "direction">>(
  function AppVStack(props, ref) {
    return <AppStack ref={ref} direction="column" {...props} />;
  },
);

type GridProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Nº de colunas fixas, OU largura mínima p/ auto-fit responsivo (ex.: 240). */
  cols?: number;
  minColWidth?: number;
  gap?: GapToken;
  fullWidth?: boolean;
};

export const AppGrid = React.forwardRef<HTMLDivElement, GridProps>(function AppGrid(
  { cols, minColWidth, gap = "md", fullWidth = true, style, children, ...rest },
  ref,
) {
  const templateColumns = minColWidth
    ? `repeat(auto-fit, minmax(${minColWidth}px, 1fr))`
    : `repeat(${cols ?? 1}, minmax(0, 1fr))`;
  return (
    <div
      ref={ref}
      style={{
        display: "grid",
        gridTemplateColumns: templateColumns,
        gap: GAP[gap],
        width: fullWidth ? "100%" : undefined,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
});
