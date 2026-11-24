import { log } from "@/utils/logger";
import { openDatabaseSync, type SQLiteBindValue } from "expo-sqlite";
import type {
    AnalysisStatus,
    EditableField,
    MusicTrack,
    Playlist,
    SmartRules,
    SortDir,
    SortKey,
    TagDetail,
} from "./types";
import { effectiveTags } from "../library/track-utils";

const db = openDatabaseSync("music_player.db");

// ── Schema & migrations ────────────────────────────────────────────────────

const MIGRATIONS: string[] = [
    // v1 — original schema
    `CREATE TABLE IF NOT EXISTS tracks (
        assetId TEXT PRIMARY KEY NOT NULL,
        sourceUri TEXT NOT NULL,
        title TEXT, artist TEXT, album TEXT, artwork TEXT, duration REAL,
        genre TEXT, date TEXT, rating TEXT, analysis_source TEXT, tags TEXT,
        isAnalyzed INTEGER DEFAULT 0, color TEXT NOT NULL, modificationTime INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_tracks_analyzed ON tracks(isAnalyzed);`,
    // v2 — analysis details, user edits, favourites, playlists, listening history, settings
    `ALTER TABLE tracks ADD COLUMN filename TEXT;
    ALTER TABLE tracks ADD COLUMN addedAt INTEGER;
    ALTER TABLE tracks ADD COLUMN fingerprint TEXT;
    ALTER TABLE tracks ADD COLUMN year INTEGER;
    ALTER TABLE tracks ADD COLUMN bpm REAL;
    ALTER TABLE tracks ADD COLUMN musicalKey TEXT;
    ALTER TABLE tracks ADD COLUMN mood TEXT;
    ALTER TABLE tracks ADD COLUMN language TEXT;
    ALTER TABLE tracks ADD COLUMN themes TEXT;
    ALTER TABLE tracks ADD COLUMN instruments TEXT;
    ALTER TABLE tracks ADD COLUMN vocal TEXT;
    ALTER TABLE tracks ADD COLUMN lyrics TEXT;
    ALTER TABLE tracks ADD COLUMN tagDetails TEXT;
    ALTER TABLE tracks ADD COLUMN analysisStatus TEXT DEFAULT 'none';
    ALTER TABLE tracks ADD COLUMN analysisJobId TEXT;
    ALTER TABLE tracks ADD COLUMN analysisError TEXT;
    ALTER TABLE tracks ADD COLUMN modelVersion TEXT;
    ALTER TABLE tracks ADD COLUMN userEdited TEXT;
    ALTER TABLE tracks ADD COLUMN userTags TEXT;
    ALTER TABLE tracks ADD COLUMN removedTags TEXT;
    ALTER TABLE tracks ADD COLUMN isFavourite INTEGER DEFAULT 0;
    ALTER TABLE tracks ADD COLUMN userUpdatedAt INTEGER DEFAULT 0;
    UPDATE tracks SET addedAt = CAST(strftime('%s','now') AS INTEGER) * 1000 WHERE addedAt IS NULL;
    UPDATE tracks SET analysisStatus = 'done' WHERE isAnalyzed = 1;
    CREATE INDEX IF NOT EXISTS idx_tracks_fingerprint ON tracks(fingerprint);
    CREATE INDEX IF NOT EXISTS idx_tracks_status ON tracks(analysisStatus);
    CREATE TABLE IF NOT EXISTS playlists (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        isSmart INTEGER NOT NULL DEFAULT 0,
        rules TEXT, sortBy TEXT, sortDir TEXT, limitCount INTEGER,
        createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL,
        deleted INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS playlist_tracks (
        playlistId TEXT NOT NULL, assetId TEXT NOT NULL, position INTEGER NOT NULL,
        PRIMARY KEY (playlistId, assetId)
    );
    CREATE TABLE IF NOT EXISTS listens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assetId TEXT NOT NULL, startedAt INTEGER NOT NULL, durationMs INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_listens_started ON listens(startedAt);
    CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT);`,
];

let initialized = false;

export function initDatabase() {
    if (initialized) return;
    const row = db.getFirstSync<{ user_version: number }>("PRAGMA user_version");
    let version = row?.user_version ?? 0;

    // Databases created by the first app version have the tracks table but user_version 0.
    if (version === 0) {
        const exists = db.getFirstSync<{ name: string }>(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='tracks'"
        );
        if (exists) version = 1;
    }

    for (let v = version; v < MIGRATIONS.length; v++) {
        db.withTransactionSync(() => {
            db.execSync(MIGRATIONS[v]!);
            db.execSync(`PRAGMA user_version = ${v + 1}`);
        });
        log.debug(`SQLite: migrated to schema v${v + 1}`);
    }
    initialized = true;
}

