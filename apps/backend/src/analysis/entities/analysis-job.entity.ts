import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

export enum JobStatus {
    Queued = "queued",
    Processing = "processing",
    Done = "done",
    Failed = "failed",
}

/** One request to analyse one track fragment. Processed asynchronously by AnalysisProcessor. */
@Entity("analysis_jobs")
@Index("IDX_analysis_jobs_status_created", ["status", "createdAt"])
@Index("IDX_analysis_jobs_user_created", ["userId", "createdAt"])
export class AnalysisJob {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ name: "user_id", type: "uuid" })
    userId!: string;

    /** Track identifier on the client device (media library asset id). */
    @Column({ name: "client_track_id", type: "varchar", length: 255 })
    clientTrackId!: string;

    @Column({ type: "varchar", length: 512 })
    filename!: string;

    @Column({ type: "varchar", length: 16, default: JobStatus.Queued })
    status!: JobStatus;

    @Column({ type: "text", nullable: true })
    error!: string | null;

    /** Uploaded audio fragment; cleared once the job succeeds. */
    @Column({ type: "bytea", nullable: true, select: false })
    payload!: Buffer | null;

    /** Re-analyse even if a cached result exists (e.g. after a model update). */
    @Column({ type: "boolean", default: false })
    force!: boolean;

    @Column({ name: "from_cache", type: "boolean", default: false })
    fromCache!: boolean;

    /** True when the job ran the models and therefore consumed the monthly limit. */
    @Column({ name: "counts_toward_limit", type: "boolean", default: false })
    countsTowardLimit!: boolean;

    @Column({ type: "varchar", length: 128, nullable: true })
    fingerprint!: string | null;

    @Column({ name: "analysis_id", type: "uuid", nullable: true })
    analysisId!: string | null;

    @Column({ name: "model_version", type: "varchar", length: 64, nullable: true })
    modelVersion!: string | null;

    @Column({ type: "int", default: 0 })
    attempts!: number;

    @Column({ name: "duration_ms", type: "int", nullable: true })
    durationMs!: number | null;

    /** Whether the user has been notified (push) about this job's completion. */
    @Column({ type: "boolean", default: false })
    notified!: boolean;

    @CreateDateColumn({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;

    @Column({ name: "started_at", type: "timestamptz", nullable: true })
    startedAt!: Date | null;

    @Column({ name: "finished_at", type: "timestamptz", nullable: true })
    finishedAt!: Date | null;
}
