import { BadRequestException, ParseArrayPipe } from '@nestjs/common';
import { CreateAddressInputDto, RegisterPropertyDto } from './connect.dto';

const parse = (items: new () => object, value: unknown) => new ParseArrayPipe({
  items,
  whitelist: true,
  forbidNonWhitelisted: true,
}).transform(value, { type: 'body' });

describe('connect array DTOs', () => {
  it('preserves the legacy raw-array contract while validating nested items', async () => {
    await expect(parse(RegisterPropertyDto, [{
      id: 123, titulo: 'Apartamento', id_do_anuncio: '123456', pictureUrl: '', ativo: true,
      latitude: '-23.5', longitude: '-46.6', price: '350', bedrooms: '2',
    }])).resolves.toEqual([expect.objectContaining({ id: '123', price: 350, bedrooms: 2 })]);
    await expect(parse(CreateAddressInputDto, [{
      cep: null, numero: null, cidade: null, estado: null, list: { id: '123456' },
    }])).resolves.toEqual([expect.objectContaining({ list: expect.objectContaining({ id: '123456' }) })]);
  });

  it.each([
    [RegisterPropertyDto, [{ titulo: 'A', id_do_anuncio: '1', ativo: true, user: { role: 'admin' } }]],
    [RegisterPropertyDto, [{ titulo: 'A', id_do_anuncio: '1', ativo: 'true' }]],
    [RegisterPropertyDto, [{ titulo: 'A', id_do_anuncio: '1', ativo: true, latitude: 91 }]],
    [CreateAddressInputDto, [{ cep: 'invalid', list: { id: '1' } }]],
    [CreateAddressInputDto, [{ list: { id: '1', userId: 'u1' } }]],
    [CreateAddressInputDto, [{ list: {} }]],
  ])('rejects nested extras, unsafe types and invalid boundaries', async (items, input) => {
    await expect(parse(items as new () => object, input)).rejects.toBeInstanceOf(BadRequestException);
  });
});
