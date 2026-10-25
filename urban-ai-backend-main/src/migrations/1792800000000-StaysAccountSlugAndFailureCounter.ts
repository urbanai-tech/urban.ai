import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';
import { slugFromLegacyStaysUrl, STAYS_ACCOUNT_SLUG_PATTERN } from '../stays/stays-connector';

/**
 * Conta Stays passa a guardar só o identificador (slug do subdomínio), nunca
 * uma URL livre (alerta CodeQL de SSRF no PR #19), e ganha o contador de
 * falhas duras consecutivas (timeouts/5xx não derrubam mais a conta).
 *
 * Conversão: ambientes que rodaram a versão antiga de
 * 1788610000000-ScopeStaysListingsToAccount têm `apiBaseUrl`. Cada valor
 * `https://<slug>.stays.net[/external/v1]` vira `apiAccountSlug`. Qualquer
 * valor ambíguo (outro domínio, porta, path, query, slug inválido, ou slug já
 * gravado diferente) faz a migration RECUSAR antes de alterar o schema — a
 * operação decide caso a caso. A coluna legada é preservada (sem perda).
 *
 * Idempotente; down devolve a URL derivada do slug para a coluna legada
 * (quando ela existe) e remove as colunas novas.
 */
export class StaysAccountSlugAndFailureCounter1792800000000 implements MigrationInterface {
  name = 'StaysAccountSlugAndFailureCounter1792800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('stays_accounts'))) return;
    const hasLegacy = await queryRunner.hasColumn('stays_accounts', 'apiBaseUrl');
    const hasSlug = await queryRunner.hasColumn('stays_accounts', 'apiAccountSlug');

    // 1) Valida TUDO antes de qualquer DDL (MySQL não tem DDL transacional).
    const conversions: Array<{ id: string; slug: string }> = [];
    if (hasLegacy) {
      const rows: Array<{ id: string; apiBaseUrl: string | null; apiAccountSlug?: string | null }> =
        await queryRunner.query(
          `SELECT id, apiBaseUrl${hasSlug ? ', apiAccountSlug' : ''} FROM stays_accounts WHERE apiBaseUrl IS NOT NULL AND apiBaseUrl <> ''`,
        );
      const ambiguous: string[] = [];
      for (const row of rows) {
        const slug = slugFromLegacyStaysUrl(row.apiBaseUrl);
        const current = row.apiAccountSlug ?? null;
        if (!slug || (current && current !== slug)) {
          ambiguous.push(row.id);
          continue;
        }
        if (current !== slug) conversions.push({ id: row.id, slug });
      }
      if (ambiguous.length > 0) {
        throw new Error(
          `Refusing to convert ${ambiguous.length} Stays account URL(s) to slug (ids: ${ambiguous.slice(0, 20).join(', ')}). ` +
            'Set apiAccountSlug manually or clear apiBaseUrl for these accounts, then rerun.',
        );
      }
    }

    // 2) Schema.
    if (!hasSlug) {
      await queryRunner.addColumn('stays_accounts', new TableColumn({
        name: 'apiAccountSlug', type: 'varchar', length: '63', isNullable: true,
      }));
    }
    if (!(await queryRunner.hasColumn('stays_accounts', 'consecutiveFailures'))) {
      await queryRunner.addColumn('stays_accounts', new TableColumn({
        name: 'consecutiveFailures', type: 'int', default: 0, isNullable: false,
      }));
    }

    // 3) Dados.
    for (const { id, slug } of conversions) {
      if (!STAYS_ACCOUNT_SLUG_PATTERN.test(slug)) throw new Error('Invalid derived Stays slug');
      await queryRunner.query('UPDATE stays_accounts SET apiAccountSlug = ? WHERE id = ?', [slug, id]);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('stays_accounts'))) return;
    const hasSlug = await queryRunner.hasColumn('stays_accounts', 'apiAccountSlug');
    if (hasSlug && (await queryRunner.hasColumn('stays_accounts', 'apiBaseUrl'))) {
      await queryRunner.query(
        "UPDATE stays_accounts SET apiBaseUrl = CONCAT('https://', apiAccountSlug, '.stays.net') " +
          "WHERE apiAccountSlug IS NOT NULL AND (apiBaseUrl IS NULL OR apiBaseUrl = '')",
      );
    }
    if (await queryRunner.hasColumn('stays_accounts', 'consecutiveFailures')) {
      await queryRunner.dropColumn('stays_accounts', 'consecutiveFailures');
    }
    if (hasSlug) {
      await queryRunner.dropColumn('stays_accounts', 'apiAccountSlug');
    }
  }
}
