import { create } from "zustand";
import { randomUUID } from "expo-crypto";
import { getPlaylists, markPlaylistDeleted, savePlaylist } from "../data/db";
import type { Playlist, SmartRules, SortDir, SortKey } from "../data/types";

interface PlaylistState {
    playlists: Playlist[];
    load: () => void;
    create: (name: string, trackIds?: string[]) => Playlist;
    createSmart: (
        name: string,
        rules: SmartRules,
        options: { sortBy?: SortKey; sortDir?: SortDir; limitCount?: number }
    ) => Playlist;
    update: (id: string, changes: Partial<Omit<Playlist, "id" | "createdAt">>) => void;
    remove: (id: string) => void;
    addTracks: (id: string, assetIds: string[]) => void;
    removeTrack: (id: string, assetId: string) => void;
    move: (id: string, from: number, to: number) => void;
}

/** Regular and smart playlists (REQ 47–48, 51–54), stored locally in SQLite. */
export const usePlaylistStore = create<PlaylistState>((set, get) => {
    const find = (id: string) => get().playlists.find((p) => p.id === id);
    const persist = (playlist: Playlist) => {
        savePlaylist(playlist);
        get().load();
    };

    return {
        playlists: [],
        load: () => set({ playlists: getPlaylists() }),

        create: (name, trackIds = []) => {
            const now = Date.now();
            const playlist: Playlist = {
                id: randomUUID(),
                name: name.trim(),
                isSmart: false,
                trackIds: [...new Set(trackIds)],
                createdAt: now,
                updatedAt: now,
            };
            persist(playlist);
            return playlist;
        },

        createSmart: (name, rules, options) => {
            const now = Date.now();
            const playlist: Playlist = {
                id: randomUUID(),
                name: name.trim(),
                isSmart: true,
                rules,
                ...options,
                trackIds: [],
                createdAt: now,
                updatedAt: now,
            };
            persist(playlist);
            return playlist;
        },

        update: (id, changes) => {
            const current = find(id);
            if (!current) return;
            persist({ ...current, ...changes, updatedAt: Date.now() });
        },

        remove: (id) => {
            markPlaylistDeleted(id);
            get().load();
        },

        addTracks: (id, assetIds) => {
            const current = find(id);
            if (!current) return;
            const trackIds = [...current.trackIds];
            for (const a of assetIds) if (!trackIds.includes(a)) trackIds.push(a);
            persist({ ...current, trackIds, updatedAt: Date.now() });
        },

        removeTrack: (id, assetId) => {
            const current = find(id);
            if (!current) return;
            persist({
                ...current,
                trackIds: current.trackIds.filter((t) => t !== assetId),
                updatedAt: Date.now(),
            });
        },

        move: (id, from, to) => {
            const current = find(id);
            if (!current || to < 0 || to >= current.trackIds.length) return;
            const trackIds = [...current.trackIds];
            const [item] = trackIds.splice(from, 1);
            trackIds.splice(to, 0, item!);
            persist({ ...current, trackIds, updatedAt: Date.now() });
        },
    };
});
