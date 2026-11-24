import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

export interface ModelMetrics {
    accuracy: number;
    macro_f1: number;
    f1_per_genre: Record<string, number>;
    confusion_matrix: number[][];
    labels: string[];
    test_samples?: number;
    train_samples?: number;
    corrections_used?: number;
    [key: string]: unknown;
}

/** A version of the genre classifier. Weights are kept here so the AI worker can always be restored. */
@Entity("model_versions")
export class ModelVersion {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "varchar", length: 64, unique: true })
    version!: string;

    @Column({ type: "jsonb", nullable: true })
    metrics!: ModelMetrics | null;

    @Column({ type: "bytea", nullable: true, select: false })
    weights!: Buffer | null;

    @Column({ name: "is_active", type: "boolean", default: false })
    isActive!: boolean;

    @Column({ name: "corrections_used", type: "int", default: 0 })
    correctionsUsed!: number;

    @CreateDateColumn({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;

    @Column({ name: "activated_at", type: "timestamptz", nullable: true })
    activatedAt!: Date | null;
}
