import { useEffect, useState } from "react";
import {
    AssetField,
    MediaType,
    Query,
    requestPermissionsAsync,
    Asset,
} from "expo-media-library";
import { getMetadata } from "react-native-audio-metadata";

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
    return {
        pathname: "/listen" as const,
        params: {
            assetId: track.assetId,
            sourceUri: encodeURIComponent(track.sourceUri),
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

export async function loadMusicTracks(limit = 50): Promise<MusicTrack[]> {
    const permission = await requestPermissionsAsync(false, ["audio"]);

    if (!permission.granted) {
        return [];
    }

    const assets = await new Query()
        .eq(AssetField.MEDIA_TYPE, MediaType.AUDIO)
        .orderBy(AssetField.CREATION_TIME)
        .limit(limit)
        .exe();

    console.log("Loaded music assets:", assets.length);

    const tracks = await Promise.all(
        assets.map(async (asset: Asset, index: number) => {
            const uri = await asset.getUri();

            const cleanPath = decodeURIComponent(uri).replace(/^file:\/\//, "");
            const metadata = await getMetadata(decodeURI(cleanPath)).catch(
                (error) => {
                    console.error("Error reading metadata for", {
                        uri,
                        error,
                    });
                    return null;
                }
            );

            if (!metadata?.title) {
                console.warn("Missing title metadata for", { uri, metadata });
            }

            return {
                sourceUri: uri,
                assetId: asset.id,
                title: metadata?.title ?? decodeURI(uri).split("/").pop()!,
                artist: metadata?.artist ?? "Unknown artist",
                duration: metadata?.duration ?? null,
                color: colorFromName(metadata?.title ?? `Track ${index + 1}`),
            } satisfies MusicTrack;
        })
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
