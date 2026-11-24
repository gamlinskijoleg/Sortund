/**
 * Minimal ID3v2.3 / v2.4 tag writer for MP3 files (REQ 42).
 *
 * Existing frames that we do not manage (cover art, lyrics, comments…) are kept byte-for-byte;
 * our text frames are replaced. The tag keeps the original major version (3 is used for new tags).
 */

export type Id3Fields = {
    title?: string;
    artist?: string;
    album?: string;
    year?: number;
    genre?: string;
    mood?: string;
    tags?: string[];
};

type RawFrame = { id: string; bytes: Uint8Array; description?: string };

const MANAGED = new Set(["TIT2", "TPE1", "TALB", "TYER", "TDRC", "TCON", "TMOO"]);
const MANAGED_TXXX = new Set(["MOOD", "SORTUND_TAGS"]);
const PADDING = 512;

export class Id3Error extends Error {}

function readSyncsafe(b: Uint8Array, o: number): number {
    return (
        ((b[o]! & 0x7f) << 21) |
        ((b[o + 1]! & 0x7f) << 14) |
        ((b[o + 2]! & 0x7f) << 7) |
        (b[o + 3]! & 0x7f)
    );
}

function writeSyncsafe(n: number): number[] {
    return [(n >> 21) & 0x7f, (n >> 14) & 0x7f, (n >> 7) & 0x7f, n & 0x7f];
}

function readUint32(b: Uint8Array, o: number): number {
    return ((b[o]! << 24) >>> 0) + (b[o + 1]! << 16) + (b[o + 2]! << 8) + b[o + 3]!;
}

function writeUint32(n: number): number[] {
    return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}

/** UTF-16 with BOM — supported by both v2.3 and v2.4, handles Cyrillic. */
function encodeUtf16(text: string): number[] {
    const out = [0xff, 0xfe];
    for (let i = 0; i < text.length; i++) {
        const c = text.charCodeAt(i);
        out.push(c & 0xff, c >> 8);
    }
    return out;
}

function decodeUtf16(bytes: Uint8Array): string {
    let le = true;
    let start = 0;
    if (bytes[0] === 0xfe && bytes[1] === 0xff) {
        le = false;
        start = 2;
    } else if (bytes[0] === 0xff && bytes[1] === 0xfe) start = 2;
    let s = "";
    for (let i = start; i + 1 < bytes.length; i += 2) {
        const code = le ? bytes[i]! | (bytes[i + 1]! << 8) : (bytes[i]! << 8) | bytes[i + 1]!;
        if (code === 0) break;
        s += String.fromCharCode(code);
    }
    return s;
}

/** Description of a TXXX frame (needed to know whether we manage it). */
function txxxDescription(body: Uint8Array): string {
    const encoding = body[0];
    const rest = body.subarray(1);
    if (encoding === 1 || encoding === 2) return decodeUtf16(rest);
    let s = "";
    for (const b of rest) {
        if (b === 0) break;
        s += String.fromCharCode(b);
    }
    return s;
}

export type ParsedTag = { version: number; frames: RawFrame[]; audioStart: number };

/** Parses an existing ID3v2 header and frames. Returns null when the file has no ID3v2 tag. */
export function parseId3(bytes: Uint8Array): ParsedTag | null {
    if (bytes.length < 10 || bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33)
        return null;
    const version = bytes[3]!;
    const flags = bytes[5]!;
    const size = readSyncsafe(bytes, 6);
    const footer = version === 4 && (flags & 0x10) !== 0 ? 10 : 0;
    const audioStart = 10 + size + footer;

    if (version < 3 || version > 4) throw new Id3Error(`Unsupported ID3v2.${version} tag`);
    if (flags & 0x80) throw new Id3Error("Unsynchronised ID3 tags are not supported");

    let offset = 10;
    if (flags & 0x40) {
        // Extended header: v2.3 size excludes itself, v2.4 includes itself (syncsafe).
        offset += version === 4 ? readSyncsafe(bytes, offset) : readUint32(bytes, offset) + 4;
    }

    const frames: RawFrame[] = [];
    const end = Math.min(10 + size, bytes.length);
    while (offset + 10 <= end) {
        const id = String.fromCharCode(
            bytes[offset]!,
            bytes[offset + 1]!,
            bytes[offset + 2]!,
            bytes[offset + 3]!
        );
        if (!/^[A-Z0-9]{4}$/.test(id)) break; // padding reached
        const frameSize =
            version === 4 ? readSyncsafe(bytes, offset + 4) : readUint32(bytes, offset + 4);
        const total = 10 + frameSize;
        if (frameSize <= 0 || offset + total > end) break;
        const frameBytes = bytes.subarray(offset, offset + total);
        frames.push({
            id,
            bytes: frameBytes,
            description: id === "TXXX" ? txxxDescription(frameBytes.subarray(10)) : undefined,
        });
        offset += total;
    }
    return { version, frames, audioStart };
}

