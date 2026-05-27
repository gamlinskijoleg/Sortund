import TrackPlayer, { PlayerCommand } from "@rntp/player";
import type { MusicTrack } from "../data/music";

let initialized = false;
let initializationPromise: Promise<void> | null = null;

function isAlreadySetupError(error: unknown) {
    return (
        error instanceof Error &&
        error.message.toLowerCase().includes("already set up")
    );
}

async function configurePlayer() {
    TrackPlayer.setCommands({
        capabilities: [
            PlayerCommand.Seek,
            PlayerCommand.Next,
            PlayerCommand.Previous,
            PlayerCommand.PlayPause,
            PlayerCommand.Stop,
            PlayerCommand.SkipBackward,
            PlayerCommand.SkipForward,
        ],
        handling: "native",
    });
}

export async function initPlayer() {
    if (initialized) {
        return;
    }

    if (initializationPromise) {
        return initializationPromise;
    }

    initializationPromise = (async () => {
        try {
            console.log("Player: initializing TrackPlayer");

            try {
                TrackPlayer.setupPlayer();
            } catch (error) {
                if (!isAlreadySetupError(error)) {
                    throw error;
                }
            }

            await configurePlayer();

            initialized = true;
            console.log("Player: TrackPlayer initialized");
        } catch (error) {
            console.warn("Player: failed to initialize TrackPlayer", error);
        } finally {
            initializationPromise = null;
        }
    })();

    return initializationPromise;
}

export async function playTrack(track: MusicTrack) {
    await initPlayer();

    const mediaItem = {
        // id: track.assetId,
        url: track.sourceUri,
        title: track.title,
        artist: track.artist,
        mimeType: "audio/mpeg",
    };
    try {
        console.log("Player: setting media item", mediaItem);
        TrackPlayer.setMediaItems([mediaItem]);
        TrackPlayer.play();
    } catch (error) {
        console.error("Player: failed to set media items / play", error);
    }
}

export async function pausePlayback() {
    try {
        TrackPlayer.pause();
    } catch (error) {
        console.warn("Player: pause failed", error);
    }
}

export async function togglePlayback() {
    try {
        if (TrackPlayer.isPlaying()) {
            TrackPlayer.pause();
        } else {
            TrackPlayer.play();
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
