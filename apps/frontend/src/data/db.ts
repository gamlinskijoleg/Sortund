import { log } from "@/utils/logger";
import * as SQLite from "expo-sqlite";
import type { MusicTrack } from "./music";

// Відкриваємо (або створюємо) базу даних
const db = SQLite.openDatabaseSync("music_player.db");

export function initDatabase() {
    // Створюємо таблицю, якщо її ще немає
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
      color TEXT NOT NULL
    );
  `);
}

export function getCachedTracks(): MusicTrack[] {
    // time
    const startTime = Date.now();
    const tracks = db.getAllSync("SELECT * FROM tracks") as any[];
    const endTime = Date.now();
    log.debug(
        `SQLite: Витягування ${tracks.length} треків зайняло ${endTime - startTime} ms`
    );
    return tracks.map((track) => ({
        ...track,
        tags: track.tags ? JSON.parse(track.tags) : undefined,
        isAnalyzed: !!track.isAnalyzed,
    }));
}

export function saveTracksToDb(tracks: MusicTrack[]) {
    // Очищаємо стару базу та записуємо свіжі дані в одній транзакції (це супер-швидко)
    db.withTransactionSync(() => {
        db.execSync("DELETE FROM tracks");

        const statement = db.prepareSync(`
      INSERT INTO tracks (assetId, sourceUri, title, artist, album, artwork, duration, genre, date, rating, analysis_source, tags, isAnalyzed, color)
      VALUES ($assetId, $sourceUri, $title, $artist, $album, $artwork, $duration, $genre, $date, $rating, $analysis_source, $tags, $isAnalyzed, $color)
    `);

        try {
            for (const track of tracks) {
                statement.executeSync({
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
                });
            }
        } finally {
            statement.finalizeSync();
        }
    });
}

export function updateTrackAfterAnalysisInDb(
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
    db.withTransactionSync(() => {
        const statement = db.prepareSync(`
            UPDATE tracks
            SET title = $title,
                artist = $artist,
                album = COALESCE(album, $album),
                artwork = COALESCE(artwork, $artwork),
                genre = COALESCE(genre, $genre),
                date = COALESCE(date, $date),
                rating = COALESCE(rating, $rating),
                analysis_source = COALESCE(analysis_source, $analysis_source),
                tags = COALESCE(tags, $tags),
                isAnalyzed = 1
            WHERE assetId = $assetId
        `);
        try {
            statement.executeSync({
                $title: metadata.title || null,
                $artist: metadata.artist || null,
                $album: metadata.album || null,
                $artwork: metadata.artwork || null,
                $genre: metadata.genre || null,
                $date: metadata.date || null,
                $rating:
                    metadata.rating != null ? String(metadata.rating) : null,
                $analysis_source: metadata.analysis_source || null,
                $tags: metadata.tags ? JSON.stringify(metadata.tags) : null,
                $assetId: assetId,
            });
            log.debug(
                `✅ Track ${assetId} metadata updated in DB (analysis complete)`
            );
        } catch (error) {
            log.error(`❌ Error updating track metadata in DB:`, error);
        } finally {
            statement.finalizeSync();
        }
    });
}
