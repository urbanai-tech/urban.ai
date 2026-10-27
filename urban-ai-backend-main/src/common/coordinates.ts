/**
 * Validação única de coordenadas vindas de scraping/geocodificação.
 *
 * Armadilha que isto evita: `Number(null) === 0` e `Number('') === 0`, então um scrape sem
 * coordenadas passava no `Number.isFinite` e o endereço era salvo em 0,0 (Golfo da Guiné).
 * Aqui null/undefined/''/texto em branco, NaN, infinitos, fora de faixa e 0,0 exato são "sem coordenadas".
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/** Converte para número finito; null quando ausente/vazio/inválido (nunca devolve 0 por engano). */
export function parseCoordinate(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    if (value.trim() === '') return null;
    const parsed = Number(value.trim().replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  return null;
}

/** Par válido (lat ±90, lng ±180, diferente de 0,0) ou null. */
export function parseCoordinates(latitude: unknown, longitude: unknown): Coordinates | null {
  const lat = parseCoordinate(latitude);
  const lng = parseCoordinate(longitude);
  if (lat === null || lng === null) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return { latitude: lat, longitude: lng };
}

export function hasValidCoordinates(latitude: unknown, longitude: unknown): boolean {
  return parseCoordinates(latitude, longitude) !== null;
}
