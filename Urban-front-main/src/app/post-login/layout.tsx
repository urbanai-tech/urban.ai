// app/(interno)/layout.tsx
import "../app.css";
import Footer from '../componentes/Footer'
import styles from './layout.module.css'
import { appMetadata } from "../lib/pageTitle";

export const metadata = appMetadata("Entrando");

export default function InternoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell} style={{ background: "#FAFAFB" }}>
      {children}
      <Footer />
    </div>
  )
}
