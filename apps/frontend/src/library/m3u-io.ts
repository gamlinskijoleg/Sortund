import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import { Directory, File, Paths } from "expo-file-system";
import type { MusicTrack, Playlist } from "../data/types";
import { usePlaylistStore } from "../store/usePlaylistStore";
import { buildM3U, matchM3UEntries, parseM3U } from "./m3u";

/** Exports a playlist as .m3u and opens the system share sheet (REQ 50). */
export async function exportPlaylist(playlist: Playlist, tracks: MusicTrack[]) {
    const dir = new Directory(Paths.cache, "playlists");
    if (!dir.exists) dir.create({ intermediates: true });
    const safeName = playlist.name.replace(/[\\/:*?"<>|]+/g, "_") || "playlist";
    const file = new File(dir, `${safeName}.m3u`);
    file.create({ overwrite: true });
    file.writeSync(buildM3U(playlist.name, tracks));
    await Sharing.shareAsync(file.uri, { mimeType: "audio/x-mpegurl", dialogTitle: playlist.name });
}

/** Imports an .m3u / .m3u8 file and creates a playlist from the tracks found in the library. */
export async function importPlaylist(
    library: MusicTrack[]
): Promise<{ playlist: Playlist; matched: number; missing: number } | null> {
    const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]) return null;
    const asset = result.assets[0];
    const text = await new File(asset.uri).text();
    const parsed = parseM3U(text);
    const { assetIds, unmatched } = matchM3UEntries(parsed.entries, library);
    const name = parsed.name ?? asset.name.replace(/\.m3u8?$/i, "");
    const playlist = usePlaylistStore.getState().create(name, assetIds);
    return { playlist, matched: assetIds.length, missing: unmatched.length };
}
