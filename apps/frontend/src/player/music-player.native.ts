import TrackPlayer, { PlayerCommand } from "@rntp/player";

import type { MusicTrack } from "../data/music";

let setupPromise: Promise<void> | null = null;

export function ensureMusicPlayerReady() {
    if (!setupPromise) {
        setupPromise = Promise.resolve()
            .then(() => {
                return TrackPlayer.setupPlayer({
                    contentType: "music",
                    handleAudioBecomingNoisy: true,
                    android: {
                        wakeMode: "local",
                    },
                });
            })
            .then(() => {
                return TrackPlayer.setCommands({
                    capabilities: [
                        PlayerCommand.PlayPause,
                        PlayerCommand.Next,
                        PlayerCommand.Previous,
                        PlayerCommand.Seek,
                        PlayerCommand.SkipForward,
                        PlayerCommand.SkipBackward,
                    ],
                    forwardInterval: 15,
                    backwardInterval: 15,
                });
            })
            .catch((error: unknown) => {
                setupPromise = null;
                throw error;
            });
    }

    return setupPromise;
}

function buildPlayerMediaItems(tracks: MusicTrack[]) {
    return tracks
        .filter((track): track is MusicTrack & { sourceUri: string } => {
            return Boolean(track.sourceUri);
        })
        .map((track) => ({
            mediaId: track.sourceUri,
            url: track.sourceUri,
            title: track.title,
            artist: track.artist,
            duration: track.duration,
        }));
}

function resolveTrackIndex(tracks: MusicTrack[], sourceUri?: string) {
    const tracksWithUri = tracks.filter(
        (track): track is MusicTrack & { sourceUri: string } => {
            return Boolean(track.sourceUri);
        },
    );

    if (!tracksWithUri.length) {
        return -1;
    }

    if (!sourceUri) {
        return 0;
    }

    const index = tracksWithUri.findIndex(
        (track) => track.sourceUri === sourceUri,
    );

    return index >= 0 ? index : 0;
}

export async function startTrackPlayback(
    tracks: MusicTrack[],
    sourceUri?: string,
) {
    await ensureMusicPlayerReady();

    const mediaItems = buildPlayerMediaItems(tracks);
    const startIndex = resolveTrackIndex(tracks, sourceUri);

    if (!mediaItems.length || startIndex < 0) {
        return null;
    }

    TrackPlayer.setMediaItems(mediaItems, startIndex);

    return mediaItems[startIndex] ?? null;
}
