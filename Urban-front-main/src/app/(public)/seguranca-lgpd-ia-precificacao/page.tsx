import type { Metadata } from "next";
import { contentMetadata, SeoContentPage } from "../seoContent";
import { lgpdSecurityPricing } from "../seoPagesData";

export const metadata: Metadata = contentMetadata(lgpdSecurityPricing);

export default function Page() {
  return <SeoContentPage content={lgpdSecurityPricing} />;
}
