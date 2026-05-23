import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateEventIntelligenceFoundation1780600000000 implements MigrationInterface {
  name = 'CreateEventIntelligenceFoundation1780600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.createEventIntelligenceSnapshots(queryRunner);
    await this.createEventPropertyImpacts(queryRunner);
    await this.createPricingDecisionSnapshots(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const tableName of [
      'pricing_decision_snapshots',
      'event_property_impacts',
      'event_intelligence_snapshots',
    ]) {
      const table = await queryRunner.getTable(tableName);
      if (!table) continue;
      for (const fk of [...table.foreignKeys]) await queryRunner.dropForeignKey(tableName, fk);
      for (const idx of [...table.indices]) await queryRunner.dropIndex(tableName, idx);
      await queryRunner.dropTable(tableName, true);
    }
  }

  private async createEventIntelligenceSnapshots(queryRunner: QueryRunner) {
    if (await queryRunner.hasTable('event_intelligence_snapshots')) return;

    await queryRunner.createTable(
      new Table({
        name: 'event_intelligence_snapshots',
        columns: [
          this.uuidPrimaryColumn(),
          { name: 'event_id', type: 'varchar', length: '36', isNullable: false },
          { name: 'generatedAt', type: 'datetime', precision: 6, isNullable: false },
          { name: 'jobRunId', type: 'varchar', length: '64', isNullable: true },
          {
            name: 'metricVersion',
            type: 'varchar',
            length: '32',
            default: "'event-demand-v0'",
            isNullable: false,
          },
          {
            name: 'modelVersion',
            type: 'varchar',
            length: '32',
            default: "'stub-contract-v0'",
            isNullable: false,
          },
          { name: 'eventDemandScore', type: 'decimal', precision: 5, scale: 2, isNullable: true },
          { name: 'eventRevenuePotentialCents', type: 'int', isNullable: true },
          { name: 'demandRadiusKm', type: 'decimal', precision: 6, scale: 2, isNullable: true },
          { name: 'sourceReliabilityScore', type: 'decimal', precision: 5, scale: 2, isNullable: true },
          { name: 'sourceFreshnessHours', type: 'decimal', precision: 8, scale: 2, isNullable: true },
          { name: 'confidence', type: 'varchar', length: '16', default: "'low'", isNullable: false },
          { name: 'expectedAttendance', type: 'int', isNullable: true },
          { name: 'venueType', type: 'varchar', length: '64', isNullable: true },
          { name: 'category', type: 'varchar', length: '100', isNullable: true },
          { name: 'leadTimeDays', type: 'int', isNullable: true },
          { name: 'overlapEventsCount', type: 'int', default: '0', isNullable: false },
          { name: 'supplyCompressionScore', type: 'decimal', precision: 5, scale: 2, isNullable: true },
          { name: 'interpretation', type: 'text', isNullable: true },
          { name: 'drivers', type: 'text', isNullable: true },
          { name: 'hotRegions', type: 'text', isNullable: true },
          { name: 'riskFlags', type: 'text', isNullable: true },
          { name: 'dataQualityFlags', type: 'text', isNullable: true },
          this.createdAtColumn(),
          this.updatedAtColumn(),
        ],
      }),
      true,
    );

    await this.ensureIndex(queryRunner, 'event_intelligence_snapshots', 'IDX_event_intelligence_event_generatedAt', [
      'event_id',
      'generatedAt',
    ]);
    await this.ensureIndex(queryRunner, 'event_intelligence_snapshots', 'IDX_event_intelligence_job_event', [
      'jobRunId',
      'event_id',
    ]);
    await this.ensureIndex(queryRunner, 'event_intelligence_snapshots', 'IDX_event_intelligence_confidence_generatedAt', [
      'confidence',
      'generatedAt',
    ]);
    await this.ensureIndex(queryRunner, 'event_intelligence_snapshots', 'IDX_event_intelligence_score', [
      'eventDemandScore',
    ]);
    await this.ensureForeignKey(queryRunner, 'event_intelligence_snapshots', {
      columnNames: ['event_id'],
      referencedTableName: 'events',
      referencedColumnNames: ['id'],
      onDelete: 'CASCADE',
    });
  }

  private async createEventPropertyImpacts(queryRunner: QueryRunner) {
    if (await queryRunner.hasTable('event_property_impacts')) return;

    await queryRunner.createTable(
      new Table({
        name: 'event_property_impacts',
        columns: [
          this.uuidPrimaryColumn(),
          { name: 'event_id', type: 'varchar', length: '36', isNullable: false },
          { name: 'event_intelligence_snapshot_id', type: 'varchar', length: '36', isNullable: true },
          { name: 'property_address_id', type: 'varchar', length: '36', isNullable: false },
          { name: 'list_id', type: 'varchar', length: '36', isNullable: true },
          { name: 'host_user_id', type: 'varchar', length: '36', isNullable: false },
          { name: 'analise_preco_id', type: 'varchar', length: '36', isNullable: true },
          { name: 'generatedAt', type: 'datetime', precision: 6, isNullable: false },
          { name: 'jobRunId', type: 'varchar', length: '64', isNullable: true },
          {
            name: 'metricVersion',
            type: 'varchar',
            length: '32',
            default: "'property-impact-v0'",
            isNullable: false,
          },
          {
            name: 'modelVersion',
            type: 'varchar',
            length: '32',
            default: "'stub-contract-v0'",
            isNullable: false,
          },
          { name: 'distanceKm', type: 'decimal', precision: 8, scale: 3, isNullable: true },
          { name: 'travelTimeMinutes', type: 'int', isNullable: true },
          { name: 'propertyCaptureScore', type: 'decimal', precision: 5, scale: 2, isNullable: true },
          { name: 'basePriceCents', type: 'int', isNullable: true },
          { name: 'currentPriceCents', type: 'int', isNullable: true },
          { name: 'recommendedPriceCents', type: 'int', isNullable: true },
          { name: 'minAbsorbablePriceCents', type: 'int', isNullable: true },
          { name: 'maxAbsorbablePriceCents', type: 'int', isNullable: true },
          { name: 'recommendedMultiplier', type: 'decimal', precision: 6, scale: 2, isNullable: true },
          { name: 'maxPlausibleMultiplier', type: 'decimal', precision: 6, scale: 2, isNullable: true },
          { name: 'bookingProbability', type: 'decimal', precision: 5, scale: 4, isNullable: true },
          { name: 'expectedRevenueCents', type: 'int', isNullable: true },
          { name: 'expectedIncrementalRevenueCents', type: 'int', isNullable: true },
          { name: 'confidence', type: 'varchar', length: '16', default: "'low'", isNullable: false },
          { name: 'mainDrivers', type: 'text', isNullable: true },
          { name: 'priceAbsorptionScenarios', type: 'text', isNullable: true },
          { name: 'recommendedAction', type: 'varchar', length: '16', default: "'watch'", isNullable: false },
          { name: 'riskFlags', type: 'text', isNullable: true },
          this.createdAtColumn(),
          this.updatedAtColumn(),
        ],
      }),
      true,
    );

    await this.ensureIndex(queryRunner, 'event_property_impacts', 'IDX_event_property_impacts_event_property_generatedAt', [
      'event_id',
      'property_address_id',
      'generatedAt',
    ]);
    await this.ensureIndex(
      queryRunner,
      'event_property_impacts',
      'IDX_event_property_impacts_job_event_property_analysis',
      ['jobRunId', 'event_id', 'property_address_id', 'analise_preco_id'],
    );
    await this.ensureIndex(queryRunner, 'event_property_impacts', 'IDX_event_property_impacts_host_generatedAt', [
      'host_user_id',
      'generatedAt',
    ]);
    await this.ensureIndex(queryRunner, 'event_property_impacts', 'IDX_event_property_impacts_confidence_generatedAt', [
      'confidence',
      'generatedAt',
    ]);
    await this.ensureIndex(queryRunner, 'event_property_impacts', 'IDX_event_property_impacts_action_generatedAt', [
      'recommendedAction',
      'generatedAt',
    ]);

    await this.ensureForeignKey(queryRunner, 'event_property_impacts', {
      columnNames: ['event_id'],
      referencedTableName: 'events',
      referencedColumnNames: ['id'],
      onDelete: 'CASCADE',
    });
    await this.ensureForeignKey(queryRunner, 'event_property_impacts', {
      columnNames: ['event_intelligence_snapshot_id'],
      referencedTableName: 'event_intelligence_snapshots',
      referencedColumnNames: ['id'],
      onDelete: 'SET NULL',
    });
    await this.ensureForeignKey(queryRunner, 'event_property_impacts', {
      columnNames: ['property_address_id'],
      referencedTableName: 'addresses',
      referencedColumnNames: ['id'],
      onDelete: 'CASCADE',
    });
    await this.ensureForeignKey(queryRunner, 'event_property_impacts', {
      columnNames: ['list_id'],
      referencedTableName: 'list',
      referencedColumnNames: ['id'],
      onDelete: 'SET NULL',
    });
    await this.ensureForeignKey(queryRunner, 'event_property_impacts', {
      columnNames: ['host_user_id'],
      referencedTableName: 'user',
      referencedColumnNames: ['id'],
      onDelete: 'CASCADE',
    });
    await this.ensureForeignKey(queryRunner, 'event_property_impacts', {
      columnNames: ['analise_preco_id'],
      referencedTableName: 'analise_preco',
      referencedColumnNames: ['id'],
      onDelete: 'SET NULL',
    });
  }

  private async createPricingDecisionSnapshots(queryRunner: QueryRunner) {
    if (await queryRunner.hasTable('pricing_decision_snapshots')) return;

    await queryRunner.createTable(
      new Table({
        name: 'pricing_decision_snapshots',
        columns: [
          this.uuidPrimaryColumn(),
          { name: 'user_id', type: 'varchar', length: '36', isNullable: false },
          { name: 'property_address_id', type: 'varchar', length: '36', isNullable: true },
          { name: 'list_id', type: 'varchar', length: '36', isNullable: true },
          { name: 'event_id', type: 'varchar', length: '36', isNullable: true },
          { name: 'event_intelligence_snapshot_id', type: 'varchar', length: '36', isNullable: true },
          { name: 'event_property_impact_id', type: 'varchar', length: '36', isNullable: true },
          { name: 'analise_preco_id', type: 'varchar', length: '36', isNullable: true },
          { name: 'price_update_id', type: 'varchar', length: '36', isNullable: true },
          { name: 'targetDate', type: 'date', isNullable: true },
          { name: 'generatedAt', type: 'datetime', precision: 6, isNullable: false },
          { name: 'jobRunId', type: 'varchar', length: '64', isNullable: true },
          {
            name: 'metricVersion',
            type: 'varchar',
            length: '32',
            default: "'pricing-decision-v0'",
            isNullable: false,
          },
          {
            name: 'modelVersion',
            type: 'varchar',
            length: '32',
            default: "'stub-contract-v0'",
            isNullable: false,
          },
          { name: 'decisionType', type: 'varchar', length: '32', default: "'event_pricing'", isNullable: false },
          { name: 'basePriceCents', type: 'int', isNullable: true },
          { name: 'currentPriceCents', type: 'int', isNullable: true },
          { name: 'recommendedPriceCents', type: 'int', isNullable: true },
          { name: 'selectedPriceCents', type: 'int', isNullable: true },
          { name: 'appliedPriceCents', type: 'int', isNullable: true },
          { name: 'recommendedMultiplier', type: 'decimal', precision: 6, scale: 2, isNullable: true },
          { name: 'bookingProbability', type: 'decimal', precision: 5, scale: 4, isNullable: true },
          { name: 'expectedRevenueCents', type: 'int', isNullable: true },
          { name: 'expectedIncrementalRevenueCents', type: 'int', isNullable: true },
          { name: 'confidence', type: 'varchar', length: '16', default: "'low'", isNullable: false },
          { name: 'status', type: 'varchar', length: '16', default: "'draft'", isNullable: false },
          { name: 'inputSignals', type: 'text', isNullable: true },
          { name: 'guardrails', type: 'text', isNullable: true },
          { name: 'drivers', type: 'text', isNullable: true },
          { name: 'priceAbsorptionScenarios', type: 'text', isNullable: true },
          { name: 'riskFlags', type: 'text', isNullable: true },
          { name: 'explanation', type: 'text', isNullable: true },
          this.createdAtColumn(),
          this.updatedAtColumn(),
        ],
      }),
      true,
    );

    await this.ensureIndex(queryRunner, 'pricing_decision_snapshots', 'IDX_pricing_decisions_user_targetDate', [
      'user_id',
      'targetDate',
    ]);
    await this.ensureIndex(queryRunner, 'pricing_decision_snapshots', 'IDX_pricing_decisions_event_targetDate', [
      'event_id',
      'targetDate',
    ]);
    await this.ensureIndex(queryRunner, 'pricing_decision_snapshots', 'IDX_pricing_decisions_analise', [
      'analise_preco_id',
    ]);
    await this.ensureIndex(queryRunner, 'pricing_decision_snapshots', 'IDX_pricing_decisions_status_createdAt', [
      'status',
      'createdAt',
    ]);

    await this.ensureForeignKey(queryRunner, 'pricing_decision_snapshots', {
      columnNames: ['user_id'],
      referencedTableName: 'user',
      referencedColumnNames: ['id'],
      onDelete: 'CASCADE',
    });
    await this.ensureForeignKey(queryRunner, 'pricing_decision_snapshots', {
      columnNames: ['property_address_id'],
      referencedTableName: 'addresses',
      referencedColumnNames: ['id'],
      onDelete: 'SET NULL',
    });
    await this.ensureForeignKey(queryRunner, 'pricing_decision_snapshots', {
      columnNames: ['list_id'],
      referencedTableName: 'list',
      referencedColumnNames: ['id'],
      onDelete: 'SET NULL',
    });
    await this.ensureForeignKey(queryRunner, 'pricing_decision_snapshots', {
      columnNames: ['event_id'],
      referencedTableName: 'events',
      referencedColumnNames: ['id'],
      onDelete: 'SET NULL',
    });
    await this.ensureForeignKey(queryRunner, 'pricing_decision_snapshots', {
      columnNames: ['event_intelligence_snapshot_id'],
      referencedTableName: 'event_intelligence_snapshots',
      referencedColumnNames: ['id'],
      onDelete: 'SET NULL',
    });
    await this.ensureForeignKey(queryRunner, 'pricing_decision_snapshots', {
      columnNames: ['event_property_impact_id'],
      referencedTableName: 'event_property_impacts',
      referencedColumnNames: ['id'],
      onDelete: 'SET NULL',
    });
    await this.ensureForeignKey(queryRunner, 'pricing_decision_snapshots', {
      columnNames: ['analise_preco_id'],
      referencedTableName: 'analise_preco',
      referencedColumnNames: ['id'],
      onDelete: 'SET NULL',
    });
    await this.ensureForeignKey(queryRunner, 'pricing_decision_snapshots', {
      columnNames: ['price_update_id'],
      referencedTableName: 'price_updates',
      referencedColumnNames: ['id'],
      onDelete: 'SET NULL',
    });
  }

  private uuidPrimaryColumn() {
    return {
      name: 'id',
      type: 'varchar',
      length: '36',
      isPrimary: true,
      generationStrategy: 'uuid' as const,
      default: '(UUID())',
    };
  }

  private createdAtColumn() {
    return {
      name: 'createdAt',
      type: 'datetime',
      precision: 6,
      default: 'CURRENT_TIMESTAMP(6)',
      isNullable: false,
    };
  }

  private updatedAtColumn() {
    return {
      name: 'updatedAt',
      type: 'datetime',
      precision: 6,
      default: 'CURRENT_TIMESTAMP(6)',
      onUpdate: 'CURRENT_TIMESTAMP(6)',
      isNullable: false,
    };
  }

  private async ensureIndex(
    queryRunner: QueryRunner,
    tableName: string,
    indexName: string,
    columnNames: string[],
  ) {
    const table = await queryRunner.getTable(tableName);
    if (table?.indices.some((idx) => idx.name === indexName)) return;
    await queryRunner.createIndex(tableName, new TableIndex({ name: indexName, columnNames }));
  }

  private async ensureForeignKey(
    queryRunner: QueryRunner,
    tableName: string,
    input: {
      columnNames: string[];
      referencedTableName: string;
      referencedColumnNames: string[];
      onDelete: 'CASCADE' | 'SET NULL' | 'RESTRICT';
    },
  ) {
    if (!(await queryRunner.hasTable(input.referencedTableName))) return;
    const table = await queryRunner.getTable(tableName);
    const exists = table?.foreignKeys.some(
      (fk) =>
        fk.columnNames.join(',') === input.columnNames.join(',') &&
        fk.referencedTableName === input.referencedTableName,
    );
    if (exists) return;
    await queryRunner.createForeignKey(tableName, new TableForeignKey(input));
  }
}
