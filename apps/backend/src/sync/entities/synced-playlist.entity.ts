import { Column, Entity, Index, PrimaryColumn } from "typeorm";

/** A user's playlist (regular or smart) as stored for cross-device sync. */
@Entity("synced_playlists")
@Index("IDX_synced_playlists_user", ["userId"])
export class SyncedPlaylist {
    /** Generated on the client (UUID). */
    @PrimaryColumn({ type: "uuid" })
    id!: string;

    @Column({ name: "user_id", type: "uuid" })
    userId!: string;

    @Column({ type: "jsonb" })
    data!: Record<string, unknown>;

    @Column({ type: "boolean", default: false })
    deleted!: boolean;

    @Column({
        name: "updated_at",
        type: "bigint",
        transformer: { to: (v: number) => v, from: Number },
    })
    updatedAt!: number;
}
