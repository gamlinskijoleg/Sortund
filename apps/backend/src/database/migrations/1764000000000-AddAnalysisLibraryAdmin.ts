import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAnalysisLibraryAdmin1764000000000 implements MigrationInterface {
    name = "AddAnalysisLibraryAdmin1764000000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        // ── users: role, limit, blocking, push token ──────────────────────────
        await queryRunner.query(`
            ALTER TABLE "users"
                ADD COLUMN "role"                   VARCHAR(16)  NOT NULL DEFAULT 'user',
                ADD COLUMN "monthly_analysis_limit" INTEGER      NOT NULL DEFAULT 100,
                ADD COLUMN "is_blocked"             BOOLEAN      NOT NULL DEFAULT false,
                ADD COLUMN "push_token"             VARCHAR(255)
        `);

        // ── analysis cache ────────────────────────────────────────────────────
        await queryRunner.query(`
            CREATE TABLE "track_analyses" (
                "id"            UUID         NOT NULL DEFAULT gen_random_uuid(),
                "fingerprint"   VARCHAR(128) NOT NULL,
                "model_version" VARCHAR(64)  NOT NULL,
                "result"        JSONB        NOT NULL,
                "embedding"     JSONB,
                "features"      JSONB,
                "genre"         VARCHAR(64),
                "processing_ms" INTEGER,
                "created_at"    TIMESTAMPTZ  NOT NULL DEFAULT now(),
                CONSTRAINT "PK_track_analyses" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(
            `CREATE UNIQUE INDEX "UQ_track_analyses_fingerprint_version" ON "track_analyses" ("fingerprint", "model_version")`
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_track_analyses_genre" ON "track_analyses" ("genre")`
        );

        // ── analysis queue ────────────────────────────────────────────────────
        await queryRunner.query(`
            CREATE TABLE "analysis_jobs" (
                "id"                  UUID         NOT NULL DEFAULT gen_random_uuid(),
                "user_id"             UUID         NOT NULL,
                "client_track_id"     VARCHAR(255) NOT NULL,
                "filename"            VARCHAR(512) NOT NULL,
                "status"              VARCHAR(16)  NOT NULL DEFAULT 'queued',
                "error"               TEXT,
                "payload"             BYTEA,
                "force"               BOOLEAN      NOT NULL DEFAULT false,
                "from_cache"          BOOLEAN      NOT NULL DEFAULT false,
                "counts_toward_limit" BOOLEAN      NOT NULL DEFAULT false,
                "fingerprint"         VARCHAR(128),
                "analysis_id"         UUID,
                "model_version"       VARCHAR(64),
                "attempts"            INTEGER      NOT NULL DEFAULT 0,
                "duration_ms"         INTEGER,
                "notified"            BOOLEAN      NOT NULL DEFAULT false,
                "created_at"          TIMESTAMPTZ  NOT NULL DEFAULT now(),
                "started_at"          TIMESTAMPTZ,
                "finished_at"         TIMESTAMPTZ,
                CONSTRAINT "PK_analysis_jobs" PRIMARY KEY ("id"),
                CONSTRAINT "FK_analysis_jobs_users" FOREIGN KEY ("user_id")
                    REFERENCES "users"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_analysis_jobs_track_analyses" FOREIGN KEY ("analysis_id")
                    REFERENCES "track_analyses"("id") ON DELETE SET NULL
            )
        `);
        await queryRunner.query(
            `CREATE INDEX "IDX_analysis_jobs_status_created" ON "analysis_jobs" ("status", "created_at")`
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_analysis_jobs_user_created" ON "analysis_jobs" ("user_id", "created_at")`
        );

        // ── genre model versions ──────────────────────────────────────────────
        await queryRunner.query(`
            CREATE TABLE "model_versions" (
                "id"               UUID        NOT NULL DEFAULT gen_random_uuid(),
                "version"          VARCHAR(64) NOT NULL,
                "metrics"          JSONB,
                "weights"          BYTEA,
                "is_active"        BOOLEAN     NOT NULL DEFAULT false,
                "corrections_used" INTEGER     NOT NULL DEFAULT 0,
                "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
                "activated_at"     TIMESTAMPTZ,
                CONSTRAINT "PK_model_versions" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_model_versions_version" UNIQUE ("version")
            )
        `);

        // ── user corrections ──────────────────────────────────────────────────
        await queryRunner.query(`
            CREATE TABLE "corrections" (
                "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
                "user_id"         UUID         NOT NULL,
                "fingerprint"     VARCHAR(128) NOT NULL,
                "field"           VARCHAR(16)  NOT NULL,
                "old_value"       VARCHAR(128),
                "new_value"       VARCHAR(128) NOT NULL,
                "status"          VARCHAR(16)  NOT NULL DEFAULT 'pending',
                "used_in_version" VARCHAR(64),
                "created_at"      TIMESTAMPTZ  NOT NULL DEFAULT now(),
                CONSTRAINT "PK_corrections" PRIMARY KEY ("id"),
                CONSTRAINT "FK_corrections_users" FOREIGN KEY ("user_id")
                    REFERENCES "users"("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(
            `CREATE INDEX "IDX_corrections_status" ON "corrections" ("status", "created_at")`
        );

        // ── cross-device sync ─────────────────────────────────────────────────
        await queryRunner.query(`
            CREATE TABLE "library_items" (
                "user_id"    UUID         NOT NULL,
                "key"        VARCHAR(255) NOT NULL,
                "data"       JSONB        NOT NULL,
                "updated_at" BIGINT       NOT NULL,
                CONSTRAINT "PK_library_items" PRIMARY KEY ("user_id", "key"),
                CONSTRAINT "FK_library_items_users" FOREIGN KEY ("user_id")
                    REFERENCES "users"("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(`
            CREATE TABLE "synced_playlists" (
                "id"         UUID    NOT NULL,
                "user_id"    UUID    NOT NULL,
                "data"       JSONB   NOT NULL,
                "deleted"    BOOLEAN NOT NULL DEFAULT false,
                "updated_at" BIGINT  NOT NULL,
                CONSTRAINT "PK_synced_playlists" PRIMARY KEY ("id"),
                CONSTRAINT "FK_synced_playlists_users" FOREIGN KEY ("user_id")
                    REFERENCES "users"("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(
            `CREATE INDEX "IDX_synced_playlists_user" ON "synced_playlists" ("user_id")`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "synced_playlists"`);
        await queryRunner.query(`DROP TABLE "library_items"`);
        await queryRunner.query(`DROP TABLE "corrections"`);
        await queryRunner.query(`DROP TABLE "model_versions"`);
        await queryRunner.query(`DROP TABLE "analysis_jobs"`);
        await queryRunner.query(`DROP TABLE "track_analyses"`);
        await queryRunner.query(`
            ALTER TABLE "users"
                DROP COLUMN "push_token",
                DROP COLUMN "is_blocked",
                DROP COLUMN "monthly_analysis_limit",
                DROP COLUMN "role"
        `);
    }
}
