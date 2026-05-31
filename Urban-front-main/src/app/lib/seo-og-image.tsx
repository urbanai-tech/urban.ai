import type { CSSProperties } from "react";
import { ImageResponse } from "next/og";

type UrbanSeoImageOptions = {
  width: number;
  height: number;
  title?: string;
  subtitle?: string;
  eyebrow?: string;
};

const colors = {
  bg: "#080A0F",
  panel: "#10151C",
  panelSoft: "rgba(255,255,255,0.05)",
  text: "#FFFFFF",
  muted: "rgba(255,255,255,0.66)",
  dim: "rgba(255,255,255,0.30)",
  border: "rgba(255,255,255,0.12)",
  accent: "#E8500A",
};

const baseFont =
  "Inter, Arial, Helvetica, system-ui, -apple-system, BlinkMacSystemFont, sans-serif";

export function createUrbanSeoImage({
  width,
  height,
  title = "Precificação dinâmica para Airbnb",
  subtitle = "Eventos urbanos, demanda local e IA explicável para orientar diárias.",
  eyebrow = "Urban AI",
}: UrbanSeoImageOptions) {
  const compact = height <= 480;
  const titleSize = compact ? 78 : 96;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: colors.bg,
          color: colors.text,
          fontFamily: baseFont,
        }}
      >
        <BackgroundLines />
        <AccentGlow />

        <div
          style={{
            position: "absolute",
            left: 54,
            top: 46,
            right: 54,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 22,
            letterSpacing: 1,
            fontWeight: 800,
            textTransform: "uppercase",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <span>Urban</span>
            <span style={{ color: colors.accent, marginLeft: 8 }}>AI</span>
          </div>
          <div
            style={{
              display: "flex",
              color: colors.dim,
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: 3,
            }}
          >
            myurbanai.com
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            left: 54,
            right: 54,
            top: compact ? 112 : 132,
            bottom: compact ? 42 : 54,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                color: colors.accent,
                fontSize: 18,
                fontWeight: 800,
                letterSpacing: 4,
                textTransform: "uppercase",
                marginBottom: 26,
              }}
            >
              {eyebrow}
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                maxWidth: 850,
                fontSize: titleSize,
                lineHeight: 0.92,
                letterSpacing: 0,
                fontWeight: 900,
                textTransform: "uppercase",
              }}
            >
              {splitTitle(title).map((line, index) => (
                <div key={line} style={{ display: "flex" }}>
                  <span style={{ color: index === 1 ? colors.accent : colors.text }}>
                    {line}
                  </span>
                </div>
              ))}
            </div>

            <div
              style={{
                display: "flex",
                maxWidth: 690,
                marginTop: 30,
                color: colors.muted,
                fontSize: compact ? 25 : 29,
                lineHeight: 1.35,
                fontWeight: 500,
              }}
            >
              {subtitle}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderTop: `1px solid ${colors.border}`,
              paddingTop: 26,
            }}
          >
            <Signal label="Sinais" value="Eventos" />
            <Signal label="Cobertura" value="SP + Grande SP" />
            <Signal label="Motor" value="IA + GEO" />
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            right: 74,
            top: 164,
            width: compact ? 220 : 270,
            height: compact ? 220 : 270,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: `1px solid ${colors.border}`,
            background: "rgba(255,255,255,0.025)",
          }}
        >
          <MapMark />
        </div>
      </div>
    ),
    {
      width,
      height,
    },
  );
}

function splitTitle(title: string) {
  const words = title.split(" ");

  if (words.length <= 2) {
    return [title];
  }

  if (words.length === 3) {
    return [words[0], words.slice(1).join(" ")];
  }

  return [
    words[0],
    words[1],
    words.slice(2).join(" "),
  ];
}

function BackgroundLines() {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        display: "flex",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 54,
          top: 0,
          width: 1,
          height: "100%",
          display: "flex",
          background: colors.panelSoft,
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 54,
          top: 0,
          width: 1,
          height: "100%",
          display: "flex",
          background: colors.panelSoft,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 96,
          width: "100%",
          height: 1,
          display: "flex",
          background: colors.panelSoft,
        }}
      />
      <div
        style={{
          position: "absolute",
          right: -150,
          bottom: -90,
          width: 560,
          height: 560,
          display: "flex",
          border: `1px solid ${colors.panelSoft}`,
          transform: "rotate(18deg)",
        }}
      />
    </div>
  );
}

function AccentGlow() {
  return (
    <div
      style={{
        position: "absolute",
        right: -160,
        top: 70,
        width: 520,
        height: 520,
        display: "flex",
        background: colors.accent,
        opacity: 0.16,
        borderRadius: 520,
      }}
    />
  );
}

function Signal({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minWidth: 170 }}>
      <span
        style={{
          color: colors.dim,
          fontSize: 13,
          letterSpacing: 3,
          fontWeight: 800,
          textTransform: "uppercase",
          marginBottom: 9,
        }}
      >
        {label}
      </span>
      <span
        style={{
          color: colors.text,
          fontSize: 24,
          lineHeight: 1,
          fontWeight: 800,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function MapMark() {
  const lineStyle: CSSProperties = {
    position: "absolute",
    display: "flex",
    background: colors.panelSoft,
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        background: colors.panel,
      }}
    >
      <div style={{ ...lineStyle, left: "33%", top: 0, width: 1, height: "100%" }} />
      <div style={{ ...lineStyle, left: "66%", top: 0, width: 1, height: "100%" }} />
      <div style={{ ...lineStyle, left: 0, top: "33%", width: "100%", height: 1 }} />
      <div style={{ ...lineStyle, left: 0, top: "66%", width: "100%", height: 1 }} />

      <div
        style={{
          position: "absolute",
          left: 86,
          top: 74,
          width: 92,
          height: 92,
          display: "flex",
          border: `3px solid ${colors.accent}`,
          borderRadius: 92,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 119,
          top: 106,
          width: 28,
          height: 28,
          display: "flex",
          background: colors.accent,
          borderRadius: 28,
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 26,
          bottom: 24,
          display: "flex",
          color: colors.dim,
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: 2,
        }}
      >
        GEO
      </div>
    </div>
  );
}
