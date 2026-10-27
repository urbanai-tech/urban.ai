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
      className={`${styles.s1} ${onClick ? styles.s2 : styles.s3}`}
    >
      <div className={styles.s4}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://a0.muscache.com/im/pictures/042cca29-c44c-4370-8c99-f0f5eb74baac.jpg?im_w=960"
          alt={title}
          className={styles.s5}
        />

        <div className={styles.s6}>
          <h3 className={styles.s7}>
            {title}
          </h3>
          <p className={styles.s8}>
            {address}
          </p>

          <div className={styles.s9}>
            <span
              className={`${styles.s10} ${casa.ativo ? styles.s11 : styles.s12}`}
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
