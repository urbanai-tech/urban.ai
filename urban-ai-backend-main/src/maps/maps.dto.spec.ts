import { BadRequestException, ParseArrayPipe } from '@nestjs/common';

jest.mock('./maps.service', () => ({ MapsService: class {} }));
jest.mock('../process/process.service', () => ({ ProcessService: class {} }));

import { MapsController, PropertyDto } from './maps.controller';

const parse = (value: unknown) => new ParseArrayPipe({
  items: PropertyDto,
  whitelist: true,
  forbidNonWhitelisted: true,
}).transform(value, { type: 'body' });

describe('maps property array DTO', () => {
  const id = '123e4567-e89b-42d3-a456-426614174000';

  it('accepts a raw array of valid property ids', async () => {
    await expect(parse([{ id }])).resolves.toEqual([expect.objectContaining({ id })]);
  });

  it.each([
    [{ id: 'not-a-uuid' }],
    [{ id, userId: 'other-user' }],
    [{ id: 42 }],
  ])('rejects invalid ids, types and extra nested fields', async (item) => {
    await expect(parse([item])).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects more than 100 properties before processing', async () => {
    const controller = new MapsController({} as any, {} as any);
    await expect(controller.processarAnalisesByProperty(
      { user: { userId: 'u1' } },
      Array.from({ length: 101 }, () => ({ id })) as any,
    )).rejects.toBeInstanceOf(BadRequestException);
  });
});
