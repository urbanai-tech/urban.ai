// app/(interno)/layout.tsx
import Footer from '../componentes/Footer'

export default function InternoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#FAFAFB" }}>
      {children}
      <Footer />
    </div>
  )
}
