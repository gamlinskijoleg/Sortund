import { Album, AssetField, MediaType, Query, requestPermissionsAsync } from "expo-media-library";
import { useEffect } from "react";
import { getArtwork, getMetadata } from "react-native-audio-metadata";
import {
    getCachedTracks,
    initDatabase,
    upsertScannedTracksAsync,
    deleteTracksByIdAsync,
} from "./db";
import { usePlayerStore } from "../store/usePlayerStore";
import { saveBase64ArtworkAsync } from "@/utils/file-utils";
import { log } from "@/utils/logger";
import type { MusicTrack } from "./types";

export type { MusicTrack } from "./types";

export type LibrarySectionKey = "favourites" | "playlists" | "recent";

/** Formats supported by the scanner and the analysis service (REQ 10). */
export const SUPPORTED_EXTENSIONS = ["mp3", "m4a", "wav", "ogg", "flac"];

export function createListenRoute(track: MusicTrack) {
    return { pathname: "/listen" as const, params: { assetId: track.assetId } };
}

export function colorFromName(value: string) {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
        hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
    }
    return `hsl(${hash % 360} 52% 46%)`;
}

function parseDurationToMs(value: unknown): number | null {
    if (value == null) return null;
    const numeric =
        typeof value === "number"
            ? value
            : typeof value === "string"
              ? Number.parseFloat(value)
              : Number.NaN;
    if (!Number.isFinite(numeric) || numeric <= 0) return null;
    // Some metadata providers return seconds, others milliseconds.
    return numeric < 1000 ? Math.round(numeric * 1000) : Math.round(numeric);
}

/** Reloads the in-memory library from SQLite (call after any database change). */
export function refreshLibrary() {
    usePlayerStore.getState().setLibraryTracks(getCachedTracks());
}

let isSyncingLibrary = false;

/**
 * Scans the device's Music album (REQ 9–12). Only new and modified files are read again;
 * records of deleted files are removed.
 */
export async function syncMusicLibrary(
    limit: number,
    cachedTracks: MusicTrack[],
    onProgress: () => void
) {
    if (isSyncingLibrary) {
        log.debug("Synchronization is already running. Skipping...");
        return;
    }
    isSyncingLibrary = true;
    try {
        const permission = await requestPermissionsAsync(false, ["audio"]);
        if (!permission.granted) {
            log.error("Access to audio files denied.");
            return;
        }

        const album = await Album.get("Music");
        if (!album) {
            log.error("Album 'Music' not found.");
            return;
        }

        let query = new Query().album(album).eq(AssetField.MEDIA_TYPE, MediaType.AUDIO);
        if (limit !== Infinity) query = query.limit(limit);
        const queryMedia = await query.exe();
        log.debug(`Found tracks in album ${await album.getTitle()}: ${queryMedia.length}`);

        const cachedMap = new Map(cachedTracks.map((t) => [t.assetId, t]));
        const currentAssetIds = new Set<string>();
        const assetsToProcess = [];

        for (const asset of queryMedia) {
            const rawId = asset.id;
            const cleanId = rawId.includes("/") ? rawId.split("/").pop()! : rawId;
            currentAssetIds.add(cleanId);
            const cached = cachedMap.get(cleanId);
            const fileModTime = (await asset.getModificationTime()) || 0;
            if (!cached || (cached.modificationTime || 0) < fileModTime) {
                assetsToProcess.push({ asset, cleanId, fileModTime });
            }
        }

        const deletedIds = cachedTracks
            .map((t) => t.assetId)
            .filter((id) => !currentAssetIds.has(id));
        if (deletedIds.length > 0) {
            log.debug(`Deleting ${deletedIds.length} tracks...`);
            await deleteTracksByIdAsync(deletedIds);
            onProgress();
        }

        if (assetsToProcess.length === 0) {
            log.debug("No new or modified tracks to process.");
            return;
        }
        log.debug(`Processing ${assetsToProcess.length} new/modified tracks...`);

        const CHUNK_SIZE = 10;
        for (let i = 0; i < assetsToProcess.length; i += CHUNK_SIZE) {
            const chunk = assetsToProcess.slice(i, i + CHUNK_SIZE);
            const processedChunk: MusicTrack[] = [];

            await Promise.all(
                chunk.map(async ({ asset, cleanId, fileModTime }) => {
                    try {
                        const uri = await asset.getUri();
                        const filename = await asset.getFilename();
                        const fileExtension = (filename.split(".").pop() || "mp3").toLowerCase();
                        if (!SUPPORTED_EXTENSIONS.includes(fileExtension)) return;

                        const cleanMetadataUri = decodeURIComponent(uri).replace("file://", "");
                        const [metadata, fetchedArtwork] = await Promise.all([
                            getMetadata(cleanMetadataUri),
                            getArtwork(cleanMetadataUri),
                        ]);

                        let artwork = fetchedArtwork || undefined;
                        if (artwork && artwork.startsWith("data:")) {
                            artwork = saveBase64ArtworkAsync(artwork, cleanId) ?? undefined;
                        }

                        processedChunk.push({
                            assetId: cleanId,
                            sourceUri: uri,
                            filename,
                            // Without tags the title is taken from the file name (REQ 11).
                            title: metadata.title?.trim() || filename.replace(/\.[^.]+$/, ""),
                            artist: metadata.artist?.trim() || "Unknown Artist",
                            album: metadata.album?.trim() || undefined,
                            artwork,
                            duration: parseDurationToMs(metadata.duration) || 0,
                            color: colorFromName(filename),
                            modificationTime: fileModTime,
                        });
                    } catch (error) {
                        log.error(`Error processing track ${cleanId}:`, error);
                    }
                })
            );

            if (processedChunk.length > 0) {
                await upsertScannedTracksAsync(processedChunk);
                onProgress();
            }
        }
        log.debug("Library synchronization completed.");
    } finally {
        isSyncingLibrary = false;
    }
}

/** Loads the cached library instantly, then rescans the device in the background. */
export function startLibrarySync(limit = Infinity, force = false) {
    const store = usePlayerStore.getState();
    if (store.hasSynced && !force) return;
    store.setHasSynced(true);

    try {
        initDatabase();
        const cached = getCachedTracks();
        store.setLibraryTracks(cached);
        if (cached.length > 0) store.setLibraryLoading(false);

        setTimeout(() => {
            void (async () => {
                try {
                    await syncMusicLibrary(limit, cached, () => {
                        refreshLibrary();
                        usePlayerStore.getState().setLibraryLoading(false);
                    });
                } catch (syncError) {
                    log.error("Error during syncMusicLibrary:", syncError);
                } finally {
                    usePlayerStore.getState().setLibraryLoading(false);
                }
            })();
        }, 500);
    } catch (err) {
        log.error("Error initializing tracks database:", err);
        store.setLibraryLoading(false);
    }
}

export function useMusicLibrary(limit = Infinity) {
    useEffect(() => {
        startLibrarySync(limit);
    }, [limit]);
}
