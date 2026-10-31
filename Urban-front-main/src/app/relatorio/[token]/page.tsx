import PublicOwnerReport from "./PublicOwnerReport";

export default async function OwnerReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PublicOwnerReport token={token} />;
}
