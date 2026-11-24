import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

/**
 * Cached analysis result, keyed by the track's acoustic fingerprint and the genre-model version.
 * Shared between all users: the same recording is analysed only once per model version.
 */
@Entity("track_analyses")
@Index("UQ_track_analyses_fingerprint_version", ["fingerprint", "modelVersion"], { unique: true })
export class TrackAnalysis {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "varchar", length: 128 })
    fingerprint!: string;

    @Column({ name: "model_version", type: "varchar", length: 64 })
    modelVersion!: string;

    /** Analysis result as returned by the AI worker, without the raw vectors. */
    @Column({ type: "jsonb" })
    result!: Record<string, unknown>;

    /** Normalised audio embedding used for similarity search. */
    @Column({ type: "jsonb", nullable: true, select: false })
    embedding!: number[] | null;

    /** Raw feature vector; used as a training sample when users correct the genre. */
    @Column({ type: "jsonb", nullable: true, select: false })
    features!: number[] | null;

    @Index("IDX_track_analyses_genre")
    @Column({ type: "varchar", length: 64, nullable: true })
    genre!: string | null;

    @Column({ name: "processing_ms", type: "int", nullable: true })
    processingMs!: number | null;

    @CreateDateColumn({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;
}
