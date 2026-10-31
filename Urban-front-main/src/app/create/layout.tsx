// Só carrega o CSS do app (ver src/app/app.css); não altera a árvore.
import "../app.css";

import { appMetadata } from "../lib/pageTitle";

export const metadata = appMetadata("Criar conta");

export default function CreateLayout({ children }: { children: React.ReactNode }) {
  return children;
}
