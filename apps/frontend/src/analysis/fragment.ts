/**
 * Cuts a ≤ 30-second fragment out of an audio file without decoding it (REQ 14), so only a small
 * part of the track is uploaded. Pure functions over bytes — I/O lives in fragment-io.ts.
 */

export const FRAGMENT_SECONDS = 30;

export type Container = "mp3" | "wav" | "flac" | "ogg" | "m4a" | "unknown";

export function containerOf(filename: string): Container {
    const ext = filename.toLowerCase().split(".").pop() ?? "";
    if (ext === "mp3") return "mp3";
    if (ext === "wav") return "wav";
    if (ext === "flac") return "flac";
    if (ext === "ogg" || ext === "oga" || ext === "opus") return "ogg";
    if (ext === "m4a" || ext === "mp4" || ext === "aac") return "m4a";
    return "unknown";
}

/** Byte offset where MP3 audio frames start (after an ID3v2 tag, if any). */
export function mp3AudioStart(header: Uint8Array): number {
    if (header.length >= 10 && header[0] === 0x49 && header[1] === 0x44 && header[2] === 0x33) {
        const size =
            ((header[6]! & 0x7f) << 21) |
            ((header[7]! & 0x7f) << 14) |
            ((header[8]! & 0x7f) << 7) |
            (header[9]! & 0x7f);
        const footer = header[3] === 4 && (header[5]! & 0x10) !== 0 ? 10 : 0;
        return 10 + size + footer;
    }
    return 0;
}

/**
 * Byte range covering the first `seconds` of compressed audio, estimated from the average bitrate
 * (file size / duration). Works for CBR and VBR alike.
 */
export function compressedRange(
    fileSize: number,
    audioStart: number,
    durationMs: number,
    seconds = FRAGMENT_SECONDS
): { start: number; length: number } {
    const audioBytes = Math.max(0, fileSize - audioStart);
    if (!durationMs || durationMs <= seconds * 1000)
        return { start: audioStart, length: audioBytes };
    const length = Math.ceil((audioBytes * seconds * 1000) / durationMs);
    return { start: audioStart, length: Math.min(audioBytes, length) };
}

function ascii(b: Uint8Array, o: number, n: number): string {
    let s = "";
    for (let i = 0; i < n; i++) s += String.fromCharCode(b[o + i]!);
    return s;
}

function u32le(b: Uint8Array, o: number): number {
    return (b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16) | (b[o + 3]! << 24)) >>> 0;
}

function u16le(b: Uint8Array, o: number): number {
    return b[o]! | (b[o + 1]! << 8);
}

function setU32le(b: Uint8Array, o: number, v: number) {
    b[o] = v & 0xff;
    b[o + 1] = (v >>> 8) & 0xff;
    b[o + 2] = (v >>> 16) & 0xff;
    b[o + 3] = (v >>> 24) & 0xff;
}

export type WavLayout = {
    headerEnd: number;
    dataSize: number;
    byteRate: number;
    blockAlign: number;
};

/** Locates the fmt and data chunks of a RIFF/WAVE header. */
export function parseWavHeader(header: Uint8Array): WavLayout | null {
    if (header.length < 12 || ascii(header, 0, 4) !== "RIFF" || ascii(header, 8, 4) !== "WAVE")
        return null;
    let offset = 12;
    let byteRate = 0;
    let blockAlign = 1;
    while (offset + 8 <= header.length) {
        const id = ascii(header, offset, 4);
        const size = u32le(header, offset + 4);
        if (id === "fmt ") {
            byteRate = u32le(header, offset + 16);
            blockAlign = u16le(header, offset + 20) || 1;
        } else if (id === "data") {
            return byteRate
                ? { headerEnd: offset + 8, dataSize: size, byteRate, blockAlign }
                : null;
        }
        offset += 8 + size + (size % 2);
    }
    return null;
}

/** Builds a valid shorter WAV: original header with patched sizes + the first `seconds` of PCM. */
export function wavFragment(header: Uint8Array, layout: WavLayout, pcm: Uint8Array): Uint8Array {
    const out = new Uint8Array(layout.headerEnd + pcm.length);
    out.set(header.subarray(0, layout.headerEnd), 0);
    out.set(pcm, layout.headerEnd);
    setU32le(out, 4, out.length - 8);
    setU32le(out, layout.headerEnd - 4, pcm.length);
    return out;
}

export function wavDataLength(layout: WavLayout, seconds = FRAGMENT_SECONDS): number {
    const wanted = layout.byteRate * seconds;
    const length = Math.min(layout.dataSize, wanted);
    return length - (length % layout.blockAlign);
}

/**
 * FLAC: keeps "fLaC" + STREAMINFO (marked as the last metadata block) and drops the other blocks
 * (cover art can be large). Returns the offset where audio frames start.
 */
export function flacLayout(
    header: Uint8Array
): { streamInfo: Uint8Array; audioStart: number } | null {
    if (ascii(header, 0, 4) !== "fLaC") return null;
    let offset = 4;
    let streamInfo: Uint8Array | null = null;
    for (;;) {
        if (offset + 4 > header.length) return null;
        const isLast = (header[offset]! & 0x80) !== 0;
        const type = header[offset]! & 0x7f;
        const length =
            (header[offset + 1]! << 16) | (header[offset + 2]! << 8) | header[offset + 3]!;
        if (type === 0) {
            if (offset + 4 + length > header.length) return null;
            streamInfo = header.slice(offset, offset + 4 + length);
            streamInfo[0] = 0x80; // last-metadata-block flag, type 0
        }
        offset += 4 + length;
        if (isLast) break;
    }
    return streamInfo ? { streamInfo, audioStart: offset } : null;
}

export function concatBytes(...parts: Uint8Array[]): Uint8Array {
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let offset = 0;
    for (const p of parts) {
        out.set(p, offset);
        offset += p.length;
    }
    return out;
}

export const FLAC_MAGIC = new Uint8Array([0x66, 0x4c, 0x61, 0x43]);
