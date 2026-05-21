"use client";

import dynamic from "next/dynamic";
import React from "react";
import "../../../i18n";
import EventosProximos from "./components/EventosProximos";
import Filtro from "./components/Filter";

const AirbnbMap = dynamic(() => import("./components/GoogleMapEmbed"), { ssr: false });

export default function Home() {
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div style={{ width: "100%", padding: "64px 16px" }}>
        <SkeletonBlock style={{ width: 300, height: 40, marginBottom: 40 }} />

        <div
          data-maps-bkp-grid
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.8fr) minmax(0, 1fr)",
            gap: 24,
            width: "100%",
          }}
        >
          <SkeletonBlock style={{ height: 500 }} />
          <SkeletonBlock style={{ height: 500 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                style={{
                  padding: 16,
                  borderRadius: 8,
                  background: "#fff",
                  boxShadow: "0 4px 12px rgba(14,17,22,0.08)",
                }}
              >
                <SkeletonBlock style={{ height: 18, marginBottom: 10 }} />
                <SkeletonBlock style={{ height: 18, width: "70%" }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", padding: "64px 16px" }}>
      <h1 style={{ margin: "0 0 40px", color: "#0E1116", fontSize: 40, lineHeight: 1.1 }}>
        Mapa Interativo
      </h1>

      <div
        data-maps-bkp-grid
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.8fr) minmax(0, 1fr)",
          gap: 24,
          width: "100%",
        }}
      >
        <Filtro height="500px" />
        <AirbnbMap height="500px" />
        <EventosProximos height="500px" />
      </div>

      <style>{`
        @media (max-width: 900px) {
          [data-maps-bkp-grid] {
            grid-template-columns: 1fr !important;
          }
        }
        @keyframes maps-bkp-skeleton {
          0% { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
      `}</style>
    </div>
  );
}

function SkeletonBlock({ style }: { style?: React.CSSProperties }) {
  return (
    <div
      style={{
        borderRadius: 8,
        background:
          "linear-gradient(90deg, rgba(14,17,22,0.05) 0%, rgba(14,17,22,0.11) 50%, rgba(14,17,22,0.05) 100%)",
        backgroundSize: "800px 100%",
        animation: "maps-bkp-skeleton 1.4s ease-in-out infinite",
        ...style,
      }}
    />
  );
}
