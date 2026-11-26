import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Per-account protection against password guessing (see auth/login-lockout.ts).
 * Both columns have defaults, so the previous backend version keeps working (deploy rollback).
 */
export class AddLoginLockout1764500000000 implements MigrationInterface {
    name = "AddLoginLockout1764500000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "users"
                ADD COLUMN "failed_login_count" INTEGER     NOT NULL DEFAULT 0,
                ADD COLUMN "locked_until"       TIMESTAMPTZ
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "users"
                DROP COLUMN "locked_until",
                DROP COLUMN "failed_login_count"
        `);
    }
}
