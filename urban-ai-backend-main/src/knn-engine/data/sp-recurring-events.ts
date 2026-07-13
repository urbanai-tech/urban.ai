/**
 * IA-3b/3c — seed curado de eventos recorrentes de São Paulo com público real.
 *
 * O Wikidata (P1110) não cobre os grandes festivais de SP; então estes números
 * foram extraídos das páginas da Wikipedia (via Firecrawl) — dados públicos e
 * verificáveis, com a URL de origem. Servem de âncora imediata (3b) até o
 * feedback loop acumular resultado real, e são reatualizados pelo
 * EventHistoricalService.refreshFromFirecrawl() a cada nova edição.
 *
 * `attendance` = público representativo por edição (mediana das edições recentes
 * conhecidas — conservador contra o ramp inicial e outliers). `canonicalName` já
 * é a chave de série (nome sem ano), casada com events.normalizedName via seriesKey.
 */
export interface RecurringEventSeed {
  /** Chave de série (nome normalizado sem ano) — junção com o evento. */
  canonicalName: string;
  displayName: string;
  attendance: number;
  /** Página fonte (Wikipedia) para o refresh via Firecrawl. */
  sourceUrl: string;
  /** Edições conhecidas (ano→público), para auditoria/atualização. */
  knownEditions?: Array<{ year: number; attendance: number }>;
}

export const SP_RECURRING_EVENTS: RecurringEventSeed[] = [
  {
    canonicalName: 'ccxp',
    displayName: 'CCXP',
    attendance: 262000, // mediana das últimas edições conhecidas (2017-2019)
    sourceUrl: 'https://en.wikipedia.org/wiki/CCXP',
    knownEditions: [
      { year: 2014, attendance: 100000 },
      { year: 2015, attendance: 142000 },
      { year: 2016, attendance: 196000 },
      { year: 2017, attendance: 227451 },
      { year: 2018, attendance: 262000 },
      { year: 2019, attendance: 280000 },
    ],
  },
  {
    canonicalName: 'lollapalooza brasil',
    displayName: 'Lollapalooza Brasil',
    attendance: 100000, // estável ~100k/edição nas edições recentes
    sourceUrl: 'https://pt.wikipedia.org/wiki/Lollapalooza_Brasil',
    knownEditions: [
      { year: 2015, attendance: 100000 },
      { year: 2018, attendance: 100000 },
      { year: 2022, attendance: 100000 },
      { year: 2023, attendance: 100000 },
    ],
  },
  {
    canonicalName: 'the town',
    displayName: 'The Town',
    attendance: 325000, // mediana de 2023 (300k) e 2024 (350k)
    sourceUrl: 'https://en.wikipedia.org/wiki/The_Town_(music_festival)',
    knownEditions: [
      { year: 2023, attendance: 300000 },
      { year: 2024, attendance: 350000 },
    ],
  },
];