// ── Key-value settings ─────────────────────────────────────────────────────

export function kvGet(key: string): string | null {
    initDatabase();
    return (
        db.getFirstSync<{ value: string | null }>("SELECT value FROM kv WHERE key = ?", key)
            ?.value ?? null
    );
}

export function kvSet(key: string, value: string | null) {
    initDatabase();
    if (value === null) db.runSync("DELETE FROM kv WHERE key = ?", key);
    else db.runSync("INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)", key, value);
}

// ── Tracks ─────────────────────────────────────────────────────────────────

type TrackRow = {
    assetId: string;
    sourceUri: string;
    filename: string | null;
    title: string | null;
    artist: string | null;
    album: string | null;
    artwork: string | null;
    duration: number | null;
    genre: string | null;
    date: string | null;
    rating: string | null;
    analysis_source: string | null;
    tags: string | null;
    isAnalyzed: number | null;
    color: string;
    modificationTime: number | null;
    addedAt: number | null;
    fingerprint: string | null;
    year: number | null;
    bpm: number | null;
    musicalKey: string | null;
    mood: string | null;
    language: string | null;
    themes: string | null;
    instruments: string | null;
    vocal: string | null;
    lyrics: string | null;
    tagDetails: string | null;
    analysisStatus: string | null;
    analysisJobId: string | null;
    analysisError: string | null;
    modelVersion: string | null;
    userEdited: string | null;
    userTags: string | null;
    removedTags: string | null;
    isFavourite: number | null;
    userUpdatedAt: number | null;
};

function parseJson<T>(value: string | null): T | undefined {
    if (!value) return undefined;
    try {
        return JSON.parse(value) as T;
    } catch {
        return undefined;
    }
}

const opt = <T>(v: T | null): T | undefined => (v === null ? undefined : v);

function rowToTrack(r: TrackRow): MusicTrack {
    return {
        assetId: r.assetId,
        sourceUri: r.sourceUri,
        filename: opt(r.filename),
        title: r.title ?? "",
        artist: r.artist ?? "",
        album: opt(r.album),
        artwork: opt(r.artwork),
        duration: r.duration ?? 0,
        genre: opt(r.genre),
        date: opt(r.date),
        rating: r.rating ? Number(r.rating) : undefined,
        analysis_source: opt(r.analysis_source),
        tags: parseJson<string[]>(r.tags),
        isAnalyzed: !!r.isAnalyzed,
        color: r.color,
        modificationTime: opt(r.modificationTime),
        addedAt: opt(r.addedAt),
        fingerprint: opt(r.fingerprint),
        year: opt(r.year),
        bpm: opt(r.bpm),
        musicalKey: opt(r.musicalKey),
        mood: opt(r.mood),
        language: opt(r.language),
        themes: parseJson<string[]>(r.themes),
        instruments: parseJson<string[]>(r.instruments),
        vocal: opt(r.vocal),
        lyrics: opt(r.lyrics),
        tagDetails: parseJson<TagDetail[]>(r.tagDetails),
        analysisStatus: (r.analysisStatus as AnalysisStatus | null) ?? "none",
        analysisJobId: opt(r.analysisJobId),
        analysisError: opt(r.analysisError),
        modelVersion: opt(r.modelVersion),
        userEdited: parseJson<EditableField[]>(r.userEdited),
        userTags: parseJson<string[]>(r.userTags),
        removedTags: parseJson<string[]>(r.removedTags),
        isFavourite: !!r.isFavourite,
        userUpdatedAt: opt(r.userUpdatedAt),
    };
}

export function getCachedTracks(): MusicTrack[] {
    initDatabase();
    const startTime = Date.now();
    const rows = db.getAllSync<TrackRow>("SELECT * FROM tracks");
    log.debug(`SQLite: Fetching ${rows.length} tracks took ${Date.now() - startTime} ms`);
    return rows.map(rowToTrack);
}

export function getTrack(assetId: string): MusicTrack | null {
    initDatabase();
    const row = db.getFirstSync<TrackRow>("SELECT * FROM tracks WHERE assetId = ?", assetId);
    return row ? rowToTrack(row) : null;
}

/**
 * Inserts newly scanned files or refreshes file-derived fields of known ones. Analysis results,
 * user edits, favourites and the "added" date are never overwritten by a rescan.
 */
