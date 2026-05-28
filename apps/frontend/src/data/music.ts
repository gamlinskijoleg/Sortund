import { Directory, File, Paths } from "expo-file-system";
import { MediaType, requestPermissionsAsync } from "expo-media-library";
import { getAssetsAsync } from "expo-media-library/legacy";
import { useEffect, useState } from "react";
import { getArtwork, getMetadata } from "react-native-audio-metadata";
import { getCachedTracks, initDatabase, saveTracksToDb } from "./db";

export type MusicTrack = {
    title: string;
    artist: string;
    albumTitle?: string;
    artworkUrl?: string;
    color: string;
    sourceUri: string;
    duration: number;
    assetId?: string;
};

export type MusicSection = {
    href: "/" | "/videos" | "/artists" | "/albums";
    label: string;
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

export async function loadMusicTracks(limit: number): Promise<MusicTrack[]> {
    const permission = await requestPermissionsAsync(false, ["audio"]);

    if (!permission.granted) {
        console.log("❌ Доступ до аудіо файлів відхилено.");
        return [];
    }

    const media = await getAssetsAsync({
        mediaType: MediaType.AUDIO,
        first: limit,
    });

    console.log(`🎵 Знайдено треків у системі: ${media.assets.length}`);

    const cacheDir = new Directory(Paths.cache, "subdirName");

    try {
        const dirInfo = cacheDir.info();
        if (!dirInfo.exists) {
            cacheDir.create();
        }
    } catch {
        // ESLint Фікс: Просто прибрали (e), бо помилка не використовується
        console.log("Папка кешу вже існує або ініційована");
    }

    const tracks: MusicTrack[] = [];

    for (const asset of media.assets) {
        try {
            const fileExtension = asset.filename.split(".").pop() || "mp3";
            const safeFileName = `${asset.id}.${fileExtension}`;
            const cachedFile = new File(cacheDir, safeFileName);

            let title = asset.filename.replace(`.${fileExtension}`, "");
            let artist = "Unknown Artist";
            let albumTitle: string | undefined;
            let artworkUrl: string | undefined;
            let duration = asset.duration ?? 0;

            const cleanMetadataUri = decodeURIComponent(asset.uri).replace(
                "file://",
                ""
            );

            try {
                const [metadata, artwork] = await Promise.all([
                    getMetadata(cleanMetadataUri),
                    getArtwork(cleanMetadataUri),
                ]);

                title = metadata.title?.trim() || title;
                artist = metadata.artist?.trim() || artist;
                albumTitle = metadata.album?.trim() || undefined;
                if (metadata.duration) duration = metadata.duration;
                artworkUrl = artwork || undefined;
            } catch {
                // ESLint Фікс: Прибрали (metadataError)
                console.log(
                    `⚠️ Не вдалося зчитати теги для ${asset.filename}, беремо дефолтні`
                );
            }

            const checkCache = cachedFile.info();

            if (!checkCache.exists) {
                console.log(
                    `⏳ Кешуємо файл: ${safeFileName} (${asset.filename})...`
                );

                const cleanRawPath = decodeURIComponent(asset.uri);

                const androidSafeUri = encodeURIComponent(cleanRawPath)
                    .replace(/%2F/g, "/")
                    .replace(/%3A/g, ":");

                const sourceFile = new File(androidSafeUri);

                await sourceFile.copy(cachedFile);
                console.log(`✅ Скопійовано трек ${asset.id}`);
            }

            tracks.push({
                assetId: asset.id,
                sourceUri: cachedFile.uri,
                title,
                artist,
                albumTitle,
                artworkUrl,
                duration,
                color: colorFromName(asset.filename),
            });
        } catch (trackError) {
            console.error(
                `❌ Помилка обробки треку ${asset.filename}:`,
                trackError
            );
        }
    }

    return tracks;
}

export function useMusicTracks(limit = Infinity) {
    const [tracks, setTracks] = useState<MusicTrack[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isActive = true;

        async function syncTracks() {
            // TS Фікс: Оголошуємо змінну тут, щоб вона була доступна і в try, і в catch
            let cached: MusicTrack[] = [];

            try {
                // 1. Ініціалізуємо БД
                initDatabase();

                // 2. Миттєво беремо локальний кеш з SQLite
                cached = getCachedTracks();
                if (cached.length > 0 && isActive) {
                    setTracks(cached);
                    setIsLoading(false);
                }

                // 3. Запускаємо фоновий важкий скан файлів
                const freshTracks = await loadMusicTracks(limit);

                if (!isActive) return;

                // 4. Оновлюємо UI та БД тільки якщо щось змінилося
                if (freshTracks.length !== cached.length) {
                    console.log(
                        "🔄 Змінилася кількість треків. Оновлюємо базу даних..."
                    );
                    saveTracksToDb(freshTracks);
                    setTracks(freshTracks);
                } else {
                    console.log(
                        "⚡️ Кількість треків не змінилася. Скан пропущено, взято кеш SQLite."
                    );
                }
            } catch (err) {
                console.error("Помилка синхронізації треків:", err);
                // Тепер тут cached доступна і помилки не буде!
                if (cached.length === 0) {
                    setError("Не вдалося завантажити музику.");
                }
            } finally {
                if (isActive) setIsLoading(false);
            }
        }

        syncTracks();

        return () => {
            isActive = false;
        };
    }, [limit]);

    return { tracks, isLoading, error };
}

export const musicSections: MusicSection[] = [
    { href: "/", label: "Songs" },
    { href: "/videos", label: "Videos" },
    { href: "/artists", label: "Artists" },
    { href: "/albums", label: "Albums" },
];

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

export const searchSuggestions = [
    "Search songs, playlists, and artists",
    "Find albums, videos, and saved mixes",
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
