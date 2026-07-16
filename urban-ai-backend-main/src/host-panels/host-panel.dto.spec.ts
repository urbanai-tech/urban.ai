import { BadRequestException, ValidationPipe } from '@nestjs/common';
import {
  AskFeedbackDto,
  AskQuestionDto,
  PricingRulesBodyDto,
  SimulatePricingDto,
} from './host-panel.dto';

const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
const validate = <T>(metatype: new () => T, value: unknown) =>
  pipe.transform(value, { type: 'body', metatype });
const uuid = '123e4567-e89b-42d3-a456-426614174000';
const validRule = {
  type: 'weekend_uplift',
  enabled: true,
  params: { upliftPercent: '20.5' },
  label: 'Fim de semana',
  description: 'Aumenta a diaria aos finais de semana.',
};

describe('host panel runtime DTOs', () => {
  it('accepts bounded ask and simulation contracts', async () => {
    await expect(validate(AskQuestionDto, { question: '  Qual meu melhor preco?  ', conversationId: uuid }))
      .resolves.toEqual(expect.objectContaining({ question: 'Qual meu melhor preco?' }));
    await expect(validate(AskFeedbackDto, { messageId: uuid, vote: 'up' })).resolves.toBeInstanceOf(AskFeedbackDto);
    await expect(validate(SimulatePricingDto, {})).resolves.toBeInstanceOf(SimulatePricingDto);
    await expect(
      validate(SimulatePricingDto, { propertyId: uuid, targetDate: '2026-12-31', strategy: 'recommended' }),
    ).resolves.toBeInstanceOf(SimulatePricingDto);
  });

  it('validates and safely coerces nested pricing rules', async () => {
    await expect(validate(PricingRulesBodyDto, { rules: [validRule] })).resolves.toEqual(
      expect.objectContaining({
        rules: [expect.objectContaining({ params: { upliftPercent: 20.5 } })],
      }),
    );
    await expect(validate(PricingRulesBodyDto, { rules: [] })).resolves.toBeInstanceOf(PricingRulesBodyDto);
  });

  it.each([
    [AskQuestionDto, { question: '   ' }],
    [AskQuestionDto, { question: 'ok', role: 'admin' }],
    [AskFeedbackDto, { messageId: 'not-an-id', vote: 'up' }],
    [AskFeedbackDto, { messageId: uuid, vote: 'neutral' }],
    [SimulatePricingDto, { targetDate: '31/12/2026' }],
    [SimulatePricingDto, { propertyId: 'not-an-id' }],
    [PricingRulesBodyDto, { rules: [{ ...validRule, enabled: 'false' }] }],
    [PricingRulesBodyDto, { rules: [{ ...validRule, type: 'drop_database' }] }],
    [PricingRulesBodyDto, { rules: [{ ...validRule, params: { upliftPercent: true } }] }],
    [PricingRulesBodyDto, { rules: [{ ...validRule, params: { upliftPercent: 10 }, role: 'admin' }] }],
    [PricingRulesBodyDto, { rules: 'not-an-array' }],
  ])('rejects malformed ask, simulation and nested rule payloads', async (metatype, input) => {
    await expect(validate(metatype as new () => object, input)).rejects.toBeInstanceOf(BadRequestException);
  });
});
