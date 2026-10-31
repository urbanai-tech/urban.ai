/**
 * Layout mínimo para a rota legada /price.
 */
import "../app.css";

import { appMetadata } from "../lib/pageTitle";

export const metadata = appMetadata("Preço sugerido");

export default function PriceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
