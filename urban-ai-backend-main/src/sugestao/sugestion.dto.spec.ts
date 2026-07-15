import { BadRequestException, ValidationPipe } from '@nestjs/common';
import {
  RegisterAppliedPriceDto,
  RegisterSuggestionResultDto,
  SetSuggestionAcceptedDto,
  VerifyPendingSuggestionsDto,
} from './sugestion.dto';

const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});
const validate = <T>(metatype: new () => T, value: unknown) =>
  pipe.transform(value, { type: 'body', metatype });

describe('suggestion runtime DTOs', () => {
  it('preserves valid contracts and transforms bounded numeric strings', async () => {
    await expect(validate(VerifyPendingSuggestionsDto, { limit: '100' })).resolves.toMatchObject({
      limit: 100,
    });
    await expect(validate(SetSuggestionAcceptedDto, { aceito: false })).resolves.toMatchObject({
      aceito: false,
    });
    await expect(
      validate(RegisterAppliedPriceDto, {
        precoAplicado: '247.50',
        origem: 'manual_dashboard',
        reservaStatus: 'booked',
        receitaReal: '990.00',
        noitesReservadas: '4',
        feedbackObservacao: null,
      }),
    ).resolves.toMatchObject({
      precoAplicado: 247.5,
      receitaReal: 990,
      noitesReservadas: 4,
    });
  });

  it('accepts documented lower and upper numeric boundaries', async () => {
    await expect(validate(VerifyPendingSuggestionsDto, { limit: 1 })).resolves.toBeInstanceOf(
      VerifyPendingSuggestionsDto,
    );
    await expect(
      validate(RegisterSuggestionResultDto, {
        precoAplicado: 0.01,
        receitaReal: 99_999_999.99,
        noitesReservadas: 36_500,
        reservaStatus: null,
        feedbackObservacao: 'x'.repeat(5000),
      }),
    ).resolves.toBeInstanceOf(RegisterSuggestionResultDto);
  });

  it.each([
    { limit: 0 },
    { limit: 101 },
    { limit: 1.5 },
    { limit: { value: 10 } },
    { limit: 10, role: 'admin' },
  ])('rejects invalid verify-pending limits, types and extras', async (input) => {
    await expect(validate(VerifyPendingSuggestionsDto, input)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it.each([{ aceito: 'false' }, { aceito: 1 }, {}, { aceito: true, nested: { aceito: false } }])(
    'rejects non-boolean acceptance and unknown nested input',
    async (input) => {
      await expect(validate(SetSuggestionAcceptedDto, input)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    },
  );

  it.each([
    { precoAplicado: 0, origem: 'manual_dashboard' },
    { precoAplicado: 10.001, origem: 'manual_dashboard' },
    { precoAplicado: 100_000_000, origem: 'manual_dashboard' },
    { precoAplicado: 10, origem: 'unknown' },
    { precoAplicado: 10, origem: 'stays_auto', reservaStatus: 'paid' },
    { precoAplicado: 10, origem: 'stays_auto', receitaReal: -1 },
    { precoAplicado: 10, origem: 'stays_auto', noitesReservadas: 1.5 },
    { precoAplicado: 10, origem: 'stays_auto', feedbackObservacao: 'x'.repeat(5001) },
    { precoAplicado: { value: 10 }, origem: 'stays_auto' },
    { precoAplicado: 10, origem: 'stays_auto', unexpected: true },
  ])(
    'rejects invalid applied-price formats, enums, limits, nested values and extras',
    async (input) => {
      await expect(validate(RegisterAppliedPriceDto, input)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    },
  );

  it.each([
    { precoAplicado: 'free' },
    { precoAplicado: -1 },
    { receitaReal: 1.001 },
    { noitesReservadas: 36_501 },
    { feedbackObservacao: { text: 'nested' } },
    { reservaStatus: 'booked', extra: true },
  ])('rejects invalid result values and unknown fields', async (input) => {
    await expect(validate(RegisterSuggestionResultDto, input)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
