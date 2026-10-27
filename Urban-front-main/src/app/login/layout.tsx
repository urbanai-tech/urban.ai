// Só carrega o CSS do app (ver src/app/app.css); não altera a árvore.
import "../app.css";

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
