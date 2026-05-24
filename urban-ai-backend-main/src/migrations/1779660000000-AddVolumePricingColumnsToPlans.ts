import { MigrationInterface, QueryRunner } from "typeorm";

export class AddVolumePricingColumnsToPlans1779660000000 implements MigrationInterface {
    name = 'AddVolumePricingColumnsToPlans1779660000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await queryRunner.hasTable('plans'))) {
            return;
        }

        await this.addColumnIfMissing(queryRunner, 'minProperties', 'int NULL');
        await this.addColumnIfMissing(queryRunner, 'maxProperties', 'int NULL');
        await this.addColumnIfMissing(queryRunner, 'maxCheckoutQuantity', 'int NULL');
        await this.addColumnIfMissing(queryRunner, 'selfServiceEnabled', 'tinyint NOT NULL DEFAULT 1');
        await this.addColumnIfMissing(queryRunner, 'sortOrder', 'int NOT NULL DEFAULT 0');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (!(await queryRunner.hasTable('plans'))) {
            return;
        }

        await this.dropColumnIfExists(queryRunner, 'sortOrder');
        await this.dropColumnIfExists(queryRunner, 'selfServiceEnabled');
        await this.dropColumnIfExists(queryRunner, 'maxCheckoutQuantity');
        await this.dropColumnIfExists(queryRunner, 'maxProperties');
        await this.dropColumnIfExists(queryRunner, 'minProperties');
    }

    private async addColumnIfMissing(
        queryRunner: QueryRunner,
        columnName: string,
        definition: string,
    ): Promise<void> {
        if (!(await queryRunner.hasColumn('plans', columnName))) {
            await queryRunner.query(`ALTER TABLE \`plans\` ADD \`${columnName}\` ${definition}`);
        }
    }

    private async dropColumnIfExists(
        queryRunner: QueryRunner,
        columnName: string,
    ): Promise<void> {
        if (await queryRunner.hasColumn('plans', columnName)) {
            await queryRunner.query(`ALTER TABLE \`plans\` DROP COLUMN \`${columnName}\``);
        }
    }
}
