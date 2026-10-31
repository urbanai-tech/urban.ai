import { adminMetadata } from "../../lib/pageTitle";

export const metadata = adminMetadata("Painel executivo");


export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
