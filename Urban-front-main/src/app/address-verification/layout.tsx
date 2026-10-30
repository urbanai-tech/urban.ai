import "../app.css";
import Footer from "../componentes/Footer";
import styles from "./layout.module.css";

export default function AddressVerificationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={styles.shell}>
      {children}
      <Footer />
    </div>
  );
}
