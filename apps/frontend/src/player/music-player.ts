import { AudioPlayer, createAudioPlayer, AudioModule } from "expo-audio";
import { Image } from "react-native";
import { Directory, File, Paths } from "expo-file-system";
import { getArtwork } from "react-native-audio-metadata";
import {
    enableMediaControls,
    Command,
    updatePlaybackState,
    PlaybackState,
    addListener,
    MediaControlEvent,
    updateMetadata,
    MediaMetadata,
} from "expo-media-control";
import type { MusicTrack } from "../data/music";
import { usePlayerStore } from "@/store/usePlayerStore";
import { log } from "@/utils/logger";

let initialized = false;
let playbackToken = 0;
let currentMediaMetadata: MediaMetadata | null = null;

let onNextTrackHandler: (() => void) | null = null;
let onPreviousTrackHandler: (() => void) | null = null;

let lastTrack: MusicTrack | null = null;

const resolvedAsset = Image.resolveAssetSource(
    require("../../assets/icon.png")
);
const fallbackArtworkUrl = resolvedAsset?.uri?.startsWith("data:")
    ? undefined
    : resolvedAsset?.uri;

async function configureAudioMode() {
    if (initialized) return;
    try {
        await AudioModule.setAudioModeAsync({
            playsInSilentMode: true,
            shouldPlayInBackground: true,
            interruptionMode: "doNotMix",
            shouldRouteThroughEarpiece: false,
        });

        enableMediaControls({
            capabilities: [
                Command.PLAY,
                Command.PAUSE,
                Command.NEXT_TRACK,
                Command.PREVIOUS_TRACK,
                Command.SEEK,
            ],
            compactCapabilities: [
                Command.PREVIOUS_TRACK,
                Command.PLAY,
                Command.NEXT_TRACK,
            ],
        });

        initialized = true;
        log.debug("Player: AudioMode & MediaControls configured successfully");
    } catch (error) {
        log.warn("Player: Failed to configure AudioMode/MediaControls", error);
    }
}

export function setTrackNavigationCallbacks(
    onNext: () => void,
    onPrev: () => void
) {
    onNextTrackHandler = onNext;
    onPreviousTrackHandler = onPrev;
}

function preparePathForMetadata(uri: string): string {
    let clean = uri;
    if (clean.startsWith("file://")) {
        clean = clean.replace("file://", "");
    }
    return decodeURIComponent(clean);
}

async function saveBase64ToCacheFile(
    base64WithPrefix: string,
    assetId?: string
): Promise<string | null> {
    try {
        const regex = /^data:image\/\w+;base64,/;
        const base64Data = base64WithPrefix.replace(regex, "");

        const cacheDir = new Directory(Paths.cache, "subdirName");
        const filename = `cover_${assetId || Date.now()}.png`;
        const targetFile = new File(cacheDir, filename);

        targetFile.write(base64Data, { encoding: "base64" });
        return targetFile.uri;
    } catch (error) {
        log.warn("Player: Failed to save base64 artwork string to file", error);
        return null;
    }
}

export async function playTrack(track: MusicTrack) {
    await configureAudioMode();

    const playerUri = track.sourceUri.includes("%")
        ? track.sourceUri
        : encodeURI(track.sourceUri);
    const currentToken = ++playbackToken;

    if (track.artworkUrl && track.artworkUrl.startsWith("data:")) {
        const cachedFileUri = await saveBase64ToCacheFile(
            track.artworkUrl,
            track.assetId
        );
        if (cachedFileUri) track.artworkUrl = cachedFileUri;
        else track.artworkUrl = undefined;
    }

    const artworkUri = track.artworkUrl || fallbackArtworkUrl || "";

    const mediaControlMetadata: MediaMetadata = {
        title: track.title,
        artist: track.artist,
        album: track.albumTitle || "",
        artwork: { uri: artworkUri },
        duration: track.duration / 1000,
        elapsedTime: 0,
    };

    currentMediaMetadata = mediaControlMetadata;

    try {
        updateMetadata(mediaControlMetadata);
    } catch (metaError) {
        log.warn("Player: Failed to update MediaControl metadata", metaError);
    }

    let activePlayer = usePlayerStore.getState().playerInstance;

    try {
        if (!activePlayer) {
            log.debug("Player: Creating player instance on-demand (fallback)");
            activePlayer = createAudioPlayer(
                { uri: playerUri },
                { updateInterval: 500 }
            );
            usePlayerStore.getState().setPlayerInstance(activePlayer);
            setupNotificationListeners();
            setupPlaybackStatusListener(activePlayer);
        } else {
            activePlayer.replace({ uri: playerUri });
        }

        setTimeout(() => {
            if (activePlayer) {
                activePlayer.play();
            }
        }, 50);

        if (!track.artworkUrl) {
            const cleanMetadataUri = preparePathForMetadata(track.sourceUri);
            const playerForArtwork = activePlayer;

            void getArtwork(cleanMetadataUri)
                .then(async (artworkResult) => {
                    const latestPlayer =
                        usePlayerStore.getState().playerInstance;
                    if (
                        !artworkResult ||
                        playbackToken !== currentToken ||
                        latestPlayer !== playerForArtwork ||
                        !playerForArtwork
                    ) {
                        return;
                    }

                    let finalArtworkUri: string | null = null;
                    if (artworkResult.startsWith("data:")) {
                        finalArtworkUri = await saveBase64ToCacheFile(
                            artworkResult,
                            track.assetId
                        );
                    } else if (
                        artworkResult.startsWith("file://") ||
                        artworkResult.startsWith("http")
                    ) {
                        finalArtworkUri = artworkResult;
                    }

                    if (
                        finalArtworkUri &&
                        !finalArtworkUri.startsWith("data:")
                    ) {
                        track.artworkUrl = finalArtworkUri;

                        const updatedMetadata: MediaMetadata = {
                            title: track.title,
                            artist: track.artist,
                            album: track.albumTitle || "",
                            artwork: { uri: finalArtworkUri },
                            duration: track.duration / 1000,
                            elapsedTime: currentMediaMetadata?.elapsedTime ?? 0,
                        };

                        try {
                            log.debug(
                                "Player: Updating MediaControl with newly extracted artwork"
                            );
                            currentMediaMetadata = updatedMetadata;
                            updateMetadata(updatedMetadata);
                        } catch (e) {
                            log.warn(
                                "Player: Dynamic artwork update failed",
                                e
                            );
                        }
                    }
                })
                .catch((error) => {
                    log.warn(
                        `Player: Artwork extraction failed:`,
                        error.message
                    );
                });
        }

        log.debug(`Player: Now playing "${track.title}"`);
    } catch (error) {
        log.error("Player: Failed to play track via expo-audio", error);
    }
}

