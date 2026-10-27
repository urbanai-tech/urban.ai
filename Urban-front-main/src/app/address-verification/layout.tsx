import Footer from "../componentes/Footer";

export default function AddressVerificationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--theme-page-bg)", color: "var(--theme-page-text)" }}>
      {children}
      <Footer />
    </div>
  );
}
