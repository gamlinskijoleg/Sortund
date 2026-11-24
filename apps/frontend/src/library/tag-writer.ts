import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import type { MusicTrack } from "../data/types";
import { trackYear } from "./track-utils";
import { writeId3 } from "./id3";

export type WriteTagsOutcome =
    | { kind: "written" }
    | { kind: "copy"; uri: string }
    | { kind: "unsupported" };

/**
 * Writes the final metadata into the MP3 file (REQ 42). Android's scoped storage usually forbids
 * modifying files owned by other apps; in that case a tagged copy is created and offered for sharing.
 */
export async function writeTagsToFile(track: MusicTrack): Promise<WriteTagsOutcome> {
    const name =
        track.filename ?? decodeURIComponent(track.sourceUri.split("/").pop() ?? "track.mp3");
    if (!name.toLowerCase().endsWith(".mp3")) return { kind: "unsupported" };

    const source = new File(track.sourceUri);
    const original = await source.bytes();
    const tagged = writeId3(original, {
        title: track.title,
        artist: track.artist,
        album: track.album,
        year: trackYear(track),
        genre: track.genre,
        mood: track.mood,
        tags: track.tags,
    });

    try {
        await source.write(tagged);
        return { kind: "written" };
    } catch {
        const dir = new Directory(Paths.document, "tagged");
        if (!dir.exists) dir.create({ intermediates: true });
        const copy = new File(dir, name);
        copy.create({ overwrite: true });
        await copy.write(tagged);
        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(copy.uri, { mimeType: "audio/mpeg", dialogTitle: name });
        }
        return { kind: "copy", uri: copy.uri };
    }
}
