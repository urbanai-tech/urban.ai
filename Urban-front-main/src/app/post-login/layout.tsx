// app/(interno)/layout.tsx
import "../app.css";
import Footer from '../componentes/Footer'
import styles from './layout.module.css'

export default function InternoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell} style={{ background: "#FAFAFB" }}>
      {children}
      <Footer />
    </div>
  )
}
