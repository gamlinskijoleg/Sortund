import { create } from "zustand";
import type { MusicTrack } from "../data/music";
import { playTrack, setTrackNavigationCallbacks } from "../player/music-player";

interface PlayerState {
    tracks: MusicTrack[]; // Уся активна черга треків
    currentIndex: number; // Індекс поточного треку
    activeTrack: MusicTrack | null; // Об'єкт активного треку

    // Екшени
    setQueue: (tracks: MusicTrack[], startIndex: number) => void;
    playNext: () => void;
    playPrevious: () => void;
    selectTrackById: (assetId: string) => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => {
    const triggerNativePlay = (track: MusicTrack) => {
        if (!track) return;
        playTrack(track);
    };

    setTrackNavigationCallbacks(
        () => get().playNext(),
        () => get().playPrevious()
    );

    return {
        tracks: [],
        currentIndex: -1,
        activeTrack: null,

        // Додали параметр shouldPlay, щоб контролювати автостарт
        setQueue: (tracks, startIndex, shouldPlay = true) => {
            const track = tracks[startIndex] || null;
            set({ tracks, currentIndex: startIndex, activeTrack: track });

            if (track && shouldPlay) {
                triggerNativePlay(track);
            }
        },

        playNext: () => {
            const { tracks, currentIndex } = get();
            if (tracks.length === 0) return;

            const nextIndex = (currentIndex + 1) % tracks.length;
            const nextTrack = tracks[nextIndex];

            set({ currentIndex: nextIndex, activeTrack: nextTrack });
            triggerNativePlay(nextTrack);
        },

        playPrevious: () => {
            const { tracks, currentIndex } = get();
            if (tracks.length === 0) return;

            const prevIndex =
                (currentIndex - 1 + tracks.length) % tracks.length;
            const prevTrack = tracks[prevIndex];

            set({ currentIndex: prevIndex, activeTrack: prevTrack });
            triggerNativePlay(prevTrack);
        },

        // ВИПРАВЛЕНО: тепер цей метод запускає відтворення нового вибраного треку
        selectTrackById: (assetId) => {
            const { tracks } = get();
            const index = tracks.findIndex((t) => t.assetId === assetId);
            if (index !== -1) {
                const track = tracks[index];
                set({ currentIndex: index, activeTrack: track });
                triggerNativePlay(track); // Запускаємо нативний плеєр!
            }
        },
    };
});
