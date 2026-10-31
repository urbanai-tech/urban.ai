import { adminMetadata } from "../../lib/pageTitle";

export const metadata = adminMetadata("Usuários");


export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
