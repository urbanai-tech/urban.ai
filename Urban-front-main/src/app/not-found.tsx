import NextLink from "next/link";
import type { Metadata } from "next";
import styles from "./not-found.module.css";
import { appTitle } from "./lib/pageTitle";

export const metadata: Metadata = { title: appTitle("Página não encontrada") };

/**
 * 404 — página não encontrada.
 *
 * Editorial, segue o tema (claro/escuro), consistente com /landing/lancamento/precos.
 * Sem header/footer — tela full-bleed.
 */
export default function NotFound() {
  return (
    <main className={`urban-manifesto ${styles.page}`}>
      <div className={`urban-glow ${styles.glow}`} aria-hidden />
      <div className={styles.content}>
        <p className={styles.eyebrow}>ERRO 404 — PÁGINA NÃO ENCONTRADA</p>
        <h1 className={`urban-display ${styles.title}`}>
          ESSA ROTA
          <br />
          <span className={styles.titleAccent}>NÃO EXISTE.</span>
        </h1>
        <p className={styles.lead}>
          O endereço que você tentou abrir não existe ou foi movido. Sem stress —
          volte pro início.
        </p>
        <div className={styles.actions}>
          <NextLink href="/" className={styles.primaryAction}>
            Voltar ao início →
          </NextLink>
          <NextLink href="/painel" className={styles.secondaryAction}>
            Ir pro painel
          </NextLink>
        </div>
      </div>
    </main>
  );
}
