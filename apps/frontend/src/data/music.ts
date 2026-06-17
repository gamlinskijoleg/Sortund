import {
    Album,
    AssetField,
    MediaType,
    Query,
    requestPermissionsAsync,
} from "expo-media-library";
import { useEffect } from "react";
import { DeviceEventEmitter } from "react-native";
import { getArtwork, getMetadata } from "react-native-audio-metadata";
import {
    getCachedTracks,
    initDatabase,
    insertOrReplaceTracksAsync,
    deleteTracksByIdAsync,
} from "./db";
import { usePlayerStore } from "../store/usePlayerStore";
import { saveBase64ArtworkAsync } from "@/utils/file-utils";
import { log } from "@/utils/logger";

export type MusicTrack = {
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
    tags?: string[];
    isAnalyzed?: boolean;
    modificationTime?: number;
};

export type LibrarySectionKey = "favourites" | "playlists" | "recent";

export function createListenRoute(track: MusicTrack) {
    return {
        pathname: "/listen" as const,
        params: {
            assetId: track.assetId,
        },
    };
}

function colorFromName(value: string) {
    let hash = 0;

    for (let index = 0; index < value.length; index += 1) {
        hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
    }

    const hue = hash % 360;
    return `hsl(${hue} 52% 46%)`;
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

let isSyncingLibrary = false;

export async function syncMusicLibrary(
    limit: number,
    cachedTracks: MusicTrack[],
    onProgress: (newTracks: MusicTrack[], deletedIds: string[]) => void
) {
    if (isSyncingLibrary) {
        log.debug("⚡️ Синхронізація вже виконується. Пропуск...");
        return;
    }

    isSyncingLibrary = true;
    try {
        const permission = await requestPermissionsAsync(false, ["audio"]);

        if (!permission.granted) {
            log.error("❌ Доступ до аудіо файлів відхилено.");
            return;
        }

        const album = await Album.get("Music");

        if (!album) {
            log.error("❌ Альбом 'Music' не знайдено.");
            return;
        }

        // 1. Get all assets quickly
        let query = new Query()
            .album(album)
            .eq(AssetField.MEDIA_TYPE, MediaType.AUDIO);

        if (limit !== Infinity) {
            query = query.limit(limit);
        }

        const queryMedia = await query.exe();

        log.debug(
            `🎵 Знайдено треків в альбомі ${await album.getTitle()}: ${queryMedia.length}`
        );

        // 2. Identify new, modified, and deleted
        const cachedMap = new Map(cachedTracks.map((t) => [t.assetId, t]));
        const currentAssetIds = new Set<string>();

        const assetsToProcess = [];

        for (const asset of queryMedia) {
            const rawId = asset.id;
            const cleanId = rawId.includes("/")
                ? rawId.split("/").pop()!
                : rawId;
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

        // Handle deletions
        if (deletedIds.length > 0) {
            log.debug(`🗑 Видалення ${deletedIds.length} треків...`);
            await deleteTracksByIdAsync(deletedIds);
            onProgress([], deletedIds);
        }

        if (assetsToProcess.length === 0) {
            log.debug("⚡️ Немає нових або змінених треків для обробки.");
            return;
        }

        log.debug(
            `⏳ Обробка ${assetsToProcess.length} нових/змінених треків...`
        );

        // 3. Process in chunks
        const CHUNK_SIZE = 10;
        for (let i = 0; i < assetsToProcess.length; i += CHUNK_SIZE) {
            const chunk = assetsToProcess.slice(i, i + CHUNK_SIZE);
            const processedChunk: MusicTrack[] = [];

            await Promise.all(
                chunk.map(async ({ asset, cleanId, fileModTime }) => {
                    try {
                        const uri = await asset.getUri();
                        const filename = await asset.getFilename();
                        const fileExtension =
                            filename.split(".").pop() || "mp3";

                        let title: string | undefined = filename.replace(
                            `.${fileExtension}`,
                            ""
                        );
                        let artist: string | undefined = "Unknown Artist";
                        let albumName: string | undefined;
                        let artwork: string | undefined;
                        let duration: number | undefined = 0;

                        const cleanMetadataUri = decodeURIComponent(
                            uri
                        ).replace("file://", "");

                        const [metadata, fetchedArtwork] = await Promise.all([
                            getMetadata(cleanMetadataUri),
                            getArtwork(cleanMetadataUri),
                        ]);

                        title = metadata.title?.trim() || title;
                        artist = metadata.artist?.trim() || artist;
                        albumName = metadata.album?.trim();

                        let finalArtwork = fetchedArtwork || undefined;
                        if (finalArtwork && finalArtwork.startsWith("data:")) {
                            const localPath = await saveBase64ArtworkAsync(
                                finalArtwork,
                                cleanId
                            );
                            if (localPath) {
                                finalArtwork = localPath;
                            }
                        }
                        artwork = finalArtwork;
                        duration =
                            parseDurationToMs(metadata.duration) || undefined;

                        // Merge with existing metadata if analyzed
                        const existing = cachedMap.get(cleanId);
                        let newTrack: MusicTrack = {
                            assetId: cleanId,
                            sourceUri: uri,
                            title,
                            artist,
                            album: albumName,
                            artwork,
                            duration: duration || 0,
                            genre: undefined,
                            date: undefined,
                            rating: undefined,
                            analysis_source: undefined,
                            tags: undefined,
                            isAnalyzed: false,
                            color: colorFromName(filename),
                            modificationTime: fileModTime,
                        };

                        if (existing && existing.isAnalyzed) {
                            newTrack = {
                                ...newTrack,
                                title: existing.title,
                                artist: existing.artist,
                                album: existing.album,
                                artwork: existing.artwork,
                                genre: existing.genre,
                                date: existing.date,
                                rating: existing.rating,
                                tags: existing.tags,
                                analysis_source: existing.analysis_source,
                                isAnalyzed: existing.isAnalyzed,
                            };
                        }

                        processedChunk.push(newTrack);
                    } catch (error) {
                        log.error(
                            `❌ Помилка обробки треку ${cleanId}:`,
                            error
                        );
                    }
                })
            );

            if (processedChunk.length > 0) {
                await insertOrReplaceTracksAsync(processedChunk);
                onProgress(processedChunk, []);
            }
        }

        log.debug("✅ Синхронізація бібліотеки завершена.");
    } finally {
        isSyncingLibrary = false;
    }
}

export function useMusicLibrary(limit = 6) {
    useEffect(() => {
        let isActive = true;
        let syncTimeout: NodeJS.Timeout;

        async function initAndSync() {
            const store = usePlayerStore.getState();
            if (store.hasSynced) return;

            // Запобігаємо повторному запуску в межах сесії
            store.setHasSynced(true);

            let cached = store.libraryTracks;

            try {
                if (cached.length === 0) {
                    // 1. Ініціалізуємо БД
                    initDatabase();

                    // 2. Миттєво беремо локальний кеш з SQLite
                    cached = getCachedTracks();
                    if (isActive) {
                        store.setLibraryTracks(cached);
                        if (cached.length > 0) {
                            store.setLibraryLoading(false);
                        }
                    }
                }

                // 3. Запускаємо фоновий скан з затримкою
                syncTimeout = setTimeout(async () => {
                    try {
                        await syncMusicLibrary(
                            limit,
                            cached,
                            (newOrModifiedTracks, deletedIds) => {
                                if (!isActive) return;

                                // Оновлюємо глобальний стан
                                const currentStore = usePlayerStore.getState();
                                let next = [...currentStore.libraryTracks];

                                // Remove deleted
                                if (deletedIds.length > 0) {
                                    const deletedSet = new Set(deletedIds);
                                    next = next.filter(
                                        (t) => !deletedSet.has(t.assetId)
                                    );
                                }

                                // Update or Add new
                                if (newOrModifiedTracks.length > 0) {
                                    const newMap = new Map(
                                        newOrModifiedTracks.map((t) => [
                                            t.assetId,
                                            t,
                                        ])
                                    );
                                    // Update existing in-place
                                    next = next.map((t) =>
                                        newMap.has(t.assetId)
                                            ? newMap.get(t.assetId)!
                                            : t
                                    );
                                    // Append purely new ones
                                    const existingIds = new Set(
                                        next.map((t) => t.assetId)
                                    );
                                    const purelyNew =
                                        newOrModifiedTracks.filter(
                                            (t) => !existingIds.has(t.assetId)
                                        );
                                    next = [...next, ...purelyNew];
                                }

                                currentStore.setLibraryTracks(next);
                                currentStore.setLibraryLoading(false);
                            }
                        );
                    } catch (syncError) {
                        log.error(
                            "Помилка під час syncMusicLibrary:",
                            syncError
                        );
                    } finally {
                        if (isActive)
                            usePlayerStore.getState().setLibraryLoading(false);
                    }
                }, 500); // 500ms delay debounce
            } catch (err) {
                log.error("Помилка ініціалізації бази треків:", err);
                if (isActive) {
                    usePlayerStore.getState().setLibraryLoading(false);
                }
            }
        }

        initAndSync();

        const sub = DeviceEventEmitter.addListener(
            "track_updated",
            (updatedTrack: Partial<MusicTrack> & { assetId: string }) => {
                const currentStore = usePlayerStore.getState();
                currentStore.setLibraryTracks(
                    currentStore.libraryTracks.map((t) =>
                        t.assetId === updatedTrack.assetId
                            ? { ...t, ...updatedTrack }
                            : t
                    )
                );
            }
        );

        return () => {
            isActive = false;
            clearTimeout(syncTimeout);
            sub.remove();
        };
    }, [limit]);
}

export const featureCards = [
    {
        title: "Favourites",
        color: "#a53a67",
        href: "/library/favourites" as const,
    },
    {
        title: "Playlists",
        color: "#3d748d",
        href: "/library/playlists" as const,
    },
    { title: "Recent", color: "#5b4db3", href: "/library/recent" as const },
];

export const librarySectionCopy: Record<
    LibrarySectionKey,
    { title: string; subtitle: string }
> = {
    favourites: {
        title: "Favourites",
        subtitle: "Tracks you starred most recently.",
    },
    playlists: {
        title: "Playlists",
        subtitle: "Your saved queues and mixes.",
    },
    recent: {
        title: "Recent",
        subtitle: "What you opened most recently.",
    },
};
