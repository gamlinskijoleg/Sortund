import {
    AudioPlayer,
    createAudioPlayer,
    AudioModule,
    AudioMetadata,
    AudioLockScreenOptions,
} from "expo-audio";
import { Image } from "react-native";
import { Directory, File, Paths } from "expo-file-system";
import { getArtwork } from "react-native-audio-metadata";
import type { MusicTrack } from "../data/music";
import { usePlayerStore } from "@/store/usePlayerStore";

let initialized = false;
let playbackToken = 0;

let onNextTrackHandler: (() => void) | null = null;
let onPreviousTrackHandler: (() => void) | null = null;

// Зберігаємо посилання на попередній трек для запобігання зацикленню
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
        initialized = true;
        console.log("Player: AudioMode configured successfully");
    } catch (error) {
        console.warn("Player: Failed to configure AudioMode", error);
    }
}

export function setTrackNavigationCallbacks(
    onNext: () => void,
    onPrev: () => void
) {
    onNextTrackHandler = onNext;
    onPreviousTrackHandler = onPrev;
}

/**
 * Очищає URI для бібліотеки метаданих, роблячи його зрозумілим для нативної частини Android
 */
function preparePathForMetadata(uri: string): string {
    let clean = uri;
    if (clean.startsWith("file://")) {
        clean = clean.replace("file://", "");
    }
    return decodeURIComponent(clean);
}

/**
 * Допоміжна функція: зберігає base64 стрінгу у локальний файл
 */
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
        console.warn(
            "Player: Failed to save base64 artwork string to file",
            error
        );
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

    const trackMetadata: AudioMetadata = {
        title: track.title,
        artist: track.artist || "Unknown Artist",
        albumTitle: track.albumTitle,
        ...(track.artworkUrl
            ? { artworkUrl: track.artworkUrl }
            : fallbackArtworkUrl
              ? { artworkUrl: fallbackArtworkUrl }
              : {}),
    };

    const lockScreenOptions: AudioLockScreenOptions = {
        showSeekBackward: true,
        showSeekForward: true,
        isLiveStream: false,
    };

    let activePlayer = usePlayerStore.getState().playerInstance;

    try {
        if (!activePlayer) {
            console.log(
                "Player: Creating player instance on-demand (fallback)"
            );
            activePlayer = createAudioPlayer(
                { uri: playerUri },
                { updateInterval: 500 }
            );
            usePlayerStore.getState().setPlayerInstance(activePlayer);
            setupNotificationListeners();
        } else {
            activePlayer.replace({ uri: playerUri });
        }

        activePlayer.setActiveForLockScreen(
            true,
            trackMetadata,
            lockScreenOptions
        );

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
                        playerForArtwork.updateLockScreenMetadata({
                            ...trackMetadata,
                            artworkUrl: finalArtworkUri,
                        });
                        track.artworkUrl = finalArtworkUri;
                    }
                })
                .catch((error) => {
                    console.warn(
                        `Player: Artwork extraction failed:`,
                        error.message
                    );
                });
        }

        console.log(`Player: Now playing "${track.title}"`);
    } catch (error) {
        console.error("Player: Failed to play track via expo-audio", error);
    }
}

function setupNotificationListeners() {
    (AudioModule as any).addListener(
        "notificationCommandReceived",
        (event: { command: string }) => {
            if (event.command === "skipToNext" && onNextTrackHandler) {
                onNextTrackHandler();
            } else if (
                event.command === "skipToPrevious" &&
                onPreviousTrackHandler
            ) {
                onPreviousTrackHandler();
            }
        }
    );
}

export async function pausePlayback() {
    try {
        const player = usePlayerStore.getState().playerInstance;
        if (player) player.pause();
    } catch (error) {
        console.warn(error);
    }
}

export async function togglePlayback() {
    try {
        const player = usePlayerStore.getState().playerInstance;
        if (!player) return;
        if (player.playing) player.pause();
        else player.play();
    } catch (error) {
        console.warn(error);
    }
}

export function getPlayerInstance(): AudioPlayer | null {
    return usePlayerStore.getState().playerInstance;
}

// ВИПРАВЛЕНО: Автоматичний запуск і робота без помилок сигнатур типів
export async function initPlayer() {
    await configureAudioMode();

    let activePlayer = usePlayerStore.getState().playerInstance;
    if (!activePlayer) {
        console.log("⚙️ Player: Pre-initializing global audio player...");
        activePlayer = createAudioPlayer({ uri: "" }, { updateInterval: 500 });
        usePlayerStore.getState().setPlayerInstance(activePlayer);
        setupNotificationListeners();

        // 1. Прив'язуємо залізні кнопки шторки/LockScreen до екшенів нашого Zustand-стору
        setTrackNavigationCallbacks(
            () => usePlayerStore.getState().playNext(),
            () => usePlayerStore.getState().playPrevious()
        );

        // 2. ВИПРАВЛЕНО: Чиста підписка на весь стейт з ручним порівнянням по sourceUri
        usePlayerStore.subscribe((state) => {
            const newTrack = state.activeTrack;

            if (newTrack) {
                // Перевіряємо за унікальним шляхом до аудіофайлу, оскільки ID немає
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
