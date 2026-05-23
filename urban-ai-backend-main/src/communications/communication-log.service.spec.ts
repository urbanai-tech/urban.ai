import { CommunicationLogService } from './communication-log.service';

function makeQueryBuilder(event: any) {
  const builder = {
    orderBy: jest.fn(() => builder),
    skip: jest.fn(() => builder),
    take: jest.fn(() => builder),
    andWhere: jest.fn(() => builder),
    select: jest.fn(() => builder),
    addSelect: jest.fn(() => builder),
    where: jest.fn(() => builder),
    groupBy: jest.fn(() => builder),
    addGroupBy: jest.fn(() => builder),
    getManyAndCount: jest.fn(async () => [[event], 1]),
    getRawMany: jest.fn(async () => []),
  };
  return builder;
}

describe('CommunicationLogService', () => {
  it('redacts recipient identifiers and sensitive metadata from admin list responses', async () => {
    const event = {
      id: 'event-1',
      userId: 'user-1',
      channel: 'email',
      status: 'failed',
      kind: 'pricing',
      templateName: 'pricing-digest',
      recipientEmail: 'ana.host@example.com',
      recipientDeviceId: 'device-token-123456',
      subject: 'Digest',
      title: null,
      provider: 'brevo',
      providerMessageId: 'provider-message-123456',
      failureReason: 'Provider rejected ana.host@example.com with token=abc123',
      metadataJson: JSON.stringify({
        recipientEmail: 'ana.host@example.com',
        authorization: 'Bearer secret-token',
        safe: 'ok',
      }),
      correlationId: 'corr-1',
      createdAt: new Date('2026-05-23T12:00:00Z'),
    };
    const repo = {
      createQueryBuilder: jest.fn(() => makeQueryBuilder(event)),
    };
    const service = new CommunicationLogService(repo as any);

    const result = await service.list({});

    expect(result.items[0]).toMatchObject({
      recipientEmail: 'an******@example.com',
      recipientDeviceId: 'device***3456',
      providerMessageId: 'provid***3456',
      metadataJson: null,
    });
    expect(result.items[0].failureReason).not.toContain('ana.host@example.com');
    expect(result.items[0].failureReason).not.toContain('abc123');
    expect(result.items[0].metadata).toMatchObject({
      recipientEmail: '[redacted]',
      authorization: '[redacted]',
      safe: 'ok',
    });
  });
});
