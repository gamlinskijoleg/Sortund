import type { ListenAggregate } from "../data/db";
import type { MusicTrack } from "../data/types";
import { decadeOf, trackYear } from "./track-utils";

export type Bucket = { label: string; value: number };

function top(map: Map<string, number>, limit: number): Bucket[] {
    return [...map.entries()]
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
        .slice(0, limit);
}

/** Distribution of the library by a property (REQ 61). Unanalysed tracks are counted separately. */
export function libraryDistribution(
    tracks: MusicTrack[],
    pick: (t: MusicTrack) => string | undefined,
    unknownLabel: string,
    limit = 8
): Bucket[] {
    const map = new Map<string, number>();
    for (const t of tracks) {
        const key = pick(t) ?? unknownLabel;
        map.set(key, (map.get(key) ?? 0) + 1);
    }
    return top(map, limit);
}

export const pickDecade = (t: MusicTrack) => decadeOf(trackYear(t));

export type ListeningSummary = {
    totalMs: number;
    plays: number;
    topTracks: { track: MusicTrack; plays: number; totalMs: number }[];
    topArtists: Bucket[];
    topGenres: Bucket[];
};

/** Listening statistics for a period (REQ 63); artists and genres are ranked by listening time. */
export function summarizeListening(
    aggregates: ListenAggregate[],
    tracks: MusicTrack[],
    limit = 5
): ListeningSummary {
    const byId = new Map(tracks.map((t) => [t.assetId, t]));
    const artists = new Map<string, number>();
    const genres = new Map<string, number>();
    let totalMs = 0;
    let plays = 0;
    const topTracks: ListeningSummary["topTracks"] = [];

    for (const a of aggregates) {
        totalMs += a.totalMs;
        plays += a.plays;
        const track = byId.get(a.assetId);
        if (!track) continue;
        topTracks.push({ track, plays: a.plays, totalMs: a.totalMs });
        artists.set(track.artist, (artists.get(track.artist) ?? 0) + a.totalMs);
        if (track.genre) genres.set(track.genre, (genres.get(track.genre) ?? 0) + a.totalMs);
    }

    topTracks.sort((x, y) => y.plays - x.plays || y.totalMs - x.totalMs);
    return {
        totalMs,
        plays,
        topTracks: topTracks.slice(0, limit),
        topArtists: top(artists, limit),
        topGenres: top(genres, limit),
    };
}

export function periodStart(period: "week" | "month" | "all", now = Date.now()): number {
    if (period === "week") return now - 7 * 86_400_000;
    if (period === "month") return now - 30 * 86_400_000;
    return 0;
}
