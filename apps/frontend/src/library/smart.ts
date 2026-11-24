import type {
    MusicTrack,
    SmartCondition,
    SmartGroup,
    SmartRules,
    SortDir,
    SortKey,
} from "../data/types";
import { sortTracks } from "./filters";
import { trackYear } from "./track-utils";

function textValues(track: MusicTrack, field: SmartCondition["field"]): string[] {
    switch (field) {
        case "genre":
            return track.genre ? [track.genre] : [];
        case "mood":
            return track.mood ? [track.mood] : [];
        case "language":
            return track.language ? [track.language] : [];
        case "theme":
            return track.themes ?? [];
        case "key":
            return track.musicalKey ? [track.musicalKey] : [];
        case "tag":
            return track.tags ?? [];
        case "artist":
            return track.artist ? [track.artist] : [];
        default:
            return [];
    }
}

function numberValue(track: MusicTrack, field: SmartCondition["field"]): number | undefined {
    if (field === "year") return trackYear(track);
    if (field === "bpm") return track.bpm;
    return undefined;
}

export function matchesCondition(track: MusicTrack, c: SmartCondition): boolean {
    if (c.field === "favourite") {
        const want = c.value === true || c.value === "true";
        return c.op === "isNot" ? !!track.isFavourite !== want : !!track.isFavourite === want;
    }

    if (c.field === "year" || c.field === "bpm") {
        const v = numberValue(track, c.field);
        const a = Number(c.value);
        if (v == null || Number.isNaN(a)) return false;
        switch (c.op) {
            case "is":
                return v === a;
            case "isNot":
                return v !== a;
            case "gte":
                return v >= a;
            case "lte":
                return v <= a;
            case "between":
                return v >= a && v <= Number(c.value2 ?? a);
            default:
                return false;
        }
    }

    const wanted = String(c.value).toLowerCase();
    const values = textValues(track, c.field).map((v) => v.toLowerCase());
    switch (c.op) {
        case "is":
            return values.includes(wanted);
        case "isNot":
            return !values.includes(wanted);
        case "contains":
            return values.some((v) => v.includes(wanted));
        default:
            return false;
    }
}

function matchesGroup(track: MusicTrack, group: SmartGroup): boolean {
    if (group.conditions.length === 0) return true;
    return group.match === "all"
        ? group.conditions.every((c) => matchesCondition(track, c))
        : group.conditions.some((c) => matchesCondition(track, c));
}

export function matchesRules(track: MusicTrack, rules: SmartRules): boolean {
    const groups = rules.groups.filter((g) => g.conditions.length > 0);
    if (groups.length === 0) return false;
    return rules.match === "all"
        ? groups.every((g) => matchesGroup(track, g))
        : groups.some((g) => matchesGroup(track, g));
}

/**
 * Smart playlist contents (REQ 51–54). Evaluated against the current library every time,
 * so the playlist updates itself when tracks are added or re-tagged.
 */
export function evaluateSmartPlaylist(
    tracks: MusicTrack[],
    rules: SmartRules,
    options: { sortBy?: SortKey; sortDir?: SortDir; limit?: number } = {}
): MusicTrack[] {
    let result = tracks.filter((t) => matchesRules(t, rules));
    if (options.sortBy) result = sortTracks(result, options.sortBy, options.sortDir ?? "asc");
    if (options.limit && options.limit > 0) result = result.slice(0, options.limit);
    return result;
}

export function emptyRules(): SmartRules {
    return {
        match: "all",
        groups: [{ match: "all", conditions: [{ field: "genre", op: "is", value: "" }] }],
    };
}
