import { Directory, File, Paths } from "expo-file-system";
import { MediaType, requestPermissionsAsync } from "expo-media-library";
import { getAssetsAsync } from "expo-media-library/legacy";
import { useEffect, useState } from "react";

export type MusicTrack = {
    title: string;
    artist: string;
    color: string;
    sourceUri: string;
    duration: number | null;
    assetId?: string;
};

export type MusicSection = {
    href: "/" | "/videos" | "/artists" | "/albums";
    label: string;
};

export type LibrarySectionKey = "favourites" | "playlists" | "recent";

export function createListenRoute(track: MusicTrack) {
    const encodedUri = encodeURIComponent(track.sourceUri);

    console.log("=== ДІАГНОСТИКА МАРШРУТУ ===");
    console.log("Оригінальний URI для передачі:", track.sourceUri);
    console.log("Закодований URI (encoded):", encodedUri);
    console.log("============================");

    return {
        pathname: "/listen" as const,
        params: {
            assetId: track.assetId,
            sourceUri: encodedUri,
            title: track.title,
            artist: track.artist,
            color: track.color,
        },
    };
}

function hashString(value: string) {
    let hash = 0;

    for (let index = 0; index < value.length; index += 1) {
        hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
    }

    return hash;
}

function colorFromName(value: string) {
    const hue = hashString(value) % 360;
    return `hsl(${hue} 52% 46%)`;
}

// 1. Змінюємо функцію діагностики: тепер вона приймає безпосередньо об'єкт File
const checkAudioFile = async (fileTarget: File) => {
    try {
        console.log(`🔍 Перевіряємо через New API: ${fileTarget.uri}`);

        // Метод .info() викликається прямо на готовому об'єкті
        const fileMetadata = await fileTarget.info();

        if (fileMetadata && fileMetadata.exists) {
            console.log("✅ Успіх! Файл знайдено в кеші додатка.");
            console.log("📊 Розмір файла:", fileMetadata.size, "байт");
        } else {
            console.log("❌ Файл не знайдено в локальному кеші.");
        }
    } catch (e) {
        console.error("Помилка під час перевірки файла:", e);
    }
};

export async function loadMusicTracks(limit = 2): Promise<MusicTrack[]> {
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

    const dirInfo = await cacheDir.info();
    if (!dirInfo.exists) {
        await cacheDir.create();
    }

    // Створимо масив для збереження посилань на файли для діагностики
    const filesToDiagnostic: File[] = [];

    const tracks = await Promise.all(
        media.assets.map(async (asset) => {
            const fileName = `track_${asset.id}.mp3`;
            const cachedFile = new File(cacheDir, fileName);

            try {
                const checkCache = await cachedFile.info();

                if (!checkCache.exists) {
                    console.log(
                        `⏳ Нове API: Кешуємо файл ${asset.filename}...`
                    );
                    const sourceFile = new File(asset.uri);
                    await sourceFile.copy(cachedFile);
                    console.log(`✅ Скопійовано трек ${asset.id}`);
                }

                // Додаємо об'єкт у масив для подальшої перевірки
                filesToDiagnostic.push(cachedFile);
            } catch (copyError) {
                console.error(
                    `💥 Не вдалося скопіювати файл ${asset.filename}:`,
                    copyError
                );
            }

            // 1. ДІАГНОСТИКА: Що насправді лежить в cachedFile та asset.uri
            console.log("=== ДІАГНОСТИКА EXPO FILE-SYSTEM ===");
            console.log("Тип cachedFile:", typeof cachedFile);
            console.log("Значення cachedFile.uri:", cachedFile.uri);
            console.log("Тип cachedFile.uri:", typeof cachedFile.uri);
            console.log("Оригінальний asset.uri:", asset.uri);
            console.log("====================================");

            return {
                assetId: asset.id,
                sourceUri: cachedFile.uri, // Тут залишається правильний file:// шлях для TrackPlayer
                title: asset.filename,
                artist: "Unknown Artist",
                duration: asset.duration,
                color: colorFromName(asset.filename),
            };
        })
    );

    // 2. Викликаємо діагностику, передаючи інстанс класу File
    for (const fileInstance of filesToDiagnostic) {
        await checkAudioFile(fileInstance);
    }

    return tracks;
}

export function useMusicTracks(limit = 2) {
    const [tracks, setTracks] = useState<MusicTrack[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isActive = true;

        loadMusicTracks(limit)
            .then((tracks) => {
                console.log(
                    "✅ Треки успішно підготовлені під file:// через New API"
                );
                return tracks;
            })
            .then((nextTracks) => {
                if (!isActive) return;
                setTracks(nextTracks);
                setError(null);
            })
            .catch((loadError) => {
                if (!isActive) return;
                setTracks([]);
                console.error("Error loading music tracks:", loadError);
                setError(
                    loadError instanceof Error
                        ? loadError.message
                        : "Unable to load local music files."
                );
            })
            .finally(() => {
                if (isActive) {
                    setIsLoading(false);
                }
            });

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
