import { useEffect, useState } from "react";
import {
    AssetField,
    MediaType,
    Query,
    requestPermissionsAsync,
    Asset,
} from "expo-media-library";

export type MusicTrack = {
    title: string;
    artist: string;
    color: string;
    sourceUri?: string;
    duration?: number;
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
            sourceUri: encodeURIComponent(track.sourceUri ?? ""),
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

function stripExtension(value: string) {
    return value.replace(/\.[^.]+$/, "");
}

function formatDuration(durationMs: number) {
    const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export async function loadMusicTracks(limit = 50): Promise<MusicTrack[]> {
    const permission = await requestPermissionsAsync(false, ["audio"]);

    if (!permission.granted) {
        return [];
    }

    // Use the modern Query class-based API
    const assets = await new Query()
        .eq(AssetField.MEDIA_TYPE, MediaType.AUDIO)
        .orderBy(AssetField.CREATION_TIME)
        .limit(limit)
        .exe();

    const tracks = await Promise.all(
        assets.map(async (asset: Asset, index: number) => {
            // Fetch data using the async getters
            const [duration, uri, filename] = await Promise.all([
                asset.getDuration(),
                asset.getUri(),
                asset.getFilename(),
            ]);

            const title =
                stripExtension(filename ?? "") || `Track ${index + 1}`;
            const durationMs = duration ?? 0;

            // Gracefully handle the null duration
            const artist =
                durationMs > 0
                    ? `Local audio file · ${formatDuration(durationMs)}`
                    : "Local audio file";

            return {
                title,
                artist:
                    durationMs > 0
                        ? `Local audio file · ${formatDuration(durationMs)}`
                        : "Local audio file",
                color: colorFromName(filename ?? asset.id),
                sourceUri: uri ?? undefined,
                // If duration is 0, let it be undefined.
                // Your UI should check: if (track.duration) { showTime() }
                duration: durationMs > 0 ? durationMs : undefined,
            } satisfies MusicTrack;
        }),
    );

    return tracks;
}
export function useMusicTracks(limit = 50) {
    const [tracks, setTracks] = useState<MusicTrack[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isActive = true;

        loadMusicTracks(limit)
            .then((nextTracks) => {
                if (!isActive) {
                    return;
                }

                setTracks(nextTracks);
                setError(null);
            })
            .catch((loadError: unknown) => {
                if (!isActive) {
                    return;
                }

                setTracks([]);
                setError(
                    loadError instanceof Error
                        ? loadError.message
                        : "Unable to load local music files.",
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
