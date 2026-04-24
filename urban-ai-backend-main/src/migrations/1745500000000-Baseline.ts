import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Baseline — marca o schema atual (abril/2026) como ponto zero das migrations.
 * Propositalmente vazia: o schema de produção já reflete o estado das entities
 * porque o projeto rodou com `synchronize: true` desde o início. Ao rodar
 * `migration:run` com MIGRATIONS_RUN=true, o TypeORM só insere a linha desta
 * migration na tabela `migrations` e, a partir daí, qualquer mudança de entity
 * precisa ser feita via `migration:generate` + `migration:run`.
 */
export class Baseline1745500000000 implements MigrationInterface {
  name = 'Baseline1745500000000';

  public async up(_queryRunner: QueryRunner): Promise<void> {
    // no-op
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // no-op
  }
}
