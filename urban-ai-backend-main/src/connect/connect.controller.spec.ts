import { ForbiddenException } from '@nestjs/common';

jest.mock('./connect.service', () => ({ ConnectService: class {} }));

import { ConnectController } from './connect.controller';

describe('ConnectController - listings quota notifications', () => {
  let controller: ConnectController;
  let connectService: {
    countNewAddressSlotsForAddresses: jest.Mock;
    createMultipleAddresses: jest.Mock;
    countNewAddressSlotsForProperties: jest.Mock;
    saveProperties: jest.Mock;
  };
  let paymentsService: {
    getListingsQuota: jest.Mock;
    sendQuotaWarningEmail: jest.Mock;
    sendQuotaExceededEmail: jest.Mock;
  };

  beforeEach(() => {
    connectService = {
      countNewAddressSlotsForAddresses: jest.fn(),
      createMultipleAddresses: jest.fn(),
      countNewAddressSlotsForProperties: jest.fn(),
      saveProperties: jest.fn(),
    };
    paymentsService = {
      getListingsQuota: jest.fn(),
      sendQuotaWarningEmail: jest.fn().mockResolvedValue(undefined),
      sendQuotaExceededEmail: jest.fn().mockResolvedValue(undefined),
    };
    controller = new ConnectController(connectService as any, paymentsService as any);
  });

  it('sends quota warning only after crossing 80 percent and saving addresses', async () => {
    connectService.countNewAddressSlotsForAddresses.mockResolvedValue(1);
    paymentsService.getListingsQuota.mockResolvedValue({ contratados: 10, ativos: 7, podeAdicionar: true });
    connectService.createMultipleAddresses.mockResolvedValue([{ id: 'addr1' }]);

    const result = await controller.createMultipleAddresses(
      [{ list: { id: 'listing-1' } }],
      { user: { userId: 'u1', id: 'u1' } } as any,
    );

    expect(result).toEqual([{ id: 'addr1' }]);
    expect(connectService.createMultipleAddresses).toHaveBeenCalled();
    expect(paymentsService.sendQuotaWarningEmail).toHaveBeenCalledWith('u1', 10, 8);
    expect(paymentsService.sendQuotaExceededEmail).not.toHaveBeenCalled();
  });

  it('sends quota exceeded email and blocks address creation when the limit is exceeded', async () => {
    connectService.countNewAddressSlotsForAddresses.mockResolvedValue(2);
    paymentsService.getListingsQuota.mockResolvedValue({ contratados: 10, ativos: 9, podeAdicionar: true });

    await expect(
      controller.createMultipleAddresses(
        [{ list: { id: 'listing-1' } }, { list: { id: 'listing-2' } }],
        { user: { userId: 'u1', id: 'u1' } } as any,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(paymentsService.sendQuotaExceededEmail).toHaveBeenCalledWith('u1', 10, 11);
    expect(paymentsService.sendQuotaWarningEmail).not.toHaveBeenCalled();
    expect(connectService.createMultipleAddresses).not.toHaveBeenCalled();
  });
});
