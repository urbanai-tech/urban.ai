// app/(interno)/layout.tsx
import Header from '../componentes/header'
import Footer from '../componentes/Footer'

export default function InternoLayout({ children }: { children: React.ReactNode }) {
  return (
       <div className="min-h-screen bg-[#f8fafb]">
      <Header />
      {children}
      <Footer />
    </div>
  )
}
