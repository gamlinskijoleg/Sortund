import { File } from "expo-file-system";
import { readFlacHeader, readRange } from "../analysis/fragment-io";
import { containerOf, flacLayout, mp3AudioStart } from "../analysis/fragment";
import { SIGNATURE_PROBE, audioSignature, id3v1Length } from "../library/duplicates";
import { log } from "@/utils/logger";

/**
 * Signature of the audio data of a file (see library/duplicates.ts). Reads at most ~130 KB.
 * Tags are skipped for MP3 (ID3v2/ID3v1) and FLAC (metadata blocks); for other formats the whole
 * file is used, so only fully identical files match there.
 */
export function computeContentHash(uri: string, filename: string): string | undefined {
    try {
        const file = new File(uri);
        if (!file.exists) return undefined;
        const size = file.size ?? 0;
        if (size <= 0) return undefined;

        const container = containerOf(filename);
        let start = 0;
        let end = size;
        if (container === "mp3") {
            start = mp3AudioStart(readRange(file, 0, Math.min(10, size)));
            const lastLength = Math.min(128, size);
            end -= id3v1Length(readRange(file, size - lastLength, lastLength));
        } else if (container === "flac") {
            start = flacLayout(readFlacHeader(file))?.audioStart ?? 0;
        }
        if (end <= start) return undefined;

        const length = end - start;
        const probe = Math.min(SIGNATURE_PROBE, length);
        const head = readRange(file, start, probe);
        const tail = readRange(file, end - probe, probe);
        return `${container}:${audioSignature(length, head, tail)}`;
    } catch (error) {
        log.warn(`Could not compute the file signature of ${filename}:`, error);
        return undefined;
    }
}
