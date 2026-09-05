import { StaysController } from './stays.controller';
import { StaysService } from './stays.service';

describe('Stays account public state', () => {
  it.each(['active', 'disconnected', 'error', 'pending'])('preserves %s without exposing credentials', async (status) => {
    const saved = {
      id: 'account-1', status, clientId: 'test-client', apiBaseUrl: 'https://test.stays.net',
      lastSyncAt: null, consentVersion: 'v1', consentAcceptedAt: null,
      accessToken: 'synthetic-secret', user: { id: 'owner', email: 'private@example.invalid' },
      lastErrorMessage: 'internal diagnostic',
    };
    const getAccount = jest.fn().mockResolvedValue(saved);
    const controller = new StaysController({ getAccount } as unknown as StaysService);
    const result = await controller.account({ user: { userId: 'owner' } } as any);
    expect(getAccount).toHaveBeenCalledWith('owner');
    expect(result).toEqual({
      id: 'account-1', status, clientId: 'test-client', apiBaseUrl: 'https://test.stays.net',
      lastSyncAt: null, consentVersion: 'v1', consentAcceptedAt: null,
    });
  });

  it('returns null only when no account exists', async () => {
    const controller = new StaysController({ getAccount: jest.fn().mockResolvedValue(null) } as unknown as StaysService);
    expect(await controller.account({ user: { userId: 'owner' } } as any)).toBeNull();
  });

  it('propagates lookup failures instead of reporting no account', async () => {
    const controller = new StaysController({ getAccount: jest.fn().mockRejectedValue(new Error('database unavailable')) } as unknown as StaysService);
    await expect(controller.account({ user: { userId: 'owner' } } as any)).rejects.toThrow('database unavailable');
  });
});
