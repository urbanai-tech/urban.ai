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
  const apikey = 'M90_LVeTkY8El5SPUkIQs-p79g0F8vNF3jwXTlI_GFA';
  const url = `https://router.hereapi.com/v8/routes?transportMode=${transportMode}&origin=${originLat},${originLng}&destination=${destinationLat},${destinationLng}&apikey=${apikey}&return=summary`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Erro ao buscar rota: ${response.statusText}`);
  }

  const data = await response.json();

  const section = data?.routes?.[0]?.sections?.[0];
  const summary = section?.summary;
  const mode = section?.transport?.mode;

  if (!summary || !mode) {
    throw new Error('Resumo da rota não encontrado');
  }

  return {
    duration: summary.duration,         // em segundos (Significado: Tempo total estimado de viagem, em segundos.)
    length: summary.length,             // em metros (Comprimento total da rota, em metros.)
    baseDuration: summary.baseDuration, // em segundos
    mode: mode                          // ex: "car"
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

