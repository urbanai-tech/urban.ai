import { adminMetadata } from "../../lib/pageTitle";

export const metadata = adminMetadata("Financeiro");


export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
