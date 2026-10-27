// Só carrega o CSS do app (ver src/app/app.css); não altera a árvore.
import "../app.css";

export default function ForbiddenLayout({ children }: { children: React.ReactNode }) {
  return children;
}
