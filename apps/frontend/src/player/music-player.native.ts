import { AudioPlayer, createAudioPlayer, AudioModule } from "expo-audio";
import type { MusicTrack } from "../data/music";

// Global player instance
let globalPlayer: AudioPlayer | null = null;
let initialized = false;

/**
 * Configure audio mode for background playback and lock-screen controls.
 */
async function configureAudioMode() {
    if (initialized) return;
    try {
        await AudioModule.setAudioModeAsync({
            playsInSilentMode: true,
            shouldPlayInBackground: true,
            interruptionMode: "doNotMix",
            shouldRouteThroughEarpiece: false,
        });
        initialized = true;
        console.log("Player: AudioMode configured successfully");
    } catch (error) {
        console.warn("Player: Failed to configure AudioMode", error);
    }
}

/**
 * Play a track and show metadata on the lock screen.
 */
export async function playTrack(track: MusicTrack) {
    await configureAudioMode();

    const decodedUrl = decodeURIComponent(track.sourceUri);

    const trackMetadata = {
        title: track.title,
        artist: track.artist || "Unknown Artist",
        // optional: album, artwork
    };

    try {
        if (globalPlayer) {
            // Replace source and update lock-screen metadata
            globalPlayer.replace({ uri: decodedUrl });
            globalPlayer.setActiveForLockScreen(true, trackMetadata);
            globalPlayer.play();
        } else {
            // Create player instance and enable lock-screen metadata
            globalPlayer = createAudioPlayer(
                { uri: decodedUrl },
                { updateInterval: 500 }
            );
            globalPlayer.setActiveForLockScreen(true, trackMetadata);
            globalPlayer.play();
        }
        console.log(
            `Player: Now playing "${track.title}" in foreground system service`
        );
    } catch (error) {
        console.error("Player: Failed to play track via expo-audio", error);
    }
}

/**
 * Pause playback.
 */
export async function pausePlayback() {
    try {
        if (globalPlayer) {
            globalPlayer.pause();
        }
    } catch (error) {
        console.warn("Player: Pause failed", error);
    }
}

/**
 * Toggle play/pause.
 */
export async function togglePlayback() {
    try {
        if (!globalPlayer) return;

        if (globalPlayer.playing) {
            globalPlayer.pause();
        } else {
            globalPlayer.play();
        }
    } catch (error) {
        console.warn("Player: Toggle failed", error);
    }
}

/**
 * Return the current player instance (useful for UI subscriptions).
 */
export function getPlayerInstance(): AudioPlayer {
    return globalPlayer || createAudioPlayer({ uri: "", name: "" });
}

export default {
    playTrack,
    pausePlayback,
    togglePlayback,
    getPlayerInstance,
    initPlayer,
};

export async function initPlayer() {
    await configureAudioMode();
}
