import "../app.css";
import Footer from "../componentes/Footer";
import styles from "./layout.module.css";
import { appMetadata } from "../lib/pageTitle";

export const metadata = appMetadata("Verificar endereço");

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
