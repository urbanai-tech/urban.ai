import type { Metadata } from "next";
import { contentMetadata, SeoContentPage } from "../seoContent";
import { staysIntegrationPricing } from "../seoPagesData";

export const metadata: Metadata = contentMetadata(staysIntegrationPricing);

export default function Page() {
  return <SeoContentPage content={staysIntegrationPricing} />;
}
