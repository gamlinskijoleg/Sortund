import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateInitialSchema1750600000000 implements MigrationInterface {
    name = "CreateInitialSchema1750600000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        // ── users ──────────────────────────────────────────────────────────────
        await queryRunner.query(`
            CREATE TABLE "users" (
                "id"            UUID         NOT NULL DEFAULT gen_random_uuid(),
                "email"         VARCHAR(255) NOT NULL,
                "password_hash" VARCHAR(255) NOT NULL,
                "created_at"    TIMESTAMPTZ  NOT NULL DEFAULT now(),
                "updated_at"    TIMESTAMPTZ  NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_users_email"  UNIQUE  ("email"),
                CONSTRAINT "PK_users"        PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_users_email" ON "users" ("email")
        `);

        // ── sessions ───────────────────────────────────────────────────────────
        // One row per active refresh token (one per device / browser tab).
        await queryRunner.query(`
            CREATE TABLE "sessions" (
                "id"                  UUID         NOT NULL,
                "user_id"             UUID         NOT NULL,
                "refresh_token_hash"  VARCHAR(255) NOT NULL,
                "user_agent"          VARCHAR(500),
                "ip_address"          VARCHAR(45),
                "expires_at"          TIMESTAMPTZ  NOT NULL,
                "created_at"          TIMESTAMPTZ  NOT NULL DEFAULT now(),
                CONSTRAINT "PK_sessions" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            ALTER TABLE "sessions"
            ADD CONSTRAINT "FK_sessions_users"
            FOREIGN KEY ("user_id") REFERENCES "users"("id")
            ON DELETE CASCADE
            ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_sessions_user_id" ON "sessions" ("user_id")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_sessions_user_id"`);
        await queryRunner.query(`ALTER TABLE "sessions" DROP CONSTRAINT "FK_sessions_users"`);
        await queryRunner.query(`DROP TABLE "sessions"`);
        await queryRunner.query(`DROP INDEX "IDX_users_email"`);
        await queryRunner.query(`DROP TABLE "users"`);
    }
}
