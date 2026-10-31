import { adminMetadata } from "../../../lib/pageTitle";

export const metadata = adminMetadata("Imóvel");


export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
