// components/CasaCard.tsx
'use client';

import { AlertTriangle, CheckCircle } from 'lucide-react';

interface Casa {
  id: string;
  list?: {
    titulo?: string;
  };
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  latitude: number;
  longitude: number;
  ativo: boolean;
}

interface CasaCardProps {
  casa: Casa;
  onClick?: () => void;
}

export default function CasaCard({ casa, onClick }: CasaCardProps) {
  const title = casa.list?.titulo || 'Sem título';
  const address = `${casa.logradouro}, ${casa.numero} - ${casa.bairro}, ${casa.cidade} - ${casa.estado}, ${casa.cep}`;

  return (
    <article
      onClick={onClick}
      style={{
        width: "100%",
        overflow: "hidden",
        border: "1px solid rgba(14,17,22,0.06)",
        borderRadius: 12,
        background: "#fff",
        boxShadow: "0 1px 2px rgba(14,17,22,0.04)",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 24, padding: 24 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://a0.muscache.com/im/pictures/042cca29-c44c-4370-8c99-f0f5eb74baac.jpg?im_w=960"
          alt={title}
          style={{
            width: 120,
            height: 120,
            borderRadius: 10,
            objectFit: "cover",
            flexShrink: 0,
          }}
        />

        <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <h3 style={{ margin: 0, color: "#0E1116", fontSize: 18, lineHeight: 1.25, fontWeight: 700 }}>
            {title}
          </h3>
          <p style={{ margin: 0, color: "rgba(14,17,22,0.62)", fontSize: 14, lineHeight: 1.5 }}>
            {address}
          </p>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                color: casa.ativo ? "#16A06B" : "#C2342E",
                fontSize: 13,
                fontWeight: 650,
              }}
            >
              {casa.ativo ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
              {casa.ativo ? "Ativo" : "Inativo"}
            </span>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          article > div {
            align-items: flex-start !important;
            flex-direction: column !important;
          }

          article > div > img {
            width: 100% !important;
            height: 180px !important;
          }
        }
      `}</style>
    </article>
  );
}
