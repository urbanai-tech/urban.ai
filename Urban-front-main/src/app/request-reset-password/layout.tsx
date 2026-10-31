// Só carrega o CSS do app (ver src/app/app.css); não altera a árvore.
import "../app.css";

import { appMetadata } from "../lib/pageTitle";

export const metadata = appMetadata("Recuperar senha");

export default function RequestResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