export async function upsertScannedTracksAsync(tracks: MusicTrack[]) {
    if (tracks.length === 0) return;
    initDatabase();
    const now = Date.now();
    await db.withTransactionAsync(async () => {
        const statement = await db.prepareAsync(`
            INSERT INTO tracks (assetId, sourceUri, filename, title, artist, album, artwork, duration,
                                color, modificationTime, addedAt, analysisStatus, isAnalyzed)
            VALUES ($assetId, $sourceUri, $filename, $title, $artist, $album, $artwork, $duration,
                    $color, $modificationTime, $addedAt, 'none', 0)
            ON CONFLICT(assetId) DO UPDATE SET
                sourceUri = excluded.sourceUri,
                filename = excluded.filename,
                duration = excluded.duration,
                modificationTime = excluded.modificationTime,
                title = CASE WHEN tracks.isAnalyzed = 1 OR instr(COALESCE(tracks.userEdited, ''), '"title"') > 0
                             THEN tracks.title ELSE excluded.title END,
                artist = CASE WHEN tracks.isAnalyzed = 1 OR instr(COALESCE(tracks.userEdited, ''), '"artist"') > 0
                              THEN tracks.artist ELSE excluded.artist END,
                album = CASE WHEN tracks.isAnalyzed = 1 OR instr(COALESCE(tracks.userEdited, ''), '"album"') > 0
                             THEN tracks.album ELSE excluded.album END,
                artwork = COALESCE(tracks.artwork, excluded.artwork)
        `);
        try {
            for (const t of tracks) {
                await statement.executeAsync({
                    $assetId: t.assetId,
                    $sourceUri: t.sourceUri,
                    $filename: t.filename ?? null,
                    $title: t.title || null,
                    $artist: t.artist || null,
                    $album: t.album || null,
                    $artwork: t.artwork || null,
                    $duration: t.duration || null,
                    $color: t.color,
                    $modificationTime: t.modificationTime || 0,
                    $addedAt: t.addedAt ?? now,
                });
            }
        } finally {
            await statement.finalizeAsync();
        }
    });
}

export async function deleteTracksByIdAsync(assetIds: string[]) {
    if (assetIds.length === 0) return;
    initDatabase();
    await db.withTransactionAsync(async () => {
        for (const id of assetIds) {
            await db.runAsync("DELETE FROM tracks WHERE assetId = ?", id);
            await db.runAsync("DELETE FROM playlist_tracks WHERE assetId = ?", id);
        }
    });
}

const JSON_COLUMNS = new Set([
    "tags",
    "themes",
    "instruments",
    "tagDetails",
    "userEdited",
    "userTags",
    "removedTags",
]);
const BOOL_COLUMNS = new Set(["isAnalyzed", "isFavourite"]);

/** Generic partial update; recomputes the effective tag list when tag-related fields change. */
export function updateTrack(assetId: string, changes: Partial<MusicTrack>) {
    initDatabase();
    const current = getTrack(assetId);
    if (!current) return;
    const merged = { ...current, ...changes };
    const next: Partial<MusicTrack> = { ...changes };
    if ("tagDetails" in changes || "userTags" in changes || "removedTags" in changes) {
        next.tags = effectiveTags(merged.tagDetails, merged.userTags, merged.removedTags);
    }

    const entries = Object.entries(next).filter(([k]) => k !== "assetId");
    if (entries.length === 0) return;
    const sets: string[] = [];
    const values: SQLiteBindValue[] = [];
    for (const [key, value] of entries) {
        sets.push(`${key} = ?`);
        if (value === undefined || value === null) values.push(null);
        else if (JSON_COLUMNS.has(key)) values.push(JSON.stringify(value));
        else if (BOOL_COLUMNS.has(key)) values.push(value ? 1 : 0);
        else if (key === "rating") values.push(String(value));
        else values.push(value as SQLiteBindValue);
    }
    values.push(assetId);
    db.runSync(`UPDATE tracks SET ${sets.join(", ")} WHERE assetId = ?`, ...values);
}

export function getTracksByStatus(statuses: AnalysisStatus[]): MusicTrack[] {
    initDatabase();
    const placeholders = statuses.map(() => "?").join(",");
    return db
        .getAllSync<TrackRow>(
            `SELECT * FROM tracks WHERE analysisStatus IN (${placeholders})`,
            ...statuses
        )
        .map(rowToTrack);
}

// ── Playlists ──────────────────────────────────────────────────────────────

