import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

/**
 * Catch-up — cria tabelas das entities introduzidas DEPOIS do Baseline:
 *  - stays_accounts (F6 — integração Stays)
 *  - stays_listings
 *  - price_snapshots (F6.1 — captura passiva de dataset)
 *  - occupancy_history (F6.4 — ground truth de ocupação)
 *  - event_proximity_features (F6.2 — features de eventos)
 *
 * Idempotente: usa `ifNotExists` em createTable e checa duplicidade de
 * índices/FKs. Em ambientes com `synchronize:true` (dev/Railway atual) as
 * tabelas já existem — esta migration é no-op nesse caso.
 *
 * Quando o cutover DB_SYNCHRONIZE=true → false acontecer, esta migration
 * garante que ambientes novos (staging fresh, recover de backup) tenham o
 * schema completo sem depender de synchronize.
 */
export class CatchupFeatureEntities1745800000000 implements MigrationInterface {
  name = 'CatchupFeatureEntities1745800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ================== stays_accounts ==================
    await queryRunner.createTable(
      new Table({
        name: 'stays_accounts',
        columns: [
          {
            name: 'id', type: 'varchar', length: '36', isPrimary: true,
            generationStrategy: 'uuid', default: '(UUID())',
          },
          { name: 'user_id', type: 'varchar', length: '36', isNullable: false },
          { name: 'clientId', type: 'varchar', length: '128', isNullable: false },
          { name: 'accessToken', type: 'varchar', length: '512', isNullable: false },
          { name: 'tokenExpiresAt', type: 'datetime', isNullable: true },
          {
            name: 'status', type: 'varchar', length: '32',
            default: "'pending'", isNullable: false,
          },
          { name: 'lastSyncAt', type: 'datetime', isNullable: true },
          { name: 'lastErrorAt', type: 'datetime', isNullable: true },
          { name: 'lastErrorMessage', type: 'varchar', length: '255', isNullable: true },
          { name: 'maxIncreasePercent', type: 'int', default: 25, isNullable: false },
          { name: 'maxDecreasePercent', type: 'int', default: 20, isNullable: false },
          {
            name: 'createdAt', type: 'datetime', precision: 6,
            default: 'CURRENT_TIMESTAMP(6)', isNullable: false,
          },
          {
            name: 'updatedAt', type: 'datetime', precision: 6,
            default: 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)', isNullable: false,
          },
        ],
      }),
      true, // ifNotExists
    );
    await this.ensureIndex(queryRunner, 'stays_accounts', 'IDX_stays_accounts_user', ['user_id'], true);

    // ================== stays_listings ==================
    await queryRunner.createTable(
      new Table({
        name: 'stays_listings',
        columns: [
          {
            name: 'id', type: 'varchar', length: '36', isPrimary: true,
            generationStrategy: 'uuid', default: '(UUID())',
          },
          { name: 'stays_account_id', type: 'varchar', length: '36', isNullable: false },
          { name: 'propriedade_id', type: 'int', isNullable: true },
          { name: 'staysListingId', type: 'varchar', length: '64', isNullable: false },
          { name: 'title', type: 'varchar', length: '255', isNullable: true },
          { name: 'shortAddress', type: 'varchar', length: '255', isNullable: true },
          { name: 'basePriceCents', type: 'int', isNullable: true },
          {
            name: 'operationMode', type: 'varchar', length: '32',
            default: "'inherit'", isNullable: false,
          },
          { name: 'active', type: 'boolean', default: true, isNullable: false },
          {
            name: 'createdAt', type: 'datetime', precision: 6,
            default: 'CURRENT_TIMESTAMP(6)', isNullable: false,
          },
          {
            name: 'updatedAt', type: 'datetime', precision: 6,
            default: 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)', isNullable: false,
          },
        ],
      }),
      true,
    );
    await this.ensureIndex(queryRunner, 'stays_listings', 'IDX_stays_listings_listing_id', ['staysListingId'], true);
    await this.ensureIndex(queryRunner, 'stays_listings', 'IDX_stays_listings_account_propriedade', ['stays_account_id', 'propriedade_id']);

    // ================== price_snapshots ==================
    await queryRunner.createTable(
      new Table({
        name: 'price_snapshots',
        columns: [
          {
            name: 'id', type: 'varchar', length: '36', isPrimary: true,
            generationStrategy: 'uuid', default: '(UUID())',
          },
          { name: 'snapshotDate', type: 'date', isNullable: false },
          { name: 'list_id', type: 'int', isNullable: true },
          { name: 'address_id', type: 'int', isNullable: true },
          { name: 'externalListingId', type: 'varchar', length: '64', isNullable: true },
          { name: 'priceCents', type: 'int', isNullable: false },
          {
            name: 'currency', type: 'varchar', length: '3',
            default: "'BRL'", isNullable: false,
          },
          { name: 'appliedPriceCents', type: 'int', isNullable: true },
          { name: 'origin', type: 'varchar', length: '32', isNullable: false },
          { name: 'nearbyEventsCount', type: 'int', isNullable: true },
          { name: 'bedrooms', type: 'int', isNullable: true },
          { name: 'bathrooms', type: 'int', isNullable: true },
          {
            name: 'similarityScore', type: 'decimal',
            precision: 4, scale: 2, isNullable: true,
          },
          { name: 'bairro', type: 'varchar', length: '64', isNullable: true },
          { name: 'trainingReady', type: 'boolean', default: false, isNullable: false },
          {
            name: 'createdAt', type: 'datetime', precision: 6,
            default: 'CURRENT_TIMESTAMP(6)', isNullable: false,
          },
        ],
      }),
      true,
    );
    await this.ensureIndex(queryRunner, 'price_snapshots', 'IDX_price_snapshots_date_external', ['snapshotDate', 'externalListingId']);
    await this.ensureIndex(queryRunner, 'price_snapshots', 'IDX_price_snapshots_list_date', ['list_id', 'snapshotDate']);
    await this.ensureIndex(queryRunner, 'price_snapshots', 'IDX_price_snapshots_address_date', ['address_id', 'snapshotDate']);
    await this.ensureIndex(queryRunner, 'price_snapshots', 'IDX_price_snapshots_origin_date', ['origin', 'snapshotDate']);

    // ================== occupancy_history ==================
    await queryRunner.createTable(
      new Table({
        name: 'occupancy_history',
        columns: [
          {
            name: 'id', type: 'varchar', length: '36', isPrimary: true,
            generationStrategy: 'uuid', default: '(UUID())',
          },
          { name: 'date', type: 'date', isNullable: false },
          { name: 'list_id', type: 'int', isNullable: false },
          { name: 'address_id', type: 'int', isNullable: true },
          { name: 'user_id', type: 'varchar', length: '36', isNullable: false },
          {
            name: 'status', type: 'varchar', length: '16',
            default: "'unknown'", isNullable: false,
          },
          { name: 'revenueCents', type: 'int', isNullable: true },
          { name: 'listedPriceCents', type: 'int', isNullable: true },
          {
            name: 'currency', type: 'varchar', length: '3',
            default: "'BRL'", isNullable: false,
          },
          { name: 'origin', type: 'varchar', length: '32', isNullable: false },
          { name: 'externalReservationId', type: 'varchar', length: '128', isNullable: true },
          { name: 'nightsBooked', type: 'int', isNullable: true },
          { name: 'trainingReady', type: 'boolean', default: false, isNullable: false },
          {
            name: 'createdAt', type: 'datetime', precision: 6,
            default: 'CURRENT_TIMESTAMP(6)', isNullable: false,
          },
          {
            name: 'updatedAt', type: 'datetime', precision: 6,
            default: 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)', isNullable: false,
          },
        ],
      }),
      true,
    );
    await this.ensureIndex(queryRunner, 'occupancy_history', 'IDX_occupancy_list_date', ['list_id', 'date'], true);
    await this.ensureIndex(queryRunner, 'occupancy_history', 'IDX_occupancy_user_date', ['user_id', 'date']);
    await this.ensureIndex(queryRunner, 'occupancy_history', 'IDX_occupancy_origin_date', ['origin', 'date']);

    // ================== event_proximity_features ==================
    await queryRunner.createTable(
      new Table({
        name: 'event_proximity_features',
        columns: [
          {
            name: 'id', type: 'varchar', length: '36', isPrimary: true,
            generationStrategy: 'uuid', default: '(UUID())',
          },
          { name: 'snapshotDate', type: 'date', isNullable: false },
          { name: 'list_id', type: 'int', isNullable: false },
          { name: 'address_id', type: 'int', isNullable: true },
          { name: 'eventsNext7d', type: 'int', default: 0, isNullable: false },
          { name: 'eventsNext14d', type: 'int', default: 0, isNullable: false },
          { name: 'eventsNext30d', type: 'int', default: 0, isNullable: false },
          { name: 'megaEventsNext30d', type: 'int', default: 0, isNullable: false },
          {
            name: 'closestEventDistanceKm', type: 'decimal',
            precision: 8, scale: 3, isNullable: true,
          },
          {
            name: 'closestEventTravelMin', type: 'decimal',
            precision: 8, scale: 2, isNullable: true,
          },
          {
            name: 'avgRelevanceScore', type: 'decimal',
            precision: 5, scale: 2, isNullable: true,
          },
          { name: 'maxRelevanceScore', type: 'int', isNullable: true },
          { name: 'predominantCategory', type: 'varchar', length: '32', isNullable: true },
          { name: 'competitiveSupplyCount', type: 'int', isNullable: true },
          { name: 'medianCompPriceCents', type: 'int', isNullable: true },
          {
            name: 'createdAt', type: 'datetime', precision: 6,
            default: 'CURRENT_TIMESTAMP(6)', isNullable: false,
          },
        ],
      }),
      true,
    );
    await this.ensureIndex(queryRunner, 'event_proximity_features', 'IDX_event_proximity_list_date', ['list_id', 'snapshotDate'], true);
    await this.ensureIndex(queryRunner, 'event_proximity_features', 'IDX_event_proximity_date', ['snapshotDate']);

    // ================== Foreign keys ==================
    // Adicionadas só se não existirem (verifica via information_schema). Em
    // bases existentes criadas por synchronize:true, as FKs já estão lá.
    await this.ensureForeignKey(queryRunner, 'stays_accounts', {
      columnNames: ['user_id'],
      referencedTableName: 'users',
      referencedColumnNames: ['id'],
      onDelete: 'CASCADE',
    });
    await this.ensureForeignKey(queryRunner, 'stays_listings', {
      columnNames: ['stays_account_id'],
      referencedTableName: 'stays_accounts',
      referencedColumnNames: ['id'],
      onDelete: 'CASCADE',
    });
    await this.ensureForeignKey(queryRunner, 'stays_listings', {
      columnNames: ['propriedade_id'],
      referencedTableName: 'lists',
      referencedColumnNames: ['id'],
      onDelete: 'SET NULL',
    });
    await this.ensureForeignKey(queryRunner, 'price_snapshots', {
      columnNames: ['list_id'],
      referencedTableName: 'lists',
      referencedColumnNames: ['id'],
      onDelete: 'SET NULL',
    });
    await this.ensureForeignKey(queryRunner, 'price_snapshots', {
      columnNames: ['address_id'],
      referencedTableName: 'addresses',
      referencedColumnNames: ['id'],
      onDelete: 'SET NULL',
    });
    await this.ensureForeignKey(queryRunner, 'occupancy_history', {
      columnNames: ['list_id'],
      referencedTableName: 'lists',
      referencedColumnNames: ['id'],
      onDelete: 'CASCADE',
    });
    await this.ensureForeignKey(queryRunner, 'occupancy_history', {
      columnNames: ['address_id'],
      referencedTableName: 'addresses',
      referencedColumnNames: ['id'],
      onDelete: 'SET NULL',
    });
    await this.ensureForeignKey(queryRunner, 'occupancy_history', {
      columnNames: ['user_id'],
      referencedTableName: 'users',
      referencedColumnNames: ['id'],
      onDelete: 'CASCADE',
    });
    await this.ensureForeignKey(queryRunner, 'event_proximity_features', {
      columnNames: ['list_id'],
      referencedTableName: 'lists',
      referencedColumnNames: ['id'],
      onDelete: 'CASCADE',
    });
    await this.ensureForeignKey(queryRunner, 'event_proximity_features', {
      columnNames: ['address_id'],
      referencedTableName: 'addresses',
      referencedColumnNames: ['id'],
      onDelete: 'SET NULL',
    });
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop em ordem reversa (respeitando FKs)
    await queryRunner.dropTable('event_proximity_features', true);
    await queryRunner.dropTable('occupancy_history', true);
    await queryRunner.dropTable('price_snapshots', true);
    await queryRunner.dropTable('stays_listings', true);
    await queryRunner.dropTable('stays_accounts', true);
  }

  // ============== Helpers idempotentes ==============

  private async ensureIndex(
    queryRunner: QueryRunner,
    tableName: string,
    indexName: string,
    columnNames: string[],
    isUnique = false,
  ): Promise<void> {
    const table = await queryRunner.getTable(tableName);
    if (!table) return;
    const exists = (table.indices ?? []).some((i) => i.name === indexName);
    if (!exists) {
      await queryRunner.createIndex(
        tableName,
        new TableIndex({ name: indexName, columnNames, isUnique }),
      );
    }
  }

  private async ensureForeignKey(
    queryRunner: QueryRunner,
    tableName: string,
    fk: {
      columnNames: string[];
      referencedTableName: string;
      referencedColumnNames: string[];
      onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
    },
  ): Promise<void> {
    const table = await queryRunner.getTable(tableName);
    if (!table) return;
    const refTable = await queryRunner.getTable(fk.referencedTableName);
    if (!refTable) {
      // Tabela referenciada não existe (ex: 'lists' ou 'users' em ambiente
      // muito limpo). Não falha — assume que migration anterior já criou.
      return;
    }
    const already = (table.foreignKeys ?? []).some((existing) => {
      return (
        existing.columnNames.length === fk.columnNames.length &&
        existing.columnNames.every((c, i) => c === fk.columnNames[i]) &&
        existing.referencedTableName === fk.referencedTableName
      );
    });
    if (!already) {
      await queryRunner.createForeignKey(
        tableName,
        new TableForeignKey(fk),
      );
    }
  }
}
