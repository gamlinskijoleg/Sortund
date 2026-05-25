import type { MusicTrack } from "../data/music";

export function ensureMusicPlayerReady() {
    return Promise.resolve();
}

export async function startTrackPlayback(tracks: MusicTrack[], sourceUri?: string) {
    await ensureMusicPlayerReady();
    return null;
}

export function buildPlayerMediaItems(tracks: MusicTrack[]) {
    return tracks
        .filter((track): track is MusicTrack & { sourceUri: string } => {
            return Boolean(track.sourceUri);
        })
        .map((track) => ({
            mediaId: track.sourceUri,
            url: track.sourceUri,
            title: track.title,
            artist: track.artist,
        }));
}