function frame(id: string, body: number[], version: number): number[] {
    const size = version === 4 ? writeSyncsafe(body.length) : writeUint32(body.length);
    return [...Array.from(id, (c) => c.charCodeAt(0)), ...size, 0, 0, ...body];
}

function textFrame(id: string, text: string, version: number): number[] {
    return frame(id, [1, ...encodeUtf16(text), 0, 0], version);
}

function txxxFrame(description: string, value: string, version: number): number[] {
    return frame(
        "TXXX",
        [1, ...encodeUtf16(description), 0, 0, ...encodeUtf16(value), 0, 0],
        version
    );
}

/** Returns a new file (bytes) with the given fields written into the ID3v2 tag. */
export function writeId3(bytes: Uint8Array, fields: Id3Fields): Uint8Array {
    const parsed = parseId3(bytes);
    const version = parsed?.version ?? 3;
    const kept = (parsed?.frames ?? []).filter(
        (f) =>
            !MANAGED.has(f.id) &&
            !(f.id === "TXXX" && f.description && MANAGED_TXXX.has(f.description))
    );

    const body: number[] = [];
    if (fields.title) body.push(...textFrame("TIT2", fields.title, version));
    if (fields.artist) body.push(...textFrame("TPE1", fields.artist, version));
    if (fields.album) body.push(...textFrame("TALB", fields.album, version));
    if (fields.year)
        body.push(...textFrame(version === 4 ? "TDRC" : "TYER", String(fields.year), version));
    if (fields.genre) body.push(...textFrame("TCON", fields.genre, version));
    if (fields.mood) body.push(...txxxFrame("MOOD", fields.mood, version));
    if (fields.tags && fields.tags.length)
        body.push(...txxxFrame("SORTUND_TAGS", fields.tags.join("; "), version));

    const keptLength = kept.reduce((n, f) => n + f.bytes.length, 0);
    const tagSize = body.length + keptLength + PADDING;
    const audio = bytes.subarray(parsed?.audioStart ?? 0);

    const out = new Uint8Array(10 + tagSize + audio.length);
    out.set([0x49, 0x44, 0x33, version, 0, 0, ...writeSyncsafe(tagSize)], 0);
    let offset = 10;
    for (const f of kept) {
        out.set(f.bytes, offset);
        offset += f.bytes.length;
    }
    out.set(body, offset);
    offset += body.length + PADDING; // padding bytes are already zero
    out.set(audio, offset);
    return out;
}

/** Reads text frames back (used by tests and for verification after writing). */
export function readId3Text(bytes: Uint8Array): Record<string, string> {
    const parsed = parseId3(bytes);
    const result: Record<string, string> = {};
    for (const f of parsed?.frames ?? []) {
        const body = f.bytes.subarray(10);
        if (f.id === "TXXX") {
            const enc = body[0];
            const rest = body.subarray(1);
            if (enc === 1) {
                // description \0\0 value
                let i = 0;
                while (i + 1 < rest.length && !(rest[i] === 0 && rest[i + 1] === 0)) i += 2;
                result[`TXXX:${decodeUtf16(rest.subarray(0, i))}`] = decodeUtf16(
                    rest.subarray(i + 2)
                );
            }
        } else if (f.id.startsWith("T")) {
            const enc = body[0];
            const rest = body.subarray(1);
            result[f.id] =
                enc === 1 || enc === 2
                    ? decodeUtf16(rest)
                    : Array.from(rest)
                          .filter((b) => b !== 0)
                          .map((b) => String.fromCharCode(b))
                          .join("");
        }
    }
    return result;
}
