import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPricingColumnsToPlans1778015000000 implements MigrationInterface {
    name = 'AddPricingColumnsToPlans1778015000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`plans\` ADD \`priceMonthly\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`plans\` ADD \`priceQuarterly\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`plans\` ADD \`priceSemestral\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`plans\` ADD \`priceAnnualNew\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`plans\` ADD \`originalPriceMonthly\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`plans\` ADD \`originalPriceQuarterly\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`plans\` ADD \`originalPriceSemestral\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`plans\` ADD \`originalPriceAnnualNew\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`plans\` ADD \`stripePriceIdMonthly\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`plans\` ADD \`stripePriceIdQuarterly\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`plans\` ADD \`stripePriceIdSemestral\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`plans\` ADD \`stripePriceIdAnnualNew\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`plans\` ADD \`discountQuarterlyPercent\` int NULL`);
        await queryRunner.query(`ALTER TABLE \`plans\` ADD \`discountSemestralPercent\` int NULL`);
        await queryRunner.query(`ALTER TABLE \`plans\` ADD \`discountAnnualPercent\` int NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`plans\` DROP COLUMN \`discountAnnualPercent\``);
        await queryRunner.query(`ALTER TABLE \`plans\` DROP COLUMN \`discountSemestralPercent\``);
        await queryRunner.query(`ALTER TABLE \`plans\` DROP COLUMN \`discountQuarterlyPercent\``);
        await queryRunner.query(`ALTER TABLE \`plans\` DROP COLUMN \`stripePriceIdAnnualNew\``);
        await queryRunner.query(`ALTER TABLE \`plans\` DROP COLUMN \`stripePriceIdSemestral\``);
        await queryRunner.query(`ALTER TABLE \`plans\` DROP COLUMN \`stripePriceIdQuarterly\``);
        await queryRunner.query(`ALTER TABLE \`plans\` DROP COLUMN \`stripePriceIdMonthly\``);
        await queryRunner.query(`ALTER TABLE \`plans\` DROP COLUMN \`originalPriceAnnualNew\``);
        await queryRunner.query(`ALTER TABLE \`plans\` DROP COLUMN \`originalPriceSemestral\``);
        await queryRunner.query(`ALTER TABLE \`plans\` DROP COLUMN \`originalPriceQuarterly\``);
        await queryRunner.query(`ALTER TABLE \`plans\` DROP COLUMN \`originalPriceMonthly\``);
        await queryRunner.query(`ALTER TABLE \`plans\` DROP COLUMN \`priceAnnualNew\``);
        await queryRunner.query(`ALTER TABLE \`plans\` DROP COLUMN \`priceSemestral\``);
        await queryRunner.query(`ALTER TABLE \`plans\` DROP COLUMN \`priceQuarterly\``);
        await queryRunner.query(`ALTER TABLE \`plans\` DROP COLUMN \`priceMonthly\``);
    }

}
