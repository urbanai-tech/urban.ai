/**
 * Estações de metrô/CPTM de São Paulo — dataset SEED para o cálculo de
 * `metroDistance` (FeatureEngineeringService.computeMetroDistancePending).
 *
 * ⚠️ IMPORTANTE — dados a validar antes de uso em produção:
 * As coordenadas abaixo são APROXIMADAS (conjunto representativo dos principais
 * hubs das linhas 1-Azul, 2-Verde, 3-Vermelha, 4-Amarela, 5-Lilás e 15-Prata).
 * Antes de confiar nesta feature no motor de pricing, SUBSTITUIR pela lista
 * completa e georreferenciada da fonte oficial:
 *   - GTFS da SPTrans / Metrô-SP / CPTM (estações + lat/lng precisos), ou
 *   - dataset aberto "Estações de Metrô e CPTM" do GeoSampa.
 * O cálculo de "estação mais próxima" com um conjunto esparso SUPERESTIMA a
 * distância — por isso a lista completa importa. O algoritmo (haversine) já é
 * definitivo; só a tabela de coordenadas precisa ser trocada.
 *
 * Formato: [nome, latitude, longitude].
 */
export interface MetroStation {
  name: string;
  lat: number;
  lng: number;
}

export const SP_METRO_STATIONS: MetroStation[] = [
  // Linha 1-Azul (norte-sul, eixo central)
  { name: 'Tucuruvi', lat: -23.4802, lng: -46.6021 },
  { name: 'Santana', lat: -23.5024, lng: -46.6284 },
  { name: 'Luz', lat: -23.5347, lng: -46.6353 },
  { name: 'Sé', lat: -23.5503, lng: -46.6339 },
  { name: 'Liberdade', lat: -23.5587, lng: -46.6350 },
  { name: 'Paraíso', lat: -23.5760, lng: -46.6398 },
  { name: 'Ana Rosa', lat: -23.5817, lng: -46.6386 },
  { name: 'Jabaquara', lat: -23.6462, lng: -46.6414 },
  // Linha 2-Verde (Paulista / leste)
  { name: 'Vila Madalena', lat: -23.5466, lng: -46.6907 },
  { name: 'Consolação', lat: -23.5580, lng: -46.6607 },
  { name: 'Trianon-Masp', lat: -23.5615, lng: -46.6559 },
  { name: 'Brigadeiro', lat: -23.5686, lng: -46.6486 },
  { name: 'Chácara Klabin', lat: -23.5905, lng: -46.6289 },
  { name: 'Vila Prudente', lat: -23.5847, lng: -46.5806 },
  // Linha 3-Vermelha (leste-oeste)
  { name: 'Palmeiras-Barra Funda', lat: -23.5270, lng: -46.6656 },
  { name: 'República', lat: -23.5434, lng: -46.6420 },
  { name: 'Anhangabaú', lat: -23.5470, lng: -46.6375 },
  { name: 'Brás', lat: -23.5479, lng: -46.6157 },
  { name: 'Tatuapé', lat: -23.5405, lng: -46.5766 },
  { name: 'Itaquera', lat: -23.5405, lng: -46.4714 },
  // Linha 4-Amarela
  { name: 'Luz (L4)', lat: -23.5340, lng: -46.6355 },
  { name: 'República (L4)', lat: -23.5438, lng: -46.6425 },
  { name: 'Paulista', lat: -23.5553, lng: -46.6620 },
  { name: 'Faria Lima', lat: -23.5672, lng: -46.6935 },
  { name: 'Pinheiros', lat: -23.5670, lng: -46.7020 },
  { name: 'Butantã', lat: -23.5716, lng: -46.7083 },
  // Linha 5-Lilás
  { name: 'Santa Cruz', lat: -23.5989, lng: -46.6398 },
  { name: 'Moema', lat: -23.6103, lng: -46.6636 },
  { name: 'Campo Belo', lat: -23.6209, lng: -46.6668 },
  { name: 'Capão Redondo', lat: -23.6672, lng: -46.7807 },
  // Linha 15-Prata (monotrilho leste)
  { name: 'Oratório', lat: -23.5936, lng: -46.5583 },
  { name: 'São Lucas', lat: -23.6017, lng: -46.5375 },
];
