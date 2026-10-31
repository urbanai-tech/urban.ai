import { adminMetadata } from "../../lib/pageTitle";

export const metadata = adminMetadata("Funil");


export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
