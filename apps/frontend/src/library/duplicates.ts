import type { MusicTrack } from "../data/types";
import { pathFromUri } from "./music-folder";

/**
 * Identical-file detection. Two files are duplicates when their audio data is byte-for-byte the
 * same; tags (ID3v2 at the start, ID3v1 at the end, FLAC metadata blocks) and file names may differ.
 * The signature combines the audio length with hashes of its first and last bytes, so a file never
 * has to be read completely.
 */

/** Bytes hashed at the beginning and at the end of the audio data. */
export const SIGNATURE_PROBE = 64 * 1024;

/** 32-bit FNV-1a with a configurable offset basis. */
function fnv1a(bytes: Uint8Array, seed: number): number {
    let hash = seed >>> 0;
    for (let i = 0; i < bytes.length; i++) {
        hash ^= bytes[i]!;
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash >>> 0;
}

/** 64-bit hash (two independent FNV-1a runs) as 16 hex characters. */
export function hashBytes(bytes: Uint8Array): string {
    const a = fnv1a(bytes, 0x811c9dc5).toString(16).padStart(8, "0");
    const b = fnv1a(bytes, 0x01000193 ^ 0x5bd1e995)
        .toString(16)
        .padStart(8, "0");
    return a + b;
}

/** Length of an ID3v1 tag ("TAG" + 125 bytes) at the end of an MP3, judged by its last 128 bytes. */
export function id3v1Length(lastBytes: Uint8Array): number {
    if (lastBytes.length < 128) return 0;
    const o = lastBytes.length - 128;
    return lastBytes[o] === 0x54 && lastBytes[o + 1] === 0x41 && lastBytes[o + 2] === 0x47
        ? 128
        : 0;
}

/** Signature of the audio data: `<length>:<hash of the first bytes>:<hash of the last bytes>`. */
export function audioSignature(length: number, head: Uint8Array, tail: Uint8Array): string {
    return `${length}:${hashBytes(head)}:${hashBytes(tail)}`;
}

/** Folder of a track relative to the storage root, e.g. "Music/Telegram Music". */
export function folderOf(uri: string): string {
    const path = pathFromUri(uri);
    const dir = path.slice(0, Math.max(0, path.lastIndexOf("/")));
    const match = /^\/storage\/(?:emulated\/\d+|[^/]+)\/(.*)$/.exec(dir);
    return match ? match[1]! : dir;
}

/**
 * Which copy stays visible: the one closest to the Music root, then the one added first, then a
 * stable order by path, so the choice does not change between scans.
 */
function compareCopies(a: MusicTrack, b: MusicTrack): number {
    const depth = (t: MusicTrack) => folderOf(t.sourceUri).split("/").length;
    return (
        depth(a) - depth(b) ||
        (a.addedAt ?? 0) - (b.addedAt ?? 0) ||
        pathFromUri(a.sourceUri).localeCompare(pathFromUri(b.sourceUri))
    );
}

export type DuplicateGroup = {
    /** Copy shown in the library. */
    primary: MusicTrack;
    /** All copies, the visible one first. */
    copies: MusicTrack[];
};

/** Splits the library into visible tracks and groups of identical files. */
export function findDuplicates(tracks: MusicTrack[]): {
    visible: MusicTrack[];
    groups: DuplicateGroup[];
} {
    const bySignature = new Map<string, MusicTrack[]>();
    for (const t of tracks) {
        if (!t.contentHash) continue;
        const list = bySignature.get(t.contentHash);
        if (list) list.push(t);
        else bySignature.set(t.contentHash, [t]);
    }

    const hidden = new Set<string>();
    const groups: DuplicateGroup[] = [];
    for (const list of bySignature.values()) {
        if (list.length < 2) continue;
        const copies = [...list].sort(compareCopies);
        groups.push({ primary: copies[0]!, copies });
        for (const copy of copies.slice(1)) hidden.add(copy.assetId);
    }
    groups.sort((x, y) => x.primary.title.localeCompare(y.primary.title));

    return {
        visible: hidden.size ? tracks.filter((t) => !hidden.has(t.assetId)) : tracks,
        groups,
    };
}
