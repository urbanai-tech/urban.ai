import type { Metadata } from "next";
import { contentMetadata, SeoContentPage } from "../seoContent";
import { dynamicPricingAirbnb } from "../seoPagesData";

export const metadata: Metadata = contentMetadata(dynamicPricingAirbnb);

export default function Page() {
  return <SeoContentPage content={dynamicPricingAirbnb} />;
}
