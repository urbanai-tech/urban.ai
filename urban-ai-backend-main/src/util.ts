export async function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): Promise<number> {
  const R = 6371; 
  const toRad = (value: number) => value * Math.PI / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function calculateDistanceHere(
  originLat: number,
  originLng: number,
  destinationLat: number,
  destinationLng: number,
  transportMode: string,
): Promise<{
  duration: number;
  length: number;
  baseDuration: number;
  mode: string;
}> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  // Mapeia transport modes do formato antigo (HERE) para o Google Maps
  const modeMap: Record<string, string> = {
    car: 'DRIVE',
    bus: 'TRANSIT',
    pedestrian: 'WALK',
    walk: 'WALK',
    bicycle: 'BICYCLE',
  };
  const travelMode = modeMap[transportMode] || 'DRIVE';

  const url = `https://routes.googleapis.com/directions/v2:computeRoutes`;

  const body = {
    origin: {
      location: {
        latLng: { latitude: originLat, longitude: originLng },
      },
    },
    destination: {
      location: {
        latLng: { latitude: destinationLat, longitude: destinationLng },
      },
    },
    travelMode,
    routingPreference: travelMode === 'DRIVE' ? 'TRAFFIC_AWARE' : undefined,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Erro ao buscar rota Google Maps: ${response.statusText}`);
  }

  const data = await response.json();
  const route = data?.routes?.[0];

  if (!route) {
    throw new Error('Rota não encontrada no Google Maps');
  }

  // duration vem como "123s" (string), convertemos para número de segundos
  const durationSeconds = parseInt(route.duration?.replace('s', '') || '0', 10);
  const distanceMeters = route.distanceMeters || 0;

  return {
    duration: durationSeconds,
    length: distanceMeters,
    baseDuration: durationSeconds,
    mode: transportMode,
  };
}


export function aproximadamenteOuMenor(a: number, b: number, tolerancia = 2) {
  const aAjustado = a * 1.3; // aumenta 30%
  return Math.abs(aAjustado - b) <= tolerancia || b < aAjustado;
}


export function getDiaria(obj) {
  const total = obj.price.data.accommodationCost;
  const title = obj.price.data.accommodationCostTitle;

  const match = title.match(/(\d+)\s*nights?/i);
  const nights = match ? parseInt(match[1]) : 1;

  return total / nights;
}

export function getDiariaForCron(obj: any): number {
  if (!obj?.price?.data) {
    throw new Error('Objeto inválido: preço não encontrado');
  }

  const total = obj.price.data.accommodationCost;
  const title = obj.price.data.accommodationCostTitle || '';

  // extrai número de noites do título (ex: "2 nights x R$155.77")
  const match = title.match(/(\d+)\s*nights?/i);
  const nights = match ? parseInt(match[1], 10) : 1;

  return total / nights;
}

