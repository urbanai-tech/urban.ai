import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterAppliedPriceDto } from './sugestion.dto';

async function errorsFor(payload: Record<string, unknown>) {
  const dto = plainToInstance(RegisterAppliedPriceDto, payload);
  const errors = await validate(dto);
  return errors.map((error) => error.property);
}

describe('RegisterAppliedPriceDto', () => {
  it('aceita as origens manuais que o anfitrião pode declarar', async () => {
    expect(await errorsFor({ precoAplicado: 250, origem: 'manual_dashboard' })).toEqual([]);
    expect(await errorsFor({ precoAplicado: 250, origem: 'manual_off_platform' })).toEqual([]);
  });

  it.each(['stays_auto', 'stays_user_accepted'])(
    'recusa a origem %s vinda do usuário',
    async (origem) => {
      expect(await errorsFor({ precoAplicado: 250, origem })).toContain('origem');
    },
  );
});
