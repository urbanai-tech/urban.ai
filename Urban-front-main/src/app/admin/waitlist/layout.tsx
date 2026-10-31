import { adminMetadata } from "../../lib/pageTitle";

export const metadata = adminMetadata("Lista de espera");


export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
