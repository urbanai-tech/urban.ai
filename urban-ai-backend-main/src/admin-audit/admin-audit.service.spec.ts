import { ServiceUnavailableException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AdminAuditLog } from '../entities/admin-audit-log.entity';
import { AdminAuditService } from './admin-audit.service';

describe('AdminAuditService', () => {
  const createRepository = () => {
    const repo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
      createQueryBuilder: jest.fn(),
    } as unknown as jest.Mocked<Repository<AdminAuditLog>>;
    return repo;
  };

  it('persiste um registro normalizado e redige campos sensíveis', async () => {
    const repo = createRepository();
    const service = new AdminAuditService(repo);

    await service.record({
      actorUserId: `${'a'.repeat(36)}-extra`,
      action: `  ${'x'.repeat(100)}  `,
      entityType: `  ${'y'.repeat(70)}  `,
      entityId: 'entity-1',
      after: {
        status: 'active',
        password: 'never-store-me',
        nested: { accessToken: 'secret-token', count: 2n },
      },
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'a'.repeat(36),
        action: 'x'.repeat(96),
        entityType: 'y'.repeat(64),
        entityId: 'entity-1',
        after: {
          status: 'active',
          password: '[REDACTED]',
          nested: { accessToken: '[REDACTED]', count: '2' },
        },
      }),
    );
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('preserva o registro quando o payload contém referência circular', async () => {
    const repo = createRepository();
    const service = new AdminAuditService(repo);
    const metadata: Record<string, unknown> = { source: 'test' };
    metadata.self = metadata;

    await service.record({
      action: 'audit.circular_payload',
      entityType: 'audit_test',
      metadata,
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { source: 'test', self: '[Circular]' },
      }),
    );
  });

  it('repete falhas transitórias e conclui sem duplicar a criação da entrada', async () => {
    jest.useFakeTimers();
    const repo = createRepository();
    repo.save
      .mockRejectedValueOnce(Object.assign(new Error('temporary'), { code: 'ETIMEDOUT' }))
      .mockRejectedValueOnce(Object.assign(new Error('temporary'), { code: 'ER_LOCK_WAIT_TIMEOUT' }))
      .mockResolvedValueOnce({} as AdminAuditLog);
    const service = new AdminAuditService(repo);

    const pending = service.record({ action: 'audit.retry', entityType: 'audit_test' });
    await jest.runAllTimersAsync();
    await pending;

    expect(repo.create).toHaveBeenCalledTimes(1);
    expect(repo.save).toHaveBeenCalledTimes(3);
    jest.useRealTimers();
  });

  it('falha de forma explícita depois de esgotar os retries', async () => {
    jest.useFakeTimers();
    const repo = createRepository();
    repo.save.mockRejectedValue(Object.assign(new Error('database unavailable'), { code: 'ECONNREFUSED' }));
    const service = new AdminAuditService(repo);

    const pending = service.record({ action: 'audit.fail_closed', entityType: 'audit_test' });
    const assertion = expect(pending).rejects.toBeInstanceOf(ServiceUnavailableException);
    await jest.runAllTimersAsync();
    await assertion;

    expect(repo.save).toHaveBeenCalledTimes(3);
    jest.useRealTimers();
  });

  it('rejeita ação ou entidade vazias antes de acessar o banco', async () => {
    const repo = createRepository();
    const service = new AdminAuditService(repo);

    await expect(service.record({ action: ' ', entityType: 'audit_test' })).rejects.toThrow(
      'Admin audit action is required',
    );
    await expect(service.record({ action: 'audit.invalid', entityType: ' ' })).rejects.toThrow(
      'Admin audit entityType is required',
    );
    expect(repo.save).not.toHaveBeenCalled();
  });
});
