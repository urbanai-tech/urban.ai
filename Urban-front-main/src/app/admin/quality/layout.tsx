import { adminMetadata } from "../../lib/pageTitle";

export const metadata = adminMetadata("Qualidade");


export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