type PlaylistRow = {
    id: string;
    name: string;
    isSmart: number;
    rules: string | null;
    sortBy: string | null;
    sortDir: string | null;
    limitCount: number | null;
    createdAt: number;
    updatedAt: number;
    deleted: number;
};

export function getPlaylists(includeDeleted = false): Playlist[] {
    initDatabase();
    const rows = db.getAllSync<PlaylistRow>(
        `SELECT * FROM playlists ${includeDeleted ? "" : "WHERE deleted = 0"} ORDER BY createdAt`
    );
    const tracks = db.getAllSync<{ playlistId: string; assetId: string }>(
        "SELECT playlistId, assetId FROM playlist_tracks ORDER BY playlistId, position"
    );
    const byPlaylist = new Map<string, string[]>();
    for (const t of tracks) {
        const list = byPlaylist.get(t.playlistId) ?? [];
        list.push(t.assetId);
        byPlaylist.set(t.playlistId, list);
    }
    return rows.map((r) => ({
        id: r.id,
        name: r.name,
        isSmart: !!r.isSmart,
        rules: parseJson<SmartRules>(r.rules),
        sortBy: (r.sortBy as SortKey | null) ?? undefined,
        sortDir: (r.sortDir as SortDir | null) ?? undefined,
        limitCount: r.limitCount ?? undefined,
        trackIds: byPlaylist.get(r.id) ?? [],
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        deleted: !!r.deleted,
    }));
}

export function getDeletedPlaylistIds(): { id: string; updatedAt: number }[] {
    initDatabase();
    return db.getAllSync("SELECT id, updatedAt FROM playlists WHERE deleted = 1");
}

export function savePlaylist(p: Playlist, options: { deleted?: boolean } = {}) {
    initDatabase();
    db.withTransactionSync(() => {
        db.runSync(
            `INSERT OR REPLACE INTO playlists (id, name, isSmart, rules, sortBy, sortDir, limitCount, createdAt, updatedAt, deleted)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            p.id,
            p.name,
            p.isSmart ? 1 : 0,
            p.rules ? JSON.stringify(p.rules) : null,
            p.sortBy ?? null,
            p.sortDir ?? null,
            p.limitCount ?? null,
            p.createdAt,
            p.updatedAt,
            options.deleted ? 1 : 0
        );
        db.runSync("DELETE FROM playlist_tracks WHERE playlistId = ?", p.id);
        p.trackIds.forEach((assetId, position) =>
            db.runSync(
                "INSERT OR IGNORE INTO playlist_tracks (playlistId, assetId, position) VALUES (?, ?, ?)",
                p.id,
                assetId,
                position
            )
        );
    });
}

/** Soft delete so the deletion can be synchronised to other devices. */
export function markPlaylistDeleted(id: string) {
    initDatabase();
    db.withTransactionSync(() => {
        db.runSync("UPDATE playlists SET deleted = 1, updatedAt = ? WHERE id = ?", Date.now(), id);
        db.runSync("DELETE FROM playlist_tracks WHERE playlistId = ?", id);
    });
}

// ── Listening history ──────────────────────────────────────────────────────

export function insertListen(assetId: string, startedAt: number, durationMs: number): number {
    initDatabase();
    return db.runSync(
        "INSERT INTO listens (assetId, startedAt, durationMs) VALUES (?, ?, ?)",
        assetId,
        startedAt,
        Math.round(durationMs)
    ).lastInsertRowId;
}

export function updateListenDuration(id: number, durationMs: number) {
    db.runSync("UPDATE listens SET durationMs = ? WHERE id = ?", Math.round(durationMs), id);
}

export function getRecentAssetIds(limit = 50): string[] {
    initDatabase();
    return db
        .getAllSync<{
            assetId: string;
        }>(
            `SELECT assetId, MAX(startedAt) AS last FROM listens GROUP BY assetId ORDER BY last DESC LIMIT ?`,
            limit
        )
        .map((r) => r.assetId);
}

export type ListenAggregate = { assetId: string; plays: number; totalMs: number };

export function getListenAggregates(since: number): ListenAggregate[] {
    initDatabase();
    return db.getAllSync<ListenAggregate>(
        `SELECT assetId, COUNT(*) AS plays, SUM(durationMs) AS totalMs
         FROM listens WHERE startedAt >= ? GROUP BY assetId`,
        since
    );
}

export function getDebugRows(limit = 100) {
    initDatabase();
    return db.getAllSync<Record<string, unknown>>("SELECT * FROM tracks LIMIT ?", limit);
}
