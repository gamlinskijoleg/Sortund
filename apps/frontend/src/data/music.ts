import { Directory, File, Paths } from "expo-file-system";
import { MediaType, requestPermissionsAsync } from "expo-media-library";
import { getAssetsAsync } from "expo-media-library/legacy";
import { useEffect, useState } from "react";
import { getArtwork, getMetadata } from "react-native-audio-metadata";

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

    // Оскільки .info() та .create() тепер синхронні/асинхронні в експо,
    // краще зробити безпечну перевірку
    try {
        const dirInfo = cacheDir.info();
        if (!dirInfo.exists) {
            cacheDir.create();
        }
    } catch (e) {
        // Якщо раптом нова лібка капризує на синхронному виклику
        console.log("Папка кешу вже існує або ініційована");
    }

    const tracks: MusicTrack[] = [];

    // Використовуємо звичайний цикл замість Promise.all для безпечного логування
    // та захисту від "впав один — впали всі"
    for (const asset of media.assets) {
        try {
            // БЕЗПЕЧНА НАЗВА: використовуємо id треку + розширення
            // Це повністю вирішує проблему з "Illegal character in path" через [ ], %20 або кирилицю
            const fileExtension = asset.filename.split(".").pop() || "mp3";
            const safeFileName = `${asset.id}.${fileExtension}`;
            const cachedFile = new File(cacheDir, safeFileName);

            let title = asset.filename.replace(`.${fileExtension}`, "");
            let artist = "Unknown Artist";
            let albumTitle: string | undefined;
            let artworkUrl: string | undefined;
            let duration = asset.duration ?? 0;

            // Очищаємо URI для зчитування метаданих
            const cleanMetadataUri = decodeURIComponent(asset.uri).replace(
                "file://",
                ""
            );

            // Зчитуємо метадані
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
            } catch (metadataError) {
                console.log(
                    `⚠️ Не вдалося зчитати теги для ${asset.filename}, беремо дефолтні`
                );
            }

            // Перевіряємо кеш за безпечним ім'ям
            const checkCache = cachedFile.info();

            if (!checkCache.exists) {
                console.log(
                    `⏳ Кешуємо файл: ${safeFileName} (${asset.filename})...`
                );

                // 1. Повністю декодуємо оригінальний URI до чистого тексту,
                // щоб прибрати кашу, якщо якісь символи вже були частково закодовані
                const cleanRawPath = decodeURIComponent(asset.uri);

                // 2. Кодуємо шлях за стандартами URI, але повертаємо слеші '/' та двокрапку ':',
                // щоб операційна система розуміла структуру папок
                const androidSafeUri = encodeURIComponent(cleanRawPath)
                    .replace(/%2F/g, "/")
                    .replace(/%3A/g, ":");

                // Тепер цей URI на 100% валідний для Java під капотом Expo!
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
            // Якщо один трек зламався — ми його просто пропускаємо, додаток працює далі!
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

        loadMusicTracks(limit)
            .then((tracks) => {
                console.log("✅ Треки успішно підготовлені під file:// ");
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
