/**
 * `PropriedadeService.scrapeAirbnbListing` nunca lança: quando a leitura falha devolve um
 * "snapshot vazio" (título `Imóvel <id>`, tipo `Desconhecido`, contagens 0, sem coordenadas).
 * Gravar isso sobrescreveria dados bons (ou do anfitrião) com zeros, então os chamadores
 * usam este detector antes de persistir (ADR 0010).
 */
export function isEmptyScrapeSnapshot(snapshot: {
  propertyType?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  bedrooms?: number | null;
  guestCapacity?: number | null;
} | null | undefined): boolean {
  if (!snapshot) return true;
  const noCoordinates = snapshot.latitude == null || snapshot.longitude == null;
  const unknownType = String(snapshot.propertyType ?? '').trim().toLowerCase() === 'desconhecido';
  const noCounts = !Number(snapshot.bedrooms) && !Number(snapshot.guestCapacity);
  return noCoordinates && unknownType && noCounts;
}
