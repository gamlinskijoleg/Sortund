/**
 * The library is the device's "Music" folder together with all its subfolders
 * (e.g. Music/Telegram Music, Music/Rock/2010), on internal storage and on SD cards.
 */
const MUSIC_ROOT = /^\/storage\/(?:emulated\/\d+|[^/]+)\/music\//i;

/** File path of a media asset URI (`file:///storage/...`, possibly percent-encoded). */
export function pathFromUri(uri: string): string {
    let path = uri.replace(/^file:\/\//, "");
    try {
        path = decodeURIComponent(path);
    } catch {
        // Keep the raw path if it contains a stray "%".
    }
    return path;
}

/** True when the file lies in the Music folder or any folder inside it. */
export function isInMusicFolder(uri: string): boolean {
    return MUSIC_ROOT.test(pathFromUri(uri));
}
