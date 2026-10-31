import { readFile } from "node:fs/promises";
import path from "node:path";
import type { CSSProperties } from "react";
import { ImageResponse } from "next/og";

type UrbanSeoImageOptions = {
  width: number;
  height: number;
  title?: string;
  subtitle?: string;
  eyebrow?: string;
};

export const OG_DEFAULT_TITLE = "Precificação dinâmica para Airbnb";
export const OG_DEFAULT_SUBTITLE =
  "Eventos urbanos, demanda local e IA explicável para orientar diárias.";

// Cores do manual (Brandbook 2026): fundo deep/preto, texto branco e mint.
const colors = {
  bg: "#04191B",
  text: "#FFFFFF",
  muted: "rgba(255,255,255,0.72)",
  line: "rgba(255,255,255,0.14)",
  mint: "#7FE5C4",
};

const FALLBACK_FONT = "Arial, Helvetica, sans-serif";

/** Logo oficial (wordmark branco). Lido de public/; sem ele cai para texto. */
async function loadLogoDataUri(): Promise<string | null> {
  try {
    const svg = await readFile(path.join(process.cwd(), "public/brand/logo-wordmark-white.svg"));
    return `data:image/svg+xml;base64,${svg.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Archivo (OFL) estático gerado do variável do site; satori não lê woff2. */
async function loadFont(file: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(new URL(`../../fonts/archivo/${file}`, import.meta.url));
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

export async function createUrbanSeoImage({
  width,
  height,
  title = OG_DEFAULT_TITLE,
  subtitle = OG_DEFAULT_SUBTITLE,
  eyebrow = "My Urban",
}: UrbanSeoImageOptions) {
  const [logo, bold, medium] = await Promise.all([
    loadLogoDataUri(),
    loadFont("archivo-og-800.ttf"),
    loadFont("archivo-og-500.ttf"),
  ]);

  const fonts: Array<{ name: string; data: ArrayBuffer; weight: 500 | 800; style: "normal" }> = [];
  if (bold) fonts.push({ name: "Archivo", data: bold, weight: 800, style: "normal" });
  if (medium) fonts.push({ name: "Archivo", data: medium, weight: 500, style: "normal" });
  const family = fonts.length ? `Archivo, ${FALLBACK_FONT}` : FALLBACK_FONT;

  // Título curto cabe em 2 linhas grandes; longo reduz a fonte em vez de cortar.
  const titleSize = title.length <= 28 ? 88 : title.length <= 52 ? 70 : 56;

  const s: Record<string, CSSProperties> = {
    root: {
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      padding: "56px 64px",
      background: colors.bg,
      color: colors.text,
      fontFamily: family,
    },
    middle: { display: "flex", flexDirection: "column" },
    top: { display: "flex", alignItems: "center", justifyContent: "space-between" },
    domain: { display: "flex", color: colors.muted, fontSize: 24, fontWeight: 500 },
    eyebrow: {
      display: "flex",
      color: colors.mint,
      fontSize: 24,
      fontWeight: 800,
      letterSpacing: 4,
      textTransform: "uppercase",
      marginBottom: 24,
    },
    title: { display: "flex", fontSize: titleSize, lineHeight: 1.05, fontWeight: 800, letterSpacing: -1 },
    subtitle: {
      display: "flex",
      marginTop: 28,
      maxWidth: 940,
      color: colors.muted,
      fontSize: 32,
      lineHeight: 1.35,
      fontWeight: 500,
    },
    bottom: {
      display: "flex",
      justifyContent: "space-between",
      borderTop: `2px solid ${colors.line}`,
      paddingTop: 24,
      color: colors.muted,
      fontSize: 24,
      fontWeight: 500,
    },
  };

  return new ImageResponse(
    (
      <div style={s.root}>
        <div style={s.top}>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- satori não usa next/image
            <img src={logo} alt="My Urban" height={44} width={250} />
          ) : (
            <div style={s.eyebrow}>My Urban</div>
          )}
          <div style={s.domain}>myurbanai.com</div>
        </div>

        <div style={s.middle}>
          <div style={s.eyebrow}>{eyebrow}</div>
          <div style={s.title}>{title}</div>
          <div style={s.subtitle}>{subtitle}</div>
        </div>

        <div style={s.bottom}>
          <span>Eventos urbanos</span>
          <span>São Paulo e Grande SP</span>
          <span>IA explicável</span>
        </div>
      </div>
    ),
    { width, height, fonts: fonts.length ? fonts : undefined },
  );
}
