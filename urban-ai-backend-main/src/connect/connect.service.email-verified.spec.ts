import { ForbiddenException } from '@nestjs/common';

// Dependências pesadas (p-limit ESM etc.) não são necessárias para este contrato.
jest.mock('src/propriedades/propriedade.service', () => ({ PropriedadeService: class {} }));
jest.mock('src/airbnb/airbnb.service', () => ({ AirbnbService: class {} }));
jest.mock('src/email/email.service', () => ({ EmailService: class {} }));

import { ConnectService } from './connect.service';

describe('ConnectService - e-mail verificado para cadastrar imóveis', () => {
  const build = (user: any) => {
    const service = Object.create(ConnectService.prototype) as any;
    service.userRepository = { findOne: jest.fn().mockResolvedValue(user) };
    service.logger = { debug: jest.fn(), log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    service.createMultipleAddressesWithScrapedInputs = jest.fn().mockResolvedValue([{ id: 'addr-1' }]);
    return service;
  };

  it('bloqueia com 403 EMAIL_NOT_VERIFIED quando emailVerifiedAt é null', async () => {
    const service = build({ id: 'u1', emailVerifiedAt: null });

    const error = await service.assertEmailVerified('u1').catch((e) => e);

    expect(error).toBeInstanceOf(ForbiddenException);
    expect(error.getResponse()).toMatchObject({ code: 'EMAIL_NOT_VERIFIED' });
  });

  it('bloqueia usuário inexistente (fail closed)', async () => {
    const service = build(null);
    await expect(service.assertEmailVerified('ghost')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('permite quando o e-mail está verificado', async () => {
    const service = build({ id: 'u1', emailVerifiedAt: new Date() });
    await expect(service.assertEmailVerified('u1')).resolves.toBeUndefined();
    expect(service.userRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'u1' },
      select: ['id', 'emailVerifiedAt'],
    });
  });

  it('createMultipleAddresses não chega ao scraping/gravação sem e-mail verificado', async () => {
    const service = build({ id: 'u1', emailVerifiedAt: null });

    await expect(service.createMultipleAddresses([{ list: { id: 'x' } }], 'u1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(service.createMultipleAddressesWithScrapedInputs).not.toHaveBeenCalled();
  });

  it('saveProperties não grava imóveis sem e-mail verificado', async () => {
    const service = build({ id: 'u1', emailVerifiedAt: null });
    (service as any).listRepo = { findOne: jest.fn(), save: jest.fn() };

    await expect(service.saveProperties([{ id_do_anuncio: '1' } as any], 'u1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect((service as any).listRepo.save).not.toHaveBeenCalled();
  });

  it('createMultipleAddresses segue o fluxo normal com e-mail verificado', async () => {
    const service = build({ id: 'u1', emailVerifiedAt: new Date() });

    await expect(service.createMultipleAddresses([{ list: { id: 'x' } }], 'u1')).resolves.toEqual([{ id: 'addr-1' }]);
  });
});
