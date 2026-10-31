import { adminMetadata } from "../../lib/pageTitle";

export const metadata = adminMetadata("Imóveis detalhados");


export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
