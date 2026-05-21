import Footer from "../componentes/Footer";

export default function AddressVerificationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: "100vh", background: "#FAFAFB" }}>
      {children}
      <Footer />
    </div>
  );
}
