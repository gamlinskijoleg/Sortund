import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, MoreThan, Repository } from "typeorm";
import { LibraryItem } from "./entities/library-item.entity";
import { SyncedPlaylist } from "./entities/synced-playlist.entity";

export interface SyncItemInput {
    key: string;
    data: Record<string, unknown>;
    updatedAt: number;
}

export interface SyncPlaylistInput {
    id: string;
    data: Record<string, unknown>;
    deleted?: boolean;
    updatedAt: number;
}

export interface SyncResult {
    items: SyncItemInput[];
    playlists: (SyncPlaylistInput & { deleted: boolean })[];
    serverTime: number;
    accepted: { items: number; playlists: number };
}

/** True when the incoming change should replace the stored one ("last write wins", REQ 60). */
export function incomingWins(
    incomingUpdatedAt: number,
    storedUpdatedAt: number | undefined
): boolean {
    return storedUpdatedAt === undefined || incomingUpdatedAt > storedUpdatedAt;
}

@Injectable()
export class SyncService {
    constructor(
        @InjectRepository(LibraryItem)
        private readonly items: Repository<LibraryItem>,
        @InjectRepository(SyncedPlaylist)
        private readonly playlists: Repository<SyncedPlaylist>,
        private readonly dataSource: DataSource
    ) {}

    /**
     * Merges the client's changes into the server copy and returns everything changed after
     * ``since`` (or the full state when ``since`` is 0), so the client can apply newer remote data.
     */
    async sync(
        userId: string,
        input: { items: SyncItemInput[]; playlists: SyncPlaylistInput[]; since: number }
    ): Promise<SyncResult> {
        const now = Date.now();
        let acceptedItems = 0;
        let acceptedPlaylists = 0;

        await this.dataSource.transaction(async (manager) => {
            const itemRepo = manager.getRepository(LibraryItem);
            const playlistRepo = manager.getRepository(SyncedPlaylist);

            if (input.items.length) {
                const stored = await itemRepo.find({
                    where: { userId, key: In(input.items.map((i) => i.key)) },
                });
                const storedByKey = new Map(stored.map((s) => [s.key, s.updatedAt]));
                const winners = input.items
                    .filter((i) => incomingWins(i.updatedAt, storedByKey.get(i.key)))
                    .map((i) => ({
                        userId,
                        key: i.key,
                        data: i.data,
                        updatedAt: Math.min(i.updatedAt, now),
                    }));
                if (winners.length) await itemRepo.save(winners, { chunk: 500 });
                acceptedItems = winners.length;
            }

            if (input.playlists.length) {
                const stored = await playlistRepo.find({
                    where: { id: In(input.playlists.map((p) => p.id)) },
                });
                const storedById = new Map(stored.map((s) => [s.id, s]));
                const winners = input.playlists
                    .filter((p) => {
                        const existing = storedById.get(p.id);
                        // Never overwrite another user's playlist that happens to share an id.
                        if (existing && existing.userId !== userId) return false;
                        return incomingWins(p.updatedAt, existing?.updatedAt);
                    })
                    .map((p) => ({
                        id: p.id,
                        userId,
                        data: p.data,
                        deleted: p.deleted ?? false,
                        updatedAt: Math.min(p.updatedAt, now),
                    }));
                if (winners.length) await playlistRepo.save(winners, { chunk: 200 });
                acceptedPlaylists = winners.length;
            }
        });

        const since = input.since > 0 ? input.since : -1;
        const [items, playlists] = await Promise.all([
            this.items.find({ where: { userId, updatedAt: MoreThan(since) } }),
            this.playlists.find({ where: { userId, updatedAt: MoreThan(since) } }),
        ]);

        return {
            items: items.map((i) => ({ key: i.key, data: i.data, updatedAt: i.updatedAt })),
            playlists: playlists.map((p) => ({
                id: p.id,
                data: p.data,
                deleted: p.deleted,
                updatedAt: p.updatedAt,
            })),
            serverTime: now,
            accepted: { items: acceptedItems, playlists: acceptedPlaylists },
        };
    }
}
