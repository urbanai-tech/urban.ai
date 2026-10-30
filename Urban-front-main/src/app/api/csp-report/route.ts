import { handleCspReport } from "../../lib/csp-report";

// Relatórios de violação de CSP enviados pelo navegador (report-uri/report-to).
// Fora do middleware (matcher exclui /api) e sem autenticação por desenho:
// o navegador envia sem cookies de sessão. Tamanho limitado, sem PII, 204.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function POST(request: Request) {
  return handleCspReport(request);
}
