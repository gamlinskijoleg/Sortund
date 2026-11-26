import type { MusicTrack, TagDetail } from "../data/types";

export function trackYear(track: Pick<MusicTrack, "year" | "date">): number | undefined {
    if (track.year && Number.isFinite(track.year)) return track.year;
    const match = track.date ? /(\d{4})/.exec(track.date) : null;
    return match ? Number(match[1]) : undefined;
}

export function decadeOf(year: number | undefined): string | undefined {
    if (!year) return undefined;
    return `${Math.floor(year / 10) * 10}s`;
}

/** AI tags minus the ones the user removed, plus the user's own tags (deduplicated, case-insensitive). */
export function effectiveTags(
    tagDetails: TagDetail[] | undefined,
    userTags: string[] | undefined,
    removedTags: string[] | undefined
): string[] {
    const removed = new Set((removedTags ?? []).map((t) => t.toLowerCase()));
    const seen = new Set<string>();
    const result: string[] = [];
    for (const label of [...(tagDetails ?? []).map((t) => t.label), ...(userTags ?? [])]) {
        const key = label.toLowerCase();
        if (removed.has(key) || seen.has(key)) continue;
        seen.add(key);
        result.push(label);
    }
    return result;
}

function normalize(value: string | undefined): string {
    return (value ?? "")
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim();
}

/**
 * Key used to match a track across devices: the acoustic fingerprint when the track was analysed,
 * otherwise normalised "artist|title".
 */
export function syncKey(track: Pick<MusicTrack, "fingerprint" | "artist" | "title">): string {
    if (track.fingerprint) return track.fingerprint;
    return `meta:${normalize(track.artist)}|${normalize(track.title)}`;
}

export function formatDuration(ms: number | undefined): string {
    const total = Math.max(0, Math.floor((ms ?? 0) / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h > 0
        ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
        : `${m}:${String(s).padStart(2, "0")}`;
}

export function formatListeningTime(
    ms: number,
    units: { h: string; min: string } = { h: "h", min: "min" }
): string {
    const minutes = Math.round(ms / 60000);
    if (minutes < 60) return `${minutes} ${units.min}`;
    const hours = Math.floor(minutes / 60);
    return `${hours} ${units.h} ${minutes % 60} ${units.min}`;
}
