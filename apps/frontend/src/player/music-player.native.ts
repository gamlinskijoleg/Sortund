import TrackPlayer, { PlayerCommand, PlaybackState } from "@rntp/player";
import type { MusicTrack } from "../data/music";

let initialized = false;

export async function initPlayer() {
    if (initialized) return;

    try {
        console.log("Player: initializing TrackPlayer");
        await TrackPlayer.setupPlayer();

        // Configure basic capabilities — keep this minimal and cross-platform.
        await TrackPlayer.updateOptions({
            capabilities: [
                PlayerCommand.Play,
                PlayerCommand.Pause,
                PlayerCommand.SeekTo,
                PlayerCommand.SkipToNext,
                PlayerCommand.SkipToPrevious,
            ],
            compactCapabilities: [PlayerCommand.Play, PlayerCommand.Pause],
        });

        initialized = true;
        console.log("Player: TrackPlayer initialized");
    } catch (error) {
        console.warn("Player: failed to initialize TrackPlayer", error);
    }
}

export async function playTrack(track: MusicTrack) {
    await initPlayer();

    try {
        // Ensure player is in a clean state.
        await TrackPlayer.reset();
    } catch (err) {
        console.warn("Player: reset failed", err);
    }

    const mediaItem: any = {
        id: track.assetId ?? track.sourceUri,
        url: track.sourceUri,
        title: track.title,
        artist: track.artist,
    };

    // Avoid sending potentially incorrect or null durations to native.
    if (
        typeof track.duration === "number" &&
        Number.isFinite(track.duration) &&
        track.duration > 0
    ) {
        // TrackPlayer expects duration in seconds. If the loader provides milliseconds,
        // the caller can convert before assigning. We omit duration here to be safe.
        // mediaItem.duration = track.duration / 1000;
    }

    try {
        await TrackPlayer.setMediaItems([mediaItem]);
        // Prefer prepare() if available, otherwise start playback directly.
        if (typeof (TrackPlayer as any).prepare === "function") {
            await (TrackPlayer as any).prepare();
        } else {
            await TrackPlayer.play();
        }
        console.log("Player: playback started", mediaItem.id);
    } catch (error) {
        console.error("Player: failed to set media items / play", error);
    }
}

export async function pausePlayback() {
    try {
        await TrackPlayer.pause();
    } catch (error) {
        console.warn("Player: pause failed", error);
    }
}

export async function togglePlayback() {
    try {
        const state = await (TrackPlayer as any).getState();
        if (state === PlaybackState.Playing) {
            await TrackPlayer.pause();
        } else {
            await TrackPlayer.play();
        }
    } catch (error) {
        console.warn("Player: toggle failed", error);
    }
}

export default {
    initPlayer,
    playTrack,
    pausePlayback,
    togglePlayback,
};
