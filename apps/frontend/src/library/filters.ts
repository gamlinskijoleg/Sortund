import type { MusicTrack, SortDir, SortKey } from "../data/types";
import { trackYear } from "./track-utils";

export type LibraryFilters = {
    genres: string[];
    moods: string[];
    languages: string[];
    themes: string[];
    keys: string[];
    yearFrom?: number;
    yearTo?: number;
    bpmFrom?: number;
    bpmTo?: number;
};

export const emptyFilters: LibraryFilters = {
    genres: [],
    moods: [],
    languages: [],
    themes: [],
    keys: [],
};

export function activeFilterCount(f: LibraryFilters): number {
    return (
        f.genres.length +
        f.moods.length +
        f.languages.length +
        f.themes.length +
        f.keys.length +
        (f.yearFrom != null || f.yearTo != null ? 1 : 0) +
        (f.bpmFrom != null || f.bpmTo != null ? 1 : 0)
    );
}

const lower = (v: string | undefined) => (v ?? "").toLowerCase();

/** Full-text search over title, artist, album, genre, mood and tags (REQ 35). */
export function matchesQuery(track: MusicTrack, query: string): boolean {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return true;
    const haystack = [
        track.title,
        track.artist,
        track.album,
        track.genre,
        track.mood,
        ...(track.tags ?? []),
    ]
        .map(lower)
        .join("\n");
    return words.every((w) => haystack.includes(w));
}

function inSet(value: string | undefined, selected: string[]): boolean {
    if (selected.length === 0) return true;
    if (!value) return false;
    const v = value.toLowerCase();
    return selected.some((s) => s.toLowerCase() === v);
}

function anyInSet(values: string[] | undefined, selected: string[]): boolean {
    if (selected.length === 0) return true;
    return (values ?? []).some((v) => inSet(v, selected));
}

function inRange(value: number | undefined, from?: number, to?: number): boolean {
    if (from == null && to == null) return true;
    if (value == null) return false;
    return (from == null || value >= from) && (to == null || value <= to);
}

/** Combined filters: values inside one group are OR-ed, groups are AND-ed (REQ 36). */
export function applyFilters(tracks: MusicTrack[], f: LibraryFilters): MusicTrack[] {
    if (activeFilterCount(f) === 0) return tracks;
    return tracks.filter(
        (t) =>
            inSet(t.genre, f.genres) &&
            inSet(t.mood, f.moods) &&
            inSet(t.language, f.languages) &&
            anyInSet(t.themes, f.themes) &&
            inSet(t.musicalKey, f.keys) &&
            inRange(trackYear(t), f.yearFrom, f.yearTo) &&
            inRange(t.bpm, f.bpmFrom, f.bpmTo)
    );
}

function sortValue(track: MusicTrack, key: SortKey): string | number | undefined {
    switch (key) {
        case "title":
            return lower(track.title);
        case "artist":
            return lower(track.artist);
        case "year":
            return trackYear(track);
        case "addedAt":
            return track.addedAt;
        case "bpm":
            return track.bpm;
    }
}

/** Sorting (REQ 37). Tracks without a value always go last. */
export function sortTracks(tracks: MusicTrack[], key: SortKey, dir: SortDir): MusicTrack[] {
    const factor = dir === "asc" ? 1 : -1;
    return [...tracks].sort((a, b) => {
        const va = sortValue(a, key);
        const vb = sortValue(b, key);
        if (va == null && vb == null) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        if (typeof va === "string" && typeof vb === "string") {
            return va.localeCompare(vb) * factor;
        }
        return ((va as number) - (vb as number)) * factor;
    });
}

export type Facet = { value: string; count: number };

export type Facets = {
    genres: Facet[];
    moods: Facet[];
    languages: Facet[];
    themes: Facet[];
    keys: Facet[];
    years: { min?: number; max?: number };
    bpm: { min?: number; max?: number };
};

function count(values: (string | undefined)[]): Facet[] {
    const map = new Map<string, number>();
    for (const v of values) if (v) map.set(v, (map.get(v) ?? 0) + 1);
    return [...map.entries()]
        .map(([value, n]) => ({ value, count: n }))
        .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/** Values available for filtering, with counts. */
export function collectFacets(tracks: MusicTrack[]): Facets {
    const years = tracks.map(trackYear).filter((y): y is number => !!y);
    const bpms = tracks.map((t) => t.bpm).filter((b): b is number => !!b);
    return {
        genres: count(tracks.map((t) => t.genre)),
        moods: count(tracks.map((t) => t.mood)),
        languages: count(tracks.map((t) => t.language)),
        themes: count(tracks.flatMap((t) => t.themes ?? [])),
        keys: count(tracks.map((t) => t.musicalKey)),
        years: years.length ? { min: Math.min(...years), max: Math.max(...years) } : {},
        bpm: bpms.length
            ? { min: Math.floor(Math.min(...bpms)), max: Math.ceil(Math.max(...bpms)) }
            : {},
    };
}
