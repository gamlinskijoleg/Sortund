import { syncApi, type SyncItem, type SyncPlaylist } from "../api/endpoints";
import { getCachedTracks, getPlaylists, kvGet, kvSet, savePlaylist, updateTrack } from "../data/db";
import { refreshLibrary } from "../data/music";
import type {
    EditableField,
    MusicTrack,
    Playlist,
    SmartRules,
    SortDir,
    SortKey,
} from "../data/types";
import { syncKey } from "../library/track-utils";
import { usePlaylistStore } from "../store/usePlaylistStore";

const SINCE_KEY = "sync.since";
const LAST_KEY = "sync.lastAt";

/** User-owned data of a track; analysis results are not synced (they come from the server cache). */
type ItemData = {
    edits?: Partial<Record<EditableField, string | number>>;
    userTags?: string[];
    removedTags?: string[];
    isFavourite?: boolean;
};

export function buildItem(track: MusicTrack): SyncItem | null {
    const hasUserData =
        (track.userEdited?.length ?? 0) > 0 ||
        (track.userTags?.length ?? 0) > 0 ||
        (track.removedTags?.length ?? 0) > 0 ||
        !!track.isFavourite ||
        !!track.userUpdatedAt;
    if (!hasUserData) return null;

    const edits: ItemData["edits"] = {};
    for (const field of track.userEdited ?? []) {
        const value = track[field];
        if (value !== undefined && value !== null && value !== "") edits[field] = value;
    }
    const data: ItemData = {
        edits,
        userTags: track.userTags ?? [],
        removedTags: track.removedTags ?? [],
        isFavourite: !!track.isFavourite,
    };
    return { key: syncKey(track), data, updatedAt: track.userUpdatedAt || 1 };
}

export function applyItem(track: MusicTrack, item: SyncItem) {
    const data = item.data as ItemData;
    const edits = data.edits ?? {};
    const fields = Object.keys(edits) as EditableField[];
    updateTrack(track.assetId, {
        ...(edits as Partial<MusicTrack>),
        ...(edits.year ? { date: String(edits.year) } : {}),
        userEdited: [...new Set([...(track.userEdited ?? []), ...fields])],
        userTags: data.userTags ?? [],
        removedTags: data.removedTags ?? [],
        isFavourite: !!data.isFavourite,
        userUpdatedAt: item.updatedAt,
    });
}

function playlistToSync(p: Playlist, keysById: Map<string, string>): SyncPlaylist {
    return {
        id: p.id,
        deleted: !!p.deleted,
        updatedAt: p.updatedAt,
        data: {
            name: p.name,
            isSmart: p.isSmart,
            rules: p.rules,
            sortBy: p.sortBy,
            sortDir: p.sortDir,
            limitCount: p.limitCount,
            tracks: p.trackIds.map((id) => keysById.get(id)).filter(Boolean),
        },
    };
}

/**
 * Two-way sync (REQ 58–60): uploads local changes and applies newer remote ones.
 * Conflicts are resolved on both sides by "last write wins" using modification times.
 */
export async function syncNow(): Promise<{ items: number; playlists: number }> {
    const since = Number(kvGet(SINCE_KEY) ?? 0);
    const tracks = getCachedTracks();
    const keysById = new Map(tracks.map((t) => [t.assetId, syncKey(t)]));
    const tracksByKey = new Map<string, MusicTrack[]>();
    for (const t of tracks) {
        const key = keysById.get(t.assetId)!;
        tracksByKey.set(key, [...(tracksByKey.get(key) ?? []), t]);
    }

    const items = tracks
        .filter((t) => !since || (t.userUpdatedAt ?? 0) > since)
        .map(buildItem)
        .filter((i): i is SyncItem => !!i);
    const localPlaylists = getPlaylists(true);
    const playlists = localPlaylists
        .filter((p) => !since || p.updatedAt > since)
        .map((p) => playlistToSync(p, keysById));

    const response = await syncApi.sync(items, playlists, since);

    let appliedItems = 0;
    for (const remote of response.items) {
        for (const track of tracksByKey.get(remote.key) ?? []) {
            if (remote.updatedAt > (track.userUpdatedAt ?? 0)) {
                applyItem(track, remote);
                appliedItems++;
            }
        }
    }

    let appliedPlaylists = 0;
    const localById = new Map(localPlaylists.map((p) => [p.id, p]));
    for (const remote of response.playlists) {
        const local = localById.get(remote.id);
        if (local && local.updatedAt >= remote.updatedAt) continue;
        const d = remote.data as {
            name?: string;
            isSmart?: boolean;
            rules?: SmartRules;
            sortBy?: SortKey;
            sortDir?: SortDir;
            limitCount?: number;
            tracks?: string[];
        };
        const trackIds = (d.tracks ?? []).flatMap((key) =>
            (tracksByKey.get(key) ?? []).map((t) => t.assetId)
        );
        savePlaylist(
            {
                id: remote.id,
                name: d.name ?? "Playlist",
                isSmart: !!d.isSmart,
                rules: d.rules,
                sortBy: d.sortBy,
                sortDir: d.sortDir,
                limitCount: d.limitCount,
                trackIds: [...new Set(trackIds)],
                createdAt: local?.createdAt ?? remote.updatedAt,
                updatedAt: remote.updatedAt,
            },
            { deleted: remote.deleted }
        );
        appliedPlaylists++;
    }

    kvSet(SINCE_KEY, String(response.serverTime));
    kvSet(LAST_KEY, String(Date.now()));
    refreshLibrary();
    usePlaylistStore.getState().load();
    return { items: appliedItems, playlists: appliedPlaylists };
}

export function lastSyncAt(): number | null {
    const v = kvGet(LAST_KEY);
    return v ? Number(v) : null;
}

/** On a new device everything must be downloaded again. */
export function resetSyncCursor() {
    kvSet(SINCE_KEY, null);
}
