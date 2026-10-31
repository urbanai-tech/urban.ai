import { adminMetadata } from "../../lib/pageTitle";

export const metadata = adminMetadata("Stays");


export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
