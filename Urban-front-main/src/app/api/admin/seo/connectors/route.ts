import { NextResponse } from "next/server";

import { getSeoConnectorOperationalStatus } from "../../../../lib/seo-connectors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  return NextResponse.json(getSeoConnectorOperationalStatus(), {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
