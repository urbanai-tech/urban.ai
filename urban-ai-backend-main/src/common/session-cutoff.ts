import { Logger } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { User } from '../entities/user.entity';

/**
 * Corte de sessões (`user.sessions_valid_after`) via queries explícitas e tolerantes.
 *
 * A coluna vem de uma migration que pode ainda não ter rodado quando o código sobe.
 * Por isso ela NÃO faz parte das queries normais da entidade (select/insert/update
 * desligados) e só é lida/escrita aqui; se a coluna não existir (ER_BAD_FIELD_ERROR),
 * registramos um aviso uma única vez e seguimos sem o corte (os refresh tokens
 * continuam sendo revogados à parte).
 */
const logger = new Logger('SessionCutoff');
let missingColumnWarned = false;

export function isMissingColumnError(error: unknown): boolean {
  const e = error as { code?: string; errno?: number; message?: string; driverError?: { code?: string } };
  return (
    e?.code === 'ER_BAD_FIELD_ERROR' ||
    e?.driverError?.code === 'ER_BAD_FIELD_ERROR' ||
    e?.errno === 1054 ||
    /unknown column/i.test(e?.message ?? '')
  );
}

function warnMissingColumnOnce(): void {
  if (missingColumnWarned) return;
  missingColumnWarned = true;
  logger.warn(
    'Coluna user.sessions_valid_after ausente (migration AddUserSessionsValidAfter pendente): ' +
      'corte de access tokens desativado até aplicar a migration; refresh tokens seguem revogados.',
  );
}

/** Só para testes. */
export function resetSessionCutoffWarning(): void {
  missingColumnWarned = false;
}

/** Marca "agora" como corte. Devolve false se a coluna não existe ainda. */
export async function markSessionsCutoff(users: Repository<User>, userId: string): Promise<boolean> {
  try {
    await users.query('UPDATE `user` SET `sessions_valid_after` = ? WHERE `id` = ?', [new Date(), userId]);
    return true;
  } catch (error) {
    if (isMissingColumnError(error)) {
      warnMissingColumnOnce();
      return false;
    }
    throw error;
  }
}

/** Lê o corte do usuário; null se não há corte ou se a coluna não existe ainda. */
export async function readSessionsCutoff(users: Repository<User>, userId: string): Promise<Date | null> {
  try {
    const rows = await users.query('SELECT `sessions_valid_after` AS cutoff FROM `user` WHERE `id` = ?', [userId]);
    const value = Array.isArray(rows) ? rows[0]?.cutoff : null;
    return value ? new Date(value) : null;
  } catch (error) {
    if (isMissingColumnError(error)) {
      warnMissingColumnOnce();
      return null;
    }
    throw error;
  }
}