let mediaControlSubscription: (() => void) | null = null;

function setupNotificationListeners() {
    if (mediaControlSubscription) {
        mediaControlSubscription();
    }

    mediaControlSubscription = addListener((event: MediaControlEvent) => {
        switch (event.command) {
            case Command.NEXT_TRACK:
            case "nextTrack":
                if (onNextTrackHandler) {
                    log.debug("MediaControl: Hardware Next Track triggered");
                    onNextTrackHandler();
                } else {
                    log.warn(
                        "MediaControl: Next track triggered, but onNextTrackHandler is null"
                    );
                }
                break;

            case Command.PREVIOUS_TRACK:
            case "previousTrack":
                if (onPreviousTrackHandler) {
                    log.debug(
                        "MediaControl: Hardware Previous Track triggered"
                    );
                    onPreviousTrackHandler();
                } else {
                    log.warn(
                        "MediaControl: Previous track triggered, but onPreviousTrackHandler is null"
                    );
                }
                break;

            case Command.PLAY:
            case "play":
                log.debug("MediaControl: Hardware Play triggered");
                usePlayerStore.getState().playerInstance?.play();
                break;

            case Command.PAUSE:
            case "pause":
                log.debug("MediaControl: Hardware Pause triggered");
                usePlayerStore.getState().playerInstance?.pause();
                break;

            case Command.SEEK:
            case "seek": {
                const player = usePlayerStore.getState().playerInstance;
                const seekPositionSeconds =
                    typeof event.data?.position === "number"
                        ? event.data.position
                        : typeof event.timestamp === "number"
                          ? event.timestamp / 1000
                          : undefined;

                if (player && typeof seekPositionSeconds === "number") {
                    player.seekTo(seekPositionSeconds);
                    // Не потрібно викликати updateMetadata вручну, якщо ви
                    // вже передали позицію в updatePlaybackState вище
                }
                break;
            }

            default:
                log.debug("MediaControl: Unhandled media action", event);
        }
    });
}

function setupPlaybackStatusListener(player: AudioPlayer) {
    player.addListener("playbackStatusUpdate", (status) => {
        let state = status.playing
            ? PlaybackState.PLAYING
            : PlaybackState.PAUSED;
        if (status.isBuffering) state = PlaybackState.BUFFERING;

        updatePlaybackState(state, status.currentTime, status.playbackRate);
    });
}
export async function pausePlayback() {
    try {
        const player = usePlayerStore.getState().playerInstance;
        if (player) player.pause();
    } catch (error) {
        log.warn("Player: Failed to pause playback", error);
    }
}

export async function togglePlayback() {
    try {
        const player = usePlayerStore.getState().playerInstance;
        if (!player) return;
        if (player.playing) player.pause();
        else player.play();
    } catch (error) {
        log.warn("Player: Failed to toggle playback", error);
    }
}

export function getPlayerInstance(): AudioPlayer | null {
    return usePlayerStore.getState().playerInstance;
}

export async function initPlayer() {
    await configureAudioMode();

    let activePlayer = usePlayerStore.getState().playerInstance;
    if (!activePlayer) {
        log.debug("⚙️ Player: Pre-initializing global audio player...");
        activePlayer = createAudioPlayer({ uri: "" }, { updateInterval: 1000 });
        usePlayerStore.getState().setPlayerInstance(activePlayer);
        setupNotificationListeners();
        setupPlaybackStatusListener(activePlayer);

        setTrackNavigationCallbacks(
            () => usePlayerStore.getState().playNext(),
            () => usePlayerStore.getState().playPrevious()
        );

        usePlayerStore.subscribe((state) => {
            const newTrack = state.activeTrack;

            if (newTrack) {
                if (!lastTrack || lastTrack.sourceUri !== newTrack.sourceUri) {
                    lastTrack = newTrack;
                    playTrack(newTrack);
                }
            } else {
                lastTrack = null;
            }
        });
    }
}

export default {
    initPlayer,
    playTrack,
    pausePlayback,
    togglePlayback,
    getPlayerInstance,
    setTrackNavigationCallbacks,
};
