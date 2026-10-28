// components/CasaCard.tsx
'use client';

import { AlertTriangle, CheckCircle } from 'lucide-react';
import styles from "./CasaCard.module.css";

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
      className={`${styles.cardBase} ${onClick ? styles.cardClickable : styles.cardStatic}`}
    >
      <div className={styles.cardContent}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://a0.muscache.com/im/pictures/042cca29-c44c-4370-8c99-f0f5eb74baac.jpg?im_w=960"
          alt={title}
          className={styles.cardImage}
        />

        <div className={styles.cardInfo}>
          <h3 className={styles.cardTitle}>
            {title}
          </h3>
          <p className={styles.cardSubtitle}>
            {address}
          </p>

          <div className={styles.statusRow}>
            <span
              className={`${styles.statusBadge} ${casa.ativo ? styles.statusActive : styles.statusInactive}`}
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
