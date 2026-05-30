import { log } from "@/utils/logger";
import * as SQLite from "expo-sqlite";

// Відкриваємо (або створюємо) базу даних
const db = SQLite.openDatabaseSync("music_player.db");

export function initDatabase() {
    // Створюємо таблицю, якщо її ще немає
    db.execSync(`
    CREATE TABLE IF NOT EXISTS tracks (
      assetId TEXT PRIMARY KEY NOT NULL,
      sourceUri TEXT NOT NULL,
      title TEXT NOT NULL,
      artist TEXT NOT NULL,
      albumTitle TEXT,
      artworkUrl TEXT,
      duration REAL NOT NULL,
      color TEXT NOT NULL
    );
  `);
}

export function getCachedTracks(): any[] {
    // time
    const startTime = Date.now();
    const tracks = db.getAllSync("SELECT * FROM tracks");
    const endTime = Date.now();
    log.debug(
        `SQLite: Витягування ${tracks.length} треків зайняло ${endTime - startTime} ms`
    );
    return tracks;
}

export function saveTracksToDb(tracks: any[]) {
    // Очищаємо стару базу та записуємо свіжі дані в одній транзакції (це супер-швидко)
    db.withTransactionSync(() => {
        db.execSync("DELETE FROM tracks");

        const statement = db.prepareSync(`
      INSERT INTO tracks (assetId, sourceUri, title, artist, albumTitle, artworkUrl, duration, color)
      VALUES ($assetId, $sourceUri, $title, $artist, $albumTitle, $artworkUrl, $duration, $color)
    `);

        try {
            for (const track of tracks) {
                statement.executeSync({
                    $assetId: track.assetId,
                    $sourceUri: track.sourceUri,
                    $title: track.title,
                    $artist: track.artist,
                    $albumTitle: track.albumTitle || null,
                    $artworkUrl: track.artworkUrl || null,
                    $duration: track.duration,
                    $color: track.color,
                });
            }
        } finally {
            statement.finalizeSync();
        }
    });
}
