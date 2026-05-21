import type { Metadata } from "next";
import { contentMetadata, SeoContentPage } from "../seoContent";
import { saoPauloEventsPricing } from "../seoPagesData";

export const metadata: Metadata = contentMetadata(saoPauloEventsPricing);

export default function Page() {
  return <SeoContentPage content={saoPauloEventsPricing} />;
}
