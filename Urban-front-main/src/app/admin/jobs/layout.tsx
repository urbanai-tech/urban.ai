import { adminMetadata } from "../../lib/pageTitle";

export const metadata = adminMetadata("Tarefas do sistema");


export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
