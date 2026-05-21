import type { Metadata } from "next";
import { contentMetadata, SeoContentPage } from "../seoContent";
import { eventPricingGuide } from "../seoPagesData";

export const metadata: Metadata = contentMetadata(eventPricingGuide);

export default function Page() {
  return <SeoContentPage content={eventPricingGuide} />;
}
