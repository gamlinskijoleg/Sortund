import type { MusicTrack } from "../data/types";

export type M3UEntry = {
    path: string;
    title?: string;
    artist?: string;
    durationSec?: number;
};

/** Local file system path of a track (decoded, without the file:// scheme). */
export function trackPath(track: Pick<MusicTrack, "sourceUri">): string {
    let path = track.sourceUri.replace(/^file:\/\//, "");
    try {
        path = decodeURIComponent(path);
    } catch {
        // keep the raw path
    }
    return path;
}

/** Extended M3U playlist that other players (VLC, Poweramp, foobar2000…) understand (REQ 50). */
export function buildM3U(name: string, tracks: MusicTrack[]): string {
    const lines = ["#EXTM3U", `#PLAYLIST:${name}`];
    for (const t of tracks) {
        const seconds = t.duration ? Math.round(t.duration / 1000) : -1;
        lines.push(`#EXTINF:${seconds},${t.artist} - ${t.title}`);
        lines.push(trackPath(t));
    }
    return lines.join("\n") + "\n";
}

export function parseM3U(text: string): { name?: string; entries: M3UEntry[] } {
    const entries: M3UEntry[] = [];
    let name: string | undefined;
    let pending: Omit<M3UEntry, "path"> | null = null;

    for (const raw of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
        const line = raw.trim();
        if (!line) continue;
        if (line.startsWith("#PLAYLIST:")) {
            name = line.slice("#PLAYLIST:".length).trim() || undefined;
        } else if (line.startsWith("#EXTINF:")) {
            const body = line.slice("#EXTINF:".length);
            const comma = body.indexOf(",");
            const duration = Number.parseInt(comma >= 0 ? body.slice(0, comma) : body, 10);
            const label = comma >= 0 ? body.slice(comma + 1).trim() : "";
            const dash = label.indexOf(" - ");
            pending = {
                durationSec: Number.isFinite(duration) && duration > 0 ? duration : undefined,
                artist: dash >= 0 ? label.slice(0, dash).trim() : undefined,
                title: dash >= 0 ? label.slice(dash + 3).trim() : label || undefined,
            };
        } else if (!line.startsWith("#")) {
            entries.push({ path: line, ...(pending ?? {}) });
            pending = null;
        }
    }
    return { name, entries };
}

function basename(path: string): string {
    const clean = path.replace(/\\/g, "/");
    let base = clean.slice(clean.lastIndexOf("/") + 1);
    try {
        base = decodeURIComponent(base);
    } catch {
        // keep as is
    }
    return base.toLowerCase();
}

const norm = (v: string | undefined) => (v ?? "").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Maps playlist entries to library tracks: by full path, then by file name,
 * then by "artist - title" from #EXTINF. Returns asset ids in playlist order (unmatched skipped).
 */
export function matchM3UEntries(
    entries: M3UEntry[],
    tracks: MusicTrack[]
): { assetIds: string[]; unmatched: M3UEntry[] } {
    const byPath = new Map<string, string>();
    const byName = new Map<string, string>();
    const byMeta = new Map<string, string>();
    for (const t of tracks) {
        const path = trackPath(t);
        byPath.set(path.toLowerCase(), t.assetId);
        byName.set(basename(t.filename ?? path), t.assetId);
        byMeta.set(`${norm(t.artist)}|${norm(t.title)}`, t.assetId);
    }

    const assetIds: string[] = [];
    const unmatched: M3UEntry[] = [];
    for (const e of entries) {
        const id =
            byPath.get(e.path.replace(/^file:\/\//, "").toLowerCase()) ??
            byName.get(basename(e.path)) ??
            (e.title ? byMeta.get(`${norm(e.artist)}|${norm(e.title)}`) : undefined);
        if (id && !assetIds.includes(id)) assetIds.push(id);
        else if (!id) unmatched.push(e);
    }
    return { assetIds, unmatched };
}
