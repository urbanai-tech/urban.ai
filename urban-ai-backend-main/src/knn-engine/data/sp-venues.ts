/**
 * IA-3c — capacidade física dos principais venues de São Paulo.
 *
 * Serve de **teto estrutural** para estimar público (resolveAttendance já
 * consome `venueCapacity`): um evento num Allianz de 43k não gera mais demanda
 * de hospedagem que a capacidade do local. Onde não há público informado, a
 * capacidade do venue (com um desconto de sell-through) vira o prior — muito
 * melhor que o chute do LLM.
 *
 * Curadoria: valores atuais realistas, cruzados com Wikidata (P1083). O
 * Wikidata sozinho traz ruído (cinemas, presídios) e capacidade HISTÓRICA de
 * arquibancada em pé (ex.: Morumbi 120k = era pré-numeração; hoje ~66k), por
 * isso a lista é curada. Nomes/aliases são normalizados em runtime pelo mesmo
 * `EventIdentityService.normalizeVenue()` usado no matching de eventos, então
 * ficam alinhados aos alias groups já existentes lá.
 *
 * Para estender: adicionar linha aqui (a normalização e o índice são
 * recalculados no boot do VenueCapacityService).
 *
 * venueType: 'stadium' | 'arena' | 'concert_hall' | 'convention_center'
 *          | 'theater' | 'racetrack' | 'sambadrome'
 */
export interface VenueCapacity {
  name: string;
  capacity: number;
  venueType: string;
  lat?: number;
  lng?: number;
  /** Nomes alternativos (antigos/comerciais) para ajudar o matching. */
  aliases?: string[];
}

export const SP_VENUES: VenueCapacity[] = [
  // ---- Estádios ----
  {
    name: 'Estádio do Morumbi',
    capacity: 66000,
    venueType: 'stadium',
    lat: -23.6009,
    lng: -46.7196,
    aliases: ['MorumBIS', 'Morumbi', 'Cícero Pompeu de Toledo', 'Estadio do Morumbi'],
  },
  {
    name: 'Neo Química Arena',
    capacity: 47000,
    venueType: 'stadium',
    lat: -23.5453,
    lng: -46.4742,
    aliases: ['Arena Corinthians', 'Itaquerão', 'Itaquerao', 'Arena Itaquera'],
  },
  {
    name: 'Allianz Parque',
    capacity: 43000,
    venueType: 'arena',
    lat: -23.5273,
    lng: -46.6786,
    aliases: ['Palestra Itália', 'Arena Palestra', 'Estádio Palestra Itália'],
  },
  {
    name: 'Estádio do Pacaembu',
    capacity: 37000,
    venueType: 'stadium',
    lat: -23.5486,
    lng: -46.6669,
    aliases: ['Pacaembu', 'Arena Pacaembu'],
  },
  {
    name: 'Estádio do Canindé',
    capacity: 21000,
    venueType: 'stadium',
    lat: -23.5137,
    lng: -46.6108,
    aliases: ['Canindé', 'Portuguesa', 'Oswaldo Teixeira Duarte'],
  },

  // ---- Autódromo (grandes festivais: Lollapalooza, F1) ----
  {
    name: 'Autódromo de Interlagos',
    capacity: 110000,
    venueType: 'racetrack',
    lat: -23.7036,
    lng: -46.6997,
    aliases: ['Interlagos', 'Autódromo José Carlos Pace', 'Autodromo de Interlagos', 'GP São Paulo'],
  },

  // ---- Complexo Anhembi ----
  {
    // O normalizeVenue() colapsa Sambódromo/Distrito/Pavilhão todos em 'anhembi'
    // (não dá pra distinguir por nome), então mantemos UM registro conservador
    // para o complexo. Capacidade ~35k é o típico dos eventos do Anhembi.
    name: 'Anhembi',
    capacity: 35000,
    venueType: 'convention_center',
    lat: -23.5107,
    lng: -46.6285,
    aliases: [
      'Sambódromo do Anhembi',
      'Sambódromo',
      'Distrito Anhembi',
      'Arena Anhembi',
      'Palácio de Convenções do Anhembi',
      'Polo Cultural Grande Otelo',
    ],
  },

  // ---- Centros de convenção / feiras ----
  {
    name: 'São Paulo Expo',
    capacity: 40000,
    venueType: 'convention_center',
    lat: -23.6296,
    lng: -46.6653,
    aliases: ['SP Expo', 'São Paulo Expo Exhibition', 'Imigrantes Expo'],
  },
  {
    name: 'Expo Center Norte',
    capacity: 25000,
    venueType: 'convention_center',
    lat: -23.5158,
    lng: -46.6205,
    aliases: ['Expo Center Norte', 'Center Norte'],
  },

  // ---- Casas de show / arenas indoor ----
  {
    name: 'Espaço Unimed',
    capacity: 8000,
    venueType: 'concert_hall',
    lat: -23.5271,
    lng: -46.665,
    aliases: ['Espaço das Américas', 'Espaco Unimed', 'Espaco das Americas'],
  },
  {
    name: 'Vibra São Paulo',
    capacity: 7000,
    venueType: 'concert_hall',
    lat: -23.6188,
    lng: -46.6413,
    aliases: ['Credicard Hall', 'Citibank Hall', 'Vibra'],
  },
  {
    name: 'Ginásio do Ibirapuera',
    capacity: 11000,
    venueType: 'arena',
    lat: -23.5878,
    lng: -46.6553,
    aliases: ['Ibirapuera', 'Ginásio Geraldo José de Almeida'],
  },
  {
    name: 'Audio',
    capacity: 3000,
    venueType: 'concert_hall',
    lat: -23.5258,
    lng: -46.6907,
    aliases: ['Audio Club', 'Audio SP'],
  },
  {
    name: 'Tokio Marine Hall',
    capacity: 2800,
    venueType: 'concert_hall',
    lat: -23.6017,
    lng: -46.7208,
    aliases: ['HSBC Brasil', 'Via Funchal', 'Tokio Marine'],
  },
  {
    name: 'Cine Joia',
    capacity: 1200,
    venueType: 'concert_hall',
    lat: -23.5497,
    lng: -46.6337,
    aliases: ['Cine Joia', 'Cinejoia'],
  },

  // ---- Teatros (menores; cruzados com Wikidata) ----
  {
    name: 'Teatro Bradesco',
    capacity: 1440,
    venueType: 'theater',
    lat: -23.5323,
    lng: -46.6784,
    aliases: ['Teatro Bradesco', 'Bourbon Shopping'],
  },
  {
    name: 'Teatro Renault',
    capacity: 1500,
    venueType: 'theater',
    lat: -23.5432,
    lng: -46.6415,
    aliases: ['Teatro Abril', 'Teatro Paramount'],
  },
  {
    name: 'Teatro Santander',
    capacity: 1000,
    venueType: 'theater',
    lat: -23.6087,
    lng: -46.6969,
    aliases: ['Teatro Santander', 'JK Iguatemi'],
  },
];
