import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ROLES_KEY } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { EventChangesController, parseChangeTypes } from './event-changes.controller';

jest.mock('../mailer/mailer.service', () => ({ MailerService: class MailerService {} }));

describe('parseChangeTypes', () => {
  it('aceita lista válida, descarta tipos desconhecidos e vazio vira undefined', () => {
    expect(parseChangeTypes('rescheduled, cancelled')).toEqual(['rescheduled', 'cancelled']);
    expect(parseChangeTypes('rescheduled,foo')).toEqual(['rescheduled']);
    expect(parseChangeTypes('foo')).toBeUndefined();
    expect(parseChangeTypes('')).toBeUndefined();
    expect(parseChangeTypes(undefined)).toBeUndefined();
  });
});

describe('EventChangesController', () => {
  it('é somente admin e vive sob /admin/event-coverage', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, EventChangesController)).toEqual([JwtAuthGuard, RolesGuard]);
    expect(Reflect.getMetadata(ROLES_KEY, EventChangesController)).toEqual(['admin']);
    expect(Reflect.getMetadata(PATH_METADATA, EventChangesController)).toBe('admin/event-coverage');
  });

  it('repassa os filtros ao serviço (janela, tipos, limite)', async () => {
    const history: any = {
      changesReport: jest.fn().mockResolvedValue({ ok: 'changes' }),
      leadTimeReport: jest.fn().mockResolvedValue({ ok: 'lead' }),
    };
    const controller = new EventChangesController(history);

    await controller.changes('14', 'cancelled,postponed', '25');
    expect(history.changesReport).toHaveBeenCalledWith({ days: 14, types: ['cancelled', 'postponed'], limit: 25 });

    await controller.changes();
    expect(history.changesReport).toHaveBeenLastCalledWith({ days: undefined, types: undefined, limit: undefined });

    await controller.leadTime();
    expect(history.leadTimeReport).toHaveBeenCalledWith(90);
    await controller.leadTime('30');
    expect(history.leadTimeReport).toHaveBeenLastCalledWith(30);
  });
});
