import {
  saoPauloDaySql,
  addDaysToDateKey,
  parseEventDateTime,
  saoPauloDayBounds,
  saoPauloLocalToInstant,
  todaySaoPauloDateKey,
  toDayKey,
  toSaoPauloDateKey,
  tryToSaoPauloDateKey,
} from './sp-date';

describe('saoPauloDaySql', () => {
  it('converte do fuso da sessão para -03:00 e devolve texto YYYY-MM-DD (sem DATE solto)', () => {
    const sql = saoPauloDaySql('e.dataCrawl');
    expect(sql).toBe("DATE_FORMAT(CONVERT_TZ(e.dataCrawl, @@session.time_zone, '-03:00'), '%Y-%m-%d')");
    expect(sql).not.toMatch(/^DATE\(/);
  });
});

describe('sp-date', () => {
  describe('toSaoPauloDateKey', () => {
    it('usa o dia de São Paulo, não o dia UTC, para jogo das 21:30 BRT', () => {
      const kickoff = new Date('2026-05-11T00:30:00Z'); // 21:30 BRT de 10/05
      expect(kickoff.toISOString().slice(0, 10)).toBe('2026-05-11'); // armadilha antiga
      expect(toSaoPauloDateKey(kickoff)).toBe('2026-05-10');
    });

    it('respeita a fronteira da meia-noite UTC (BRT = UTC-3)', () => {
      expect(toSaoPauloDateKey('2026-05-10T02:59:59.999Z')).toBe('2026-05-09');
      expect(toSaoPauloDateKey('2026-05-10T03:00:00.000Z')).toBe('2026-05-10');
      expect(toSaoPauloDateKey('2026-05-10T23:59:59.999-03:00')).toBe('2026-05-10');
    });

    it('vira o ano corretamente', () => {
      expect(toSaoPauloDateKey('2027-01-01T01:00:00Z')).toBe('2026-12-31');
      expect(toSaoPauloDateKey('2027-01-01T03:00:00Z')).toBe('2027-01-01');
    });

    it('lança em data inválida e tryTo devolve null', () => {
      expect(() => toSaoPauloDateKey('nao-e-data')).toThrow(RangeError);
      expect(tryToSaoPauloDateKey('nao-e-data')).toBeNull();
      expect(tryToSaoPauloDateKey(null)).toBeNull();
      expect(tryToSaoPauloDateKey('')).toBeNull();
      expect(tryToSaoPauloDateKey('2026-05-11T00:30:00Z')).toBe('2026-05-10');
    });

    it('todaySaoPauloDateKey usa o relógio injetado', () => {
      expect(todaySaoPauloDateKey(new Date('2026-10-24T01:00:00Z'))).toBe('2026-10-23');
    });
  });

  describe('toDayKey', () => {
    it('data pura passa direto; instantes viram o dia de São Paulo', () => {
      expect(toDayKey('2026-05-10')).toBe('2026-05-10');
      expect(toDayKey(new Date('2026-05-11T00:30:00Z'))).toBe('2026-05-10');
      expect(toDayKey('2026-05-11T00:30:00Z')).toBe('2026-05-10');
      expect(toDayKey('lixo')).toBeNull();
      expect(toDayKey(null)).toBeNull();
    });
  });

  describe('saoPauloLocalToInstant / saoPauloDayBounds', () => {
    it('21:30 BRT vira 00:30Z do dia seguinte', () => {
      expect(saoPauloLocalToInstant(2026, 5, 10, 21, 30).toISOString()).toBe('2026-05-11T00:30:00.000Z');
    });

    it('limites do dia em São Paulo', () => {
      const { start, end } = saoPauloDayBounds('2026-05-10');
      expect(start.toISOString()).toBe('2026-05-10T03:00:00.000Z');
      expect(end.toISOString()).toBe('2026-05-11T02:59:59.999Z');
    });

    it('datas históricas com horário de verão usam o offset da época', () => {
      // Jan/2018 ainda tinha horário de verão (UTC-2).
      expect(saoPauloLocalToInstant(2018, 1, 15, 12, 0).toISOString()).toBe('2018-01-15T14:00:00.000Z');
    });

    it('rejeita chave malformada', () => {
      expect(() => saoPauloDayBounds('10/05/2026')).toThrow(RangeError);
    });
  });

  describe('addDaysToDateKey', () => {
    it('soma dias de calendário', () => {
      expect(addDaysToDateKey('2026-12-31', 1)).toBe('2027-01-01');
      expect(addDaysToDateKey('2026-03-01', -1)).toBe('2026-02-28');
    });
  });

  describe('parseEventDateTime', () => {
    it('offset explícito: instante absoluto', () => {
      const r = parseEventDateTime('2026-05-10T21:30:00-03:00');
      expect(r?.instant.toISOString()).toBe('2026-05-11T00:30:00.000Z');
      expect(r?.interpretedAs).toBe('offset');
      expect(parseEventDateTime('2026-05-11T00:30:00Z')?.instant.toISOString()).toBe('2026-05-11T00:30:00.000Z');
    });

    it('sem offset: horário de São Paulo (com T ou espaço)', () => {
      expect(parseEventDateTime('2026-05-10 21:30:00')?.instant.toISOString()).toBe('2026-05-11T00:30:00.000Z');
      expect(parseEventDateTime('2026-05-10T21:30')?.instant.toISOString()).toBe('2026-05-11T00:30:00.000Z');
      expect(parseEventDateTime('2026-05-10T21:30:00')?.interpretedAs).toBe('sao_paulo_local');
    });

    it('independe do TZ do processo para datetimes sem offset', () => {
      const original = process.env.TZ;
      process.env.TZ = 'Asia/Tokyo';
      try {
        expect(parseEventDateTime('2026-05-10 21:30:00')?.instant.toISOString()).toBe('2026-05-11T00:30:00.000Z');
      } finally {
        if (original === undefined) delete process.env.TZ;
        else process.env.TZ = original;
      }
    });

    it('somente data: dia inteiro em São Paulo', () => {
      const start = parseEventDateTime('2026-05-10');
      expect(start?.dateOnly).toBe(true);
      expect(start?.instant.toISOString()).toBe('2026-05-10T03:00:00.000Z');
      const end = parseEventDateTime('2026-05-10', { asEndOfDay: true });
      expect(end?.instant.toISOString()).toBe('2026-05-11T02:59:59.999Z');
      expect(toSaoPauloDateKey(start!.instant)).toBe('2026-05-10');
      expect(toSaoPauloDateKey(end!.instant)).toBe('2026-05-10');
    });

    it('Date passa direto; vazio e inválido viram null', () => {
      const d = new Date('2026-05-11T00:30:00Z');
      expect(parseEventDateTime(d)?.instant.getTime()).toBe(d.getTime());
      expect(parseEventDateTime(null)).toBeNull();
      expect(parseEventDateTime('')).toBeNull();
      expect(parseEventDateTime('amanha')).toBeNull();
      expect(parseEventDateTime('2026-02-31')).toBeNull();
      expect(parseEventDateTime('2026-05-10 25:00:00')).toBeNull();
      expect(parseEventDateTime(new Date('x'))).toBeNull();
    });
  });
});
