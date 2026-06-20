import { log } from "@/utils/logger";
import { openDatabaseSync } from "expo-sqlite";
import type { MusicTrack } from "./music";

// Open (or create) database
const db = openDatabaseSync("music_player.db");

export function initDatabase() {
    // Create table if it does not exist
    db.execSync(`
    CREATE TABLE IF NOT EXISTS tracks (
      assetId TEXT PRIMARY KEY NOT NULL,
      sourceUri TEXT NOT NULL,
      title TEXT,
      artist TEXT,
      album TEXT,
      artwork TEXT,
      duration REAL,
      genre TEXT,
      date TEXT,
      rating TEXT,
      analysis_source TEXT,
      tags TEXT,
      isAnalyzed INTEGER DEFAULT 0,
      color TEXT NOT NULL,
      modificationTime INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_tracks_analyzed ON tracks(isAnalyzed);
  `);
}

export function getCachedTracks(): MusicTrack[] {
    // time
    const startTime = Date.now();
    const tracks = db.getAllSync<{
        assetId: string;
        sourceUri: string;
        title: string;
        artist: string;
        color: string;
        duration: number;
        album?: string;
        artwork?: string;
        genre?: string;
        date?: string;
        rating?: number;
        analysis_source?: string;
        tags?: string;
        isAnalyzed?: number;
        modificationTime?: number;
    }>("SELECT * FROM tracks");
    const endTime = Date.now();
    log.debug(`SQLite: Fetching ${tracks.length} tracks took ${endTime - startTime} ms`);
    return tracks.map((track) => {
        let parsedTags: string[] | undefined;
        if (track.tags) {
            parsedTags = JSON.parse(track.tags) as string[];
        }
        return {
            ...track,
            tags: parsedTags,
            isAnalyzed: !!track.isAnalyzed,
            modificationTime: track.modificationTime,
        };
    });
}

export async function insertOrReplaceTracksAsync(tracks: MusicTrack[]) {
    if (tracks.length === 0) return;
    await db.withTransactionAsync(async () => {
        const statement = await db.prepareAsync(`
      INSERT OR REPLACE INTO tracks (assetId, sourceUri, title, artist, album, artwork, duration, genre, date, rating, analysis_source, tags, isAnalyzed, color, modificationTime)
      VALUES ($assetId, $sourceUri, $title, $artist, $album, $artwork, $duration, $genre, $date, $rating, $analysis_source, $tags, $isAnalyzed, $color, $modificationTime)
    `);

        try {
            for (const track of tracks) {
                await statement.executeAsync({
                    $assetId: track.assetId,
                    $sourceUri: track.sourceUri,
                    $title: track.title || null,
                    $artist: track.artist || null,
                    $album: track.album || null,
                    $artwork: track.artwork || null,
                    $duration: track.duration || null,
                    $genre: track.genre || null,
                    $date: track.date || null,
                    $rating: track.rating != null ? String(track.rating) : null,
                    $analysis_source: track.analysis_source || null,
                    $tags: track.tags ? JSON.stringify(track.tags) : null,
                    $isAnalyzed: track.isAnalyzed ? 1 : 0,
                    $color: track.color,
                    $modificationTime: track.modificationTime || 0,
                });
            }
        } finally {
            await statement.finalizeAsync();
        }
    });
}

export async function deleteTracksByIdAsync(assetIds: string[]) {
    if (assetIds.length === 0) return;
    await db.withTransactionAsync(async () => {
        const statement = await db.prepareAsync(`DELETE FROM tracks WHERE assetId = $assetId`);
        try {
            for (const id of assetIds) {
                await statement.executeAsync({ $assetId: id });
            }
        } finally {
            await statement.finalizeAsync();
        }
    });
}

export async function updateTrackAfterAnalysisInDbAsync(
    assetId: string,
    metadata: {
        title?: string;
        artist?: string;
        album?: string | null;
        artwork?: string | null;
        genre?: string | null;
        date?: string | null;
        rating?: number | null;
        analysis_source?: string | null;
        tags?: string[] | null;
    }
) {
    await db.withTransactionAsync(async () => {
        const statement = await db.prepareAsync(`
            UPDATE tracks
            SET title = $title,
                artist = $artist,
                album = COALESCE($album, album),
                artwork = COALESCE($artwork, artwork),
                genre = COALESCE($genre, genre),
                date = COALESCE($date, date),
                rating = COALESCE($rating, rating),
                analysis_source = COALESCE($analysis_source, analysis_source),
                tags = COALESCE($tags, tags),
                isAnalyzed = 1
            WHERE assetId = $assetId
        `);
        try {
            await statement.executeAsync({
                $title: metadata.title || null,
                $artist: metadata.artist || null,
                $album: metadata.album || null,
                $artwork: metadata.artwork || null,
                $genre: metadata.genre || null,
                $date: metadata.date || null,
                $rating: metadata.rating != null ? String(metadata.rating) : null,
                $analysis_source: metadata.analysis_source || null,
                $tags: metadata.tags ? JSON.stringify(metadata.tags) : null,
                $assetId: assetId,
            });
            log.debug(`Track ${assetId} metadata updated in DB (analysis complete)`);
        } catch (error) {
            log.error(`Error updating track metadata in DB:`, error);
        } finally {
            await statement.finalizeAsync();
        }
    });
}
