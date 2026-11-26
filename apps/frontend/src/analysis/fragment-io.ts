import { Directory, File, FileMode, Paths } from "expo-file-system";
import type { MusicTrack } from "../data/types";
import {
    FLAC_MAGIC,
    compressedRange,
    concatBytes,
    containerOf,
    flacLayout,
    mp3AudioStart,
    parseWavHeader,
    wavDataLength,
    wavFragment,
} from "./fragment";

const HEADER_PROBE = 64 * 1024;
/** Upload limit of the backend. */
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
/** Extra bytes for Ogg so the stream headers (comments, artwork) do not eat into the 30 s. */
const OGG_SLACK = 256 * 1024;

export class FragmentError extends Error {}

export function readRange(file: File, start: number, length: number): Uint8Array {
    // Read-only: the app may read files in Music but is not allowed to write them.
    const handle = file.open(FileMode.ReadOnly);
    try {
        handle.offset = start;
        return handle.readBytesSync(length);
    } finally {
        handle.close();
    }
}

/** Reads FLAC metadata blocks one by one so a large embedded picture is never loaded. */
export function readFlacHeader(file: File): Uint8Array {
    // Read-only: the app may read files in Music but is not allowed to write them.
    const handle = file.open(FileMode.ReadOnly);
    try {
        const parts: Uint8Array[] = [handle.readBytesSync(4)];
        for (;;) {
            const blockHeader = handle.readBytesSync(4);
            if (blockHeader.length < 4) break;
            const isLast = (blockHeader[0]! & 0x80) !== 0;
            const type = blockHeader[0]! & 0x7f;
            const length = (blockHeader[1]! << 16) | (blockHeader[2]! << 8) | blockHeader[3]!;
            if (type === 0) {
                parts.push(blockHeader, handle.readBytesSync(length));
            } else {
                // Keep only the header of skipped blocks; flacLayout only needs their length.
                parts.push(blockHeader, new Uint8Array(length));
                handle.offset = (handle.offset ?? 0) + length;
            }
            if (isLast) break;
        }
        return concatBytes(...parts);
    } finally {
        handle.close();
    }
}

/**
 * Writes a fragment of at most 30 seconds to the cache directory and returns its URI (REQ 14).
 * M4A cannot be cut without re-encoding, so the whole file is sent when it fits the upload limit.
 */
export function createFragment(track: MusicTrack): {
    uri: string;
    filename: string;
    cleanup: () => void;
} {
    const file = new File(track.sourceUri);
    if (!file.exists) throw new FragmentError("File not found");
    const size = file.size ?? 0;
    const filename =
        track.filename ?? decodeURIComponent(track.sourceUri.split("/").pop() ?? "track.mp3");
    const container = containerOf(filename);

    let bytes: Uint8Array;
    switch (container) {
        case "mp3": {
            const start = mp3AudioStart(readRange(file, 0, 10));
            const range = compressedRange(size, start, track.duration);
            bytes = readRange(file, range.start, range.length);
            break;
        }
        case "wav": {
            const header = readRange(file, 0, Math.min(size, HEADER_PROBE));
            const layout = parseWavHeader(header);
            if (!layout) throw new FragmentError("Unsupported WAV layout");
            const pcm = readRange(file, layout.headerEnd, wavDataLength(layout));
            bytes = wavFragment(header, layout, pcm);
            break;
        }
        case "flac": {
            const layout = flacLayout(readFlacHeader(file));
            if (!layout) throw new FragmentError("Unsupported FLAC layout");
            const range = compressedRange(size, layout.audioStart, track.duration);
            bytes = concatBytes(
                FLAC_MAGIC,
                layout.streamInfo,
                readRange(file, range.start, range.length)
            );
            break;
        }
        case "ogg": {
            const range = compressedRange(size, 0, track.duration);
            bytes = readRange(file, 0, Math.min(size, range.length + OGG_SLACK));
            break;
        }
        case "m4a": {
            if (size > MAX_UPLOAD_BYTES) throw new FragmentError("M4A file is too large to upload");
            bytes = file.bytesSync();
            break;
        }
        default:
            throw new FragmentError("Unsupported audio format");
    }

    if (bytes.length > MAX_UPLOAD_BYTES) bytes = bytes.subarray(0, MAX_UPLOAD_BYTES);

    const dir = new Directory(Paths.cache, "fragments");
    if (!dir.exists) dir.create({ intermediates: true });
    const out = new File(dir, `${track.assetId}_${Date.now()}.${filename.split(".").pop()}`);
    out.create({ overwrite: true });
    out.writeSync(bytes);
    return {
        uri: out.uri,
        filename,
        cleanup: () => {
            try {
                if (out.exists) out.delete();
            } catch {
                // ignore
            }
        },
    };
}
