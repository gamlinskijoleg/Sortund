import {
    AudioPlayer,
    createAudioPlayer,
    AudioModule,
    AudioMetadata,
    AudioLockScreenOptions,
} from "expo-audio";
import { Image } from "react-native";
import { getArtwork } from "react-native-audio-metadata";
import type { MusicTrack } from "../data/music";

// Глобальний інстанс плеєра
let globalPlayer: AudioPlayer | null = null;
let initialized = false;
let playbackToken = 0;

// Нативні колбеки для керування чергою треків з UI
let onNextTrackHandler: (() => void) | null = null;
let onPreviousTrackHandler: (() => void) | null = null;

// Дефолтна обкладинка, якщо у треку немає своєї
const fallbackArtworkUrl = Image.resolveAssetSource(
    require("../../assets/icon.png")
).uri;

/**
 * Налаштування аудіорежиму для фонового відтворення та інтеграції з ОС
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
 * Реєстрація функцій перемикання треків (викликається у твоєму React-компоненті/хуці)
 */
export function setTrackNavigationCallbacks(
    onNext: () => void,
    onPrev: () => void
) {
    onNextTrackHandler = onNext;
    onPreviousTrackHandler = onPrev;
}

/**
 * Запуск треку та виведення його у системну шторку
 */
export async function playTrack(track: MusicTrack) {
    await configureAudioMode();

    const decodedUrl = decodeURI(track.sourceUri);
    const currentToken = ++playbackToken;

    const trackMetadata: AudioMetadata = {
        title: track.title,
        artist: track.artist || "Unknown Artist",
        albumTitle: track.albumTitle,
        artworkUrl: track.artworkUrl || fallbackArtworkUrl,
    };

    const lockScreenOptions: AudioLockScreenOptions = {
        showSeekBackward: true,
        showSeekForward: true,
        isLiveStream: false,
    };

    try {
        const activePlayer =
            globalPlayer ||
            createAudioPlayer({ uri: decodedUrl }, { updateInterval: 500 });

        if (globalPlayer) {
            // Якщо плеєр уже створений, просто змінюємо аудіо-сорц
            globalPlayer.replace({ uri: decodedUrl });
        } else {
            globalPlayer = activePlayer;

            // Кастимо AudioModule в any, щоб обійти суворий TEventsMap компілятора,
            // оскільки нативна подія "notificationCommandReceived" летить безпосередньо з системи.
            (AudioModule as any).addListener(
                "notificationCommandReceived",
                (event: { command: string }) => {
                    console.log(
                        "Отримано нативну команду зі шторки:",
                        event.command
                    );

                    if (event.command === "skipToNext" && onNextTrackHandler) {
                        console.log("Шторка ОС: клік Next");
                        onNextTrackHandler();
                    } else if (
                        event.command === "skipToPrevious" &&
                        onPreviousTrackHandler
                    ) {
                        console.log("Шторка ОС: клік Previous");
                        onPreviousTrackHandler();
                    }
                }
            );
        }

        // Оновлюємо шторку актуальними кнопками та інфою
        activePlayer.setActiveForLockScreen(
            true,
            trackMetadata,
            lockScreenOptions
        );
        activePlayer.play();

        // Якщо у треку немає готової обкладинки, витягуємо її асинхронно з файлу
        if (!track.artworkUrl) {
            void getArtwork(decodedUrl)
                .then((artworkUrl) => {
                    if (
                        !artworkUrl ||
                        playbackToken !== currentToken ||
                        globalPlayer !== activePlayer
                    ) {
                        return;
                    }

                    activePlayer.updateLockScreenMetadata({
                        ...trackMetadata,
                        artworkUrl,
                    });
                })
                .catch((error) => {
                    console.warn(
                        "Player: Failed to load lock-screen artwork",
                        error
                    );
                });
        }

        console.log(
            `Player: Now playing "${track.title}" in foreground system service`
        );
    } catch (error) {
        console.error("Player: Failed to play track via expo-audio", error);
    }
}

/**
 * Пауза
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
 * Перемикач Play / Pause
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
 * Отримання поточного інстансу плеєра для підписки на прогрес-бар (UI)
 */
export function getPlayerInstance(): AudioPlayer {
    return globalPlayer || createAudioPlayer({ uri: "", name: "" });
}

/**
 * Ініціалізація плеєра (можна викликати при старті додатка)
 */
export async function initPlayer() {
    await configureAudioMode();
}

// Експорт за замовчуванням усього модуля
export default {
    initPlayer,
    playTrack,
    pausePlayback,
    togglePlayback,
    getPlayerInstance,
    setTrackNavigationCallbacks,
};
