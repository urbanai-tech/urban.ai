import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPricingColumnsToPlans1778015000000 implements MigrationInterface {
    name = 'AddPricingColumnsToPlans1778015000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await queryRunner.hasTable('plans'))) {
            return;
        }

        await this.addColumnIfMissing(queryRunner, 'priceMonthly', 'varchar(255) NULL');
        await this.addColumnIfMissing(queryRunner, 'priceQuarterly', 'varchar(255) NULL');
        await this.addColumnIfMissing(queryRunner, 'priceSemestral', 'varchar(255) NULL');
        await this.addColumnIfMissing(queryRunner, 'priceAnnualNew', 'varchar(255) NULL');
        await this.addColumnIfMissing(queryRunner, 'originalPriceMonthly', 'varchar(255) NULL');
        await this.addColumnIfMissing(queryRunner, 'originalPriceQuarterly', 'varchar(255) NULL');
        await this.addColumnIfMissing(queryRunner, 'originalPriceSemestral', 'varchar(255) NULL');
        await this.addColumnIfMissing(queryRunner, 'originalPriceAnnualNew', 'varchar(255) NULL');
        await this.addColumnIfMissing(queryRunner, 'stripePriceIdMonthly', 'varchar(255) NULL');
        await this.addColumnIfMissing(queryRunner, 'stripePriceIdQuarterly', 'varchar(255) NULL');
        await this.addColumnIfMissing(queryRunner, 'stripePriceIdSemestral', 'varchar(255) NULL');
        await this.addColumnIfMissing(queryRunner, 'stripePriceIdAnnualNew', 'varchar(255) NULL');
        await this.addColumnIfMissing(queryRunner, 'discountQuarterlyPercent', 'int NULL');
        await this.addColumnIfMissing(queryRunner, 'discountSemestralPercent', 'int NULL');
        await this.addColumnIfMissing(queryRunner, 'discountAnnualPercent', 'int NULL');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (!(await queryRunner.hasTable('plans'))) {
            return;
        }

        await this.dropColumnIfExists(queryRunner, 'discountAnnualPercent');
        await this.dropColumnIfExists(queryRunner, 'discountSemestralPercent');
        await this.dropColumnIfExists(queryRunner, 'discountQuarterlyPercent');
        await this.dropColumnIfExists(queryRunner, 'stripePriceIdAnnualNew');
        await this.dropColumnIfExists(queryRunner, 'stripePriceIdSemestral');
        await this.dropColumnIfExists(queryRunner, 'stripePriceIdQuarterly');
        await this.dropColumnIfExists(queryRunner, 'stripePriceIdMonthly');
        await this.dropColumnIfExists(queryRunner, 'originalPriceAnnualNew');
        await this.dropColumnIfExists(queryRunner, 'originalPriceSemestral');
        await this.dropColumnIfExists(queryRunner, 'originalPriceQuarterly');
        await this.dropColumnIfExists(queryRunner, 'originalPriceMonthly');
        await this.dropColumnIfExists(queryRunner, 'priceAnnualNew');
        await this.dropColumnIfExists(queryRunner, 'priceSemestral');
        await this.dropColumnIfExists(queryRunner, 'priceQuarterly');
        await this.dropColumnIfExists(queryRunner, 'priceMonthly');
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
