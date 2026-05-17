import Footer from "../componentes/Footer";

export default function AddressVerificationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen" style={{ background: "#FAFAFB" }}>
      {children}
      <Footer />
    </div>
  );
}
