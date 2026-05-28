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
    const encodedUri = encodeURIComponent(track.sourceUri);

    return {
        pathname: "/listen" as const,
        params: {
            assetId: track.assetId,
            sourceUri: encodedUri,
            title: track.title,
            artist: track.artist,
            albumTitle: track.albumTitle,
            duration: track.duration?.toString(),
            color: track.color,
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

    const dirInfo = await cacheDir.info();
    if (!dirInfo.exists) {
        await cacheDir.create();
    }

    const filesToDiagnostic: File[] = [];

    const tracks = await Promise.all(
        media.assets.map(async (asset) => {
            const fileName = decodeURI(asset.filename);
            const cachedFile = new File(cacheDir, fileName);

            let title = asset.filename;
            let artist = "Unknown Artist";
            let albumTitle: string | undefined;
            let artworkUrl: string | undefined;
            let duration: number;

            const cleanMetadataUri = asset.uri.replace("file://", "");

            const [metadata, artwork] = await Promise.all([
                getMetadata(cleanMetadataUri),
                getArtwork(cleanMetadataUri),
            ]);

            title = metadata.title?.trim() || title;
            artist = metadata.artist?.trim() || artist;
            albumTitle = metadata.album?.trim() || undefined;
            duration = metadata.duration ?? 0;
            artworkUrl = artwork || undefined;

            // 2. Тепер розбираємось із кешуванням для безперебійного плеєра
            const checkCache = cachedFile.info();

            if (!checkCache.exists) {
                console.log(`⏳ Нове API: Кешуємо файл ${asset.filename}...`);
                const sourceFile = new File(asset.uri);
                await sourceFile.copy(cachedFile);
                console.log(`✅ Скопійовано трек ${asset.id}`);
            }

            filesToDiagnostic.push(cachedFile);

            return {
                assetId: asset.id,
                sourceUri: cachedFile.uri,
                title,
                artist,
                albumTitle,
                artworkUrl,
                duration,
                color: colorFromName(asset.filename),
            };
        })
    );

    return tracks;
}

export function useMusicTracks(limit = 5) {
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
