import type { Metadata } from "next";
import { contentMetadata, SeoContentPage } from "../seoContent";
import { spreadsheetComparison } from "../seoPagesData";

export const metadata: Metadata = contentMetadata(spreadsheetComparison);

export default function Page() {
  return <SeoContentPage content={spreadsheetComparison} />;
}
