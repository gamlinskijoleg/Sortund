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

let globalPlayer: AudioPlayer | null = null;
let initialized = false;
let playbackToken = 0;

let onNextTrackHandler: (() => void) | null = null;
let onPreviousTrackHandler: (() => void) | null = null;

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

    // Перевіряємо, чи нам випадково не підсунули сирий data: URL в об'єкті треку
    if (track.artworkUrl && track.artworkUrl.startsWith("data:")) {
        console.log(
            `⏳ Плеєр: Виявлено сирий base64 в треку "${track.title}". Перетворюємо у файл...`
        );
        const cachedFileUri = await saveBase64ToCacheFile(
            track.artworkUrl,
            track.assetId
        );
        if (cachedFileUri) {
            track.artworkUrl = cachedFileUri;
        } else {
            track.artworkUrl = undefined; // Скидаємо, щоб не крашити натів
        }
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

    try {
        const activePlayer =
            globalPlayer ||
            createAudioPlayer({ uri: playerUri }, { updateInterval: 500 });

        if (globalPlayer) {
            globalPlayer.replace({ uri: playerUri });
        } else {
            globalPlayer = activePlayer;

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

        activePlayer.setActiveForLockScreen(
            true,
            trackMetadata,
            lockScreenOptions
        );
        activePlayer.play();

        // Якщо кавера немає взагалі, запускаємо фонове сканування
        if (!track.artworkUrl) {
            const cleanMetadataUri = preparePathForMetadata(track.sourceUri);

            void getArtwork(cleanMetadataUri)
                .then(async (artworkResult) => {
                    if (
                        !artworkResult ||
                        playbackToken !== currentToken ||
                        globalPlayer !== activePlayer
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

                    // Важливо: Робимо update лише якщо отримали легітимний шлях (НЕ data:)
                    if (
                        finalArtworkUri &&
                        !finalArtworkUri.startsWith("data:")
                    ) {
                        activePlayer.updateLockScreenMetadata({
                            ...trackMetadata,
                            artworkUrl: finalArtworkUri,
                        });
                        track.artworkUrl = finalArtworkUri;
                        console.log(
                            `✅ Плеєр: Обкладинку успішно встановлено для "${track.title}"`
                        );
                    }
                })
                .catch((error) => {
                    console.warn(
                        `Player: Artwork extraction failed for "${track.title}":`,
                        error.message
                    );
                });
        }

        console.log(`Player: Now playing "${track.title}"`);
    } catch (error) {
        console.error("Player: Failed to play track via expo-audio", error);
    }
}

export async function pausePlayback() {
    try {
        if (globalPlayer) globalPlayer.pause();
    } catch (error) {
        console.warn(error);
    }
}

export async function togglePlayback() {
    try {
        if (!globalPlayer) return;
        if (globalPlayer.playing) globalPlayer.pause();
        else globalPlayer.play();
    } catch (error) {
        console.warn(error);
    }
}

export function getPlayerInstance(): AudioPlayer {
    return globalPlayer || createAudioPlayer({ uri: "", name: "" });
}

export async function initPlayer() {
    await configureAudioMode();
}

export default {
    initPlayer,
    playTrack,
    pausePlayback,
    togglePlayback,
    getPlayerInstance,
    setTrackNavigationCallbacks,
};
