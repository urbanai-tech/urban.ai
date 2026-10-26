import {
  aggregateWeeklyPerformance,
  currentSaoPauloWeekStart,
  hasRecordedOutcome,
  isOutcomePending,
  lastFullSaoPauloWeek,
  WeeklyAnalysisRow,
} from './weekly-host-report';

describe('weekly-host-report', () => {
  describe('lastFullSaoPauloWeek', () => {
    it('numa quinta devolve a segunda a domingo anteriores, em horário de São Paulo', () => {
      // 2026-05-21 é quinta.
      const week = lastFullSaoPauloWeek(new Date('2026-05-21T12:00:00Z'));
      expect(week.startKey).toBe('2026-05-11');
      expect(week.endKeyExclusive).toBe('2026-05-18');
      expect(week.start.toISOString()).toBe('2026-05-11T03:00:00.000Z');
      expect(week.endExclusive.toISOString()).toBe('2026-05-18T03:00:00.000Z');
      expect(week.label).toBe('11/05 a 17/05');
    });

    it('na segunda 08:30 BRT (o horário do cron) reporta a semana que acabou de fechar', () => {
      const week = lastFullSaoPauloWeek(new Date('2026-05-18T11:30:00Z'));
      expect(week.startKey).toBe('2026-05-11');
      expect(week.endKeyExclusive).toBe('2026-05-18');
    });

    it('domingo 22:00 BRT ainda é domingo em SP (01:00Z de segunda): semana ainda não fechou', () => {
      const week = lastFullSaoPauloWeek(new Date('2026-05-18T01:00:00Z'));
      expect(week.startKey).toBe('2026-05-04');
      expect(week.endKeyExclusive).toBe('2026-05-11');
    });

    it('segunda 00:30 BRT (03:30Z) já é segunda em SP', () => {
      const week = lastFullSaoPauloWeek(new Date('2026-05-18T03:30:00Z'));
      expect(week.startKey).toBe('2026-05-11');
    });

    it('currentSaoPauloWeekStart é a segunda 00:00 BRT da semana corrente (chave de "uma vez por semana")', () => {
      expect(currentSaoPauloWeekStart(new Date('2026-05-21T12:00:00Z')).toISOString()).toBe('2026-05-18T03:00:00.000Z');
      // Duas réplicas, mesma semana -> mesma chave.
      expect(currentSaoPauloWeekStart(new Date('2026-05-18T11:30:00Z')).getTime()).toBe(
        currentSaoPauloWeekStart(new Date('2026-05-24T23:59:00Z')).getTime(),
      );
      // Domingo 23:59 BRT ainda pertence à semana que começou na segunda anterior.
      expect(currentSaoPauloWeekStart(new Date('2026-05-25T02:59:00Z')).toISOString()).toBe('2026-05-18T03:00:00.000Z');
      expect(currentSaoPauloWeekStart(new Date('2026-05-25T03:00:00Z')).toISOString()).toBe('2026-05-25T03:00:00.000Z');
    });
  });

  const now = new Date('2026-05-21T12:00:00Z'); // quinta; semana reportada = 11/05 a 17/05
  const week = lastFullSaoPauloWeek(now);

  const row = (overrides: Partial<WeeklyAnalysisRow> & { id: string }): WeeklyAnalysisRow => ({
    endereco: { id: 'addr-1' },
    evento: { nome: 'Show', dataInicio: new Date('2026-05-16T22:00:00Z') },
    precoSugerido: '300.00',
    ...overrides,
  });

  describe('aggregateWeeklyPerformance', () => {
    it('conta geradas, aceitas, aplicadas e resultados só dentro da semana de SP', () => {
      const result = aggregateWeeklyPerformance(
        [
          row({ id: 'a', criadoEm: new Date('2026-05-11T03:00:00Z') }), // 1ms depois da abertura: dentro
          row({ id: 'b', criadoEm: new Date('2026-05-11T02:59:59Z') }), // domingo 23:59 BRT anterior: fora
          row({ id: 'c', criadoEm: new Date('2026-05-18T02:59:59Z') }), // domingo 23:59 BRT: dentro
          row({ id: 'd', criadoEm: new Date('2026-05-18T03:00:00Z') }), // segunda 00:00 BRT: fora
          row({ id: 'e', criadoEm: new Date('2026-05-01T12:00:00Z'), aceitoEm: new Date('2026-05-12T12:00:00Z') }),
        ],
        week,
        now,
      );
      const property = result.get('addr-1')!;
      expect(property.generated).toBe(2);
      expect(property.accepted).toBe(1);
      expect(property.applied).toBeNull();
    });

    it('mostra o preço aplicado ao lado da sugestão e soma só a receita que o anfitrião registrou', () => {
      const result = aggregateWeeklyPerformance(
        [
          row({
            id: 'a',
            criadoEm: new Date('2026-05-05T12:00:00Z'),
            aceitoEm: new Date('2026-05-12T12:00:00Z'),
            aplicadoEm: new Date('2026-05-12T12:00:00Z'),
            precoSugerido: '300.00',
            precoAplicado: '280.00',
            resultadoRegistradoEm: new Date('2026-05-15T12:00:00Z'),
            reservaStatus: 'booked',
            receitaReal: '840.00',
            noitesReservadas: 3,
          }),
          row({
            id: 'b',
            aplicadoEm: new Date('2026-05-13T12:00:00Z'),
            precoAplicado: '350.00',
            resultadoRegistradoEm: new Date('2026-05-16T12:00:00Z'),
            reservaStatus: 'not_booked',
          }),
        ],
        week,
        now,
      );
      const property = result.get('addr-1')!;
      expect(property.applied).toBe(2);
      expect(property.appliedItems[0]).toMatchObject({ suggestedPrice: 300, appliedPrice: 280 });
      expect(property.outcomesRecorded).toBe(2);
      expect(property.recordedRevenue).toBe(840);
      expect(property.recordedNights).toBe(3);
    });

    it('sem resultado registrado: receita e noites ficam null (nada de zero inventado)', () => {
      const result = aggregateWeeklyPerformance(
        [
          row({
            id: 'a',
            aplicadoEm: new Date('2026-05-12T12:00:00Z'),
            precoAplicado: '280.00',
          }),
        ],
        week,
        now,
      );
      const property = result.get('addr-1')!;
      expect(property.outcomesRecorded).toBeNull();
      expect(property.recordedRevenue).toBeNull();
      expect(property.recordedNights).toBeNull();
      expect(property.generated).toBeNull();
    });

    it('resultado "not_booked" sem receita: conta como resultado, mas a receita continua null', () => {
      const result = aggregateWeeklyPerformance(
        [
          row({
            id: 'a',
            aplicadoEm: new Date('2026-05-12T12:00:00Z'),
            precoAplicado: '280.00',
            resultadoRegistradoEm: new Date('2026-05-15T12:00:00Z'),
            reservaStatus: 'not_booked',
            receitaReal: null,
          }),
        ],
        week,
        now,
      );
      expect(result.get('addr-1')!.outcomesRecorded).toBe(1);
      expect(result.get('addr-1')!.recordedRevenue).toBeNull();
    });

    it('lista pendências: aplicada, evento já passou (dia de SP) e nenhum resultado registrado', () => {
      const result = aggregateWeeklyPerformance(
        [
          // aplicada há semanas, fora da janela, mas ainda sem resultado: lembrete
          row({
            id: 'old',
            aplicadoEm: new Date('2026-04-20T12:00:00Z'),
            precoAplicado: '250.00',
            evento: { nome: 'Feira', dataInicio: new Date('2026-04-25T12:00:00Z') },
          }),
          // evento ainda no futuro: não pede resultado
          row({
            id: 'future',
            aplicadoEm: new Date('2026-05-19T12:00:00Z'),
            precoAplicado: '250.00',
            evento: { nome: 'Futuro', dataInicio: new Date('2026-05-30T12:00:00Z') },
          }),
          // resultado já registrado
          row({
            id: 'done',
            aplicadoEm: new Date('2026-04-20T12:00:00Z'),
            precoAplicado: '250.00',
            resultadoRegistradoEm: new Date('2026-04-30T12:00:00Z'),
            reservaStatus: 'booked',
            receitaReal: '500',
            evento: { nome: 'Feito', dataInicio: new Date('2026-04-25T12:00:00Z') },
          }),
        ],
        week,
        now,
      );
      const property = result.get('addr-1')!;
      expect(property.pendingOutcomesTotal).toBe(1);
      expect(property.pendingOutcomes[0]).toMatchObject({ analysisId: 'old', eventName: 'Feira', appliedPrice: 250 });
      expect(property.generated).toBeNull();
    });

    it('evento de hoje à noite (dia de SP = hoje) ainda não está pendente', () => {
      // 21:30 BRT de hoje = 00:30Z de amanhã em UTC: o dia de SP continua sendo hoje.
      const tonight = row({
        id: 'tonight',
        aplicadoEm: new Date('2026-05-20T12:00:00Z'),
        precoAplicado: '250.00',
        evento: { nome: 'Jogo', dataInicio: new Date('2026-05-22T00:30:00Z') },
      });
      expect(isOutcomePending(tonight, '2026-05-21')).toBe(false);
      expect(isOutcomePending(tonight, '2026-05-22')).toBe(true);
    });

    it('imóvel sem nenhuma atividade não aparece (o template escreve "sem dados")', () => {
      const result = aggregateWeeklyPerformance(
        [row({ id: 'x', criadoEm: new Date('2026-03-01T12:00:00Z') })],
        week,
        now,
      );
      expect(result.has('addr-1')).toBe(false);
    });

    it('separa imóveis e ignora linhas duplicadas ou sem imóvel', () => {
      const created = new Date('2026-05-12T12:00:00Z');
      const result = aggregateWeeklyPerformance(
        [
          row({ id: 'a', criadoEm: created }),
          row({ id: 'a', criadoEm: created }),
          row({ id: 'b', criadoEm: created, endereco: { id: 'addr-2' } }),
          row({ id: 'c', criadoEm: created, endereco: null }),
        ],
        week,
        now,
      );
      expect(result.get('addr-1')!.generated).toBe(1);
      expect(result.get('addr-2')!.generated).toBe(1);
      expect(result.size).toBe(2);
    });
  });

  describe('hasRecordedOutcome', () => {
    it('exige o carimbo E um dado concreto', () => {
      expect(hasRecordedOutcome({ id: '1' })).toBe(false);
      expect(hasRecordedOutcome({ id: '1', resultadoRegistradoEm: new Date(), reservaStatus: 'unknown' })).toBe(false);
      expect(hasRecordedOutcome({ id: '1', resultadoRegistradoEm: new Date(), reservaStatus: 'booked' })).toBe(true);
      expect(hasRecordedOutcome({ id: '1', resultadoRegistradoEm: new Date(), noitesReservadas: 0 })).toBe(true);
      expect(hasRecordedOutcome({ id: '1', reservaStatus: 'booked' })).toBe(false);
    });
  });
});
