import { Column, Entity, PrimaryColumn } from "typeorm";

/**
 * User data for one track (manual edits, own tags, favourite flag), keyed by the track's
 * fingerprint so it can be matched to local files on another device. Audio is never uploaded.
 */
@Entity("library_items")
export class LibraryItem {
    @PrimaryColumn({ name: "user_id", type: "uuid" })
    userId!: string;

    @PrimaryColumn({ type: "varchar", length: 255 })
    key!: string;

    @Column({ type: "jsonb" })
    data!: Record<string, unknown>;

    /** Client-side modification time (ms since epoch) — the last write wins. */
    @Column({
        name: "updated_at",
        type: "bigint",
        transformer: { to: (v: number) => v, from: Number },
    })
    updatedAt!: number;
}
