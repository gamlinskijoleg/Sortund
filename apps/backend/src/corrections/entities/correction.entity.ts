import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

export enum CorrectionField {
    Genre = "genre",
    Mood = "mood",
}

export enum CorrectionStatus {
    Pending = "pending",
    Approved = "approved",
    Rejected = "rejected",
}

/** A user's manual fix of an automatically assigned genre or mood — training data for the model. */
@Entity("corrections")
@Index("IDX_corrections_status", ["status", "createdAt"])
export class Correction {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ name: "user_id", type: "uuid" })
    userId!: string;

    @Column({ type: "varchar", length: 128 })
    fingerprint!: string;

    @Column({ type: "varchar", length: 16 })
    field!: CorrectionField;

    @Column({ name: "old_value", type: "varchar", length: 128, nullable: true })
    oldValue!: string | null;

    @Column({ name: "new_value", type: "varchar", length: 128 })
    newValue!: string;

    @Column({ type: "varchar", length: 16, default: CorrectionStatus.Pending })
    status!: CorrectionStatus;

    /** Model version that was trained with this correction. */
    @Column({ name: "used_in_version", type: "varchar", length: 64, nullable: true })
    usedInVersion!: string | null;

    @CreateDateColumn({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;
}
