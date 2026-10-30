"use client";

import NextLink from "next/link";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

/**
 * /forbidden — página 403 amigável.
 *
 * Usada quando guards (admin/PaymentCheck/AuthGuard) decidem que o usuário
 * não tem permissão. Editorial, segue o tema (claro/escuro), consistente com 404/erro.
 */
export default function ForbiddenPage() {
  const router = useRouter();

  return (
    <main className={`urban-manifesto ${styles.page}`}>
      <div className={`urban-glow ${styles.glow}`} aria-hidden />
      <div className={styles.content}>
        <p className={styles.eyebrow}>ERRO 403 — ACESSO NEGADO</p>
        <h1 className={`urban-display ${styles.title}`}>
          VOCÊ NÃO TEM
          <br />
          <span className={styles.titleAccent}>PERMISSÃO AQUI.</span>
        </h1>
        <p className={styles.lead}>
          Essa área é restrita. Se você acredita que deveria ter acesso, fale
          com a equipe ou volte pro painel.
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            onClick={() => router.back()}
            className={styles.primaryAction}
          >
            ← Voltar
          </button>
          <NextLink href="/painel" className={styles.secondaryAction}>
            Ir pro painel
          </NextLink>
        </div>
      </div>
    </main>
  );
}
