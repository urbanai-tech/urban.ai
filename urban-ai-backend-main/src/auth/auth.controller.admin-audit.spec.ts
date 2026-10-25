import { AuthController } from './auth.controller';

describe('AuthController admin user mutations (auditoria e verificação de e-mail)', () => {
  function make(before: any, after: any) {
    const authService = {
      findUserById: jest.fn().mockResolvedValue(before),
      update: jest.fn().mockResolvedValue(after),
      deleteUser: jest.fn().mockResolvedValue(undefined),
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const emailService = { enviarCodigo: jest.fn().mockResolvedValue({}) };
    const controller = new AuthController(authService as any, {} as any, {} as any, audit as any, emailService as any);
    return { controller, authService, audit, emailService };
  }

  const req = { user: { userId: 'admin-1' } };

  it('troca de e-mail por admin audita (mascarado) e dispara a confirmação normal', async () => {
    const { controller, audit, emailService } = make(
      { id: 'u1', username: 'Ana', email: 'ana@old.com' },
      { id: 'u1', username: 'Ana', email: 'ana@new.com' },
    );

    await controller.updateUser('u1', { email: 'ana@new.com' } as any, req);

    expect(emailService.enviarCodigo).toHaveBeenCalledWith('ana@new.com');
    expect(audit.record).toHaveBeenCalledTimes(1);
    const entry = audit.record.mock.calls[0][0];
    expect(entry).toEqual(
      expect.objectContaining({ actorUserId: 'admin-1', action: 'user.update', entityType: 'user', entityId: 'u1' }),
    );
    expect(entry.before.email).toBe('a***@old.com');
    expect(entry.after.email).toBe('a***@new.com');
    expect(entry.metadata).toEqual(
      expect.objectContaining({ changedFields: ['email'], emailVerificationReset: true, passwordChanged: false }),
    );
  });

  it('troca de senha é auditada sem nunca gravar a senha', async () => {
    const { controller, audit, emailService } = make(
      { id: 'u1', username: 'Ana', email: 'ana@old.com' },
      { id: 'u1', username: 'Ana', email: 'ana@old.com' },
    );

    await controller.updateUser('u1', { password: 'Segredo123!' } as any, req);

    expect(emailService.enviarCodigo).not.toHaveBeenCalled();
    expect(JSON.stringify(audit.record.mock.calls)).not.toContain('Segredo123');
    expect(audit.record.mock.calls[0][0].metadata).toEqual(
      expect.objectContaining({ passwordChanged: true, emailVerificationReset: false }),
    );
  });

  it('exclusão de usuário por admin é auditada com snapshot mascarado', async () => {
    const { controller, authService, audit } = make(
      { id: 'u9', username: 'Bia', email: 'bia@x.com', role: 'host' },
      null,
    );

    await controller.deleteUser('u9', req);

    expect(authService.deleteUser).toHaveBeenCalledWith('u9');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'admin-1',
        action: 'user.delete',
        entityId: 'u9',
        before: { username: 'Bia', email: 'b***@x.com', role: 'host' },
      }),
    );
  });
});
