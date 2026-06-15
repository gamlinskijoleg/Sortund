import { create } from "zustand";
import type { MusicTrack } from "../data/music";
import { AudioPlayer } from "expo-audio";

interface PlayerState {
    tracks: MusicTrack[];
    currentIndex: number;
    activeTrack: MusicTrack | null;
    playerInstance: AudioPlayer | null;
    isPlaying: boolean;

    // Екшени
    setPlayerInstance: (player: AudioPlayer) => void;
    setQueue: (
        tracks: MusicTrack[],
        startIndex: number,
        shouldPlay?: boolean
    ) => void;
    playNext: () => void;
    playPrevious: () => void;
    selectTrackById: (assetId: string) => void;
    togglePlayPause: (track: MusicTrack) => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => {
    const triggerNativePlay = (track: MusicTrack) => {
        if (!track) return;
    };

    return {
        tracks: [],
        currentIndex: -1,
        activeTrack: null,
        playerInstance: null,
        isPlaying: false,

        setPlayerInstance: (playerInstance) => set({ playerInstance }),

        setQueue: (tracks, startIndex, shouldPlay = true) => {
            const track = tracks[startIndex] || null;
            set({
                tracks,
                currentIndex: startIndex,
                activeTrack: track,
                isPlaying: shouldPlay,
            });

            if (track && shouldPlay) {
                triggerNativePlay(track);
            }
        },

        playNext: () => {
            const { tracks, currentIndex } = get();
            if (tracks.length === 0) {
                return;
            }

            const nextIndex = (currentIndex + 1) % tracks.length;
            const nextTrack = tracks[nextIndex];

            set({
                currentIndex: nextIndex,
                activeTrack: nextTrack,
                isPlaying: true,
            });
            triggerNativePlay(nextTrack);
        },

        playPrevious: () => {
            const { tracks, currentIndex } = get();
            if (tracks.length === 0) return;

            const prevIndex =
                (currentIndex - 1 + tracks.length) % tracks.length;
            const prevTrack = tracks[prevIndex];

            set({
                currentIndex: prevIndex,
                activeTrack: prevTrack,
                isPlaying: true,
            });
            triggerNativePlay(prevTrack);
        },

        togglePlayPause: (track) => {
            const { playerInstance, activeTrack } = get();
            if (!playerInstance) return;

            if (!activeTrack || activeTrack.assetId !== track.assetId) {
                set({ activeTrack: track });
            }

            if (playerInstance.playing) {
                playerInstance.pause();
                set({ isPlaying: false });
            } else {
                playerInstance.play();
                set({ isPlaying: true });
            }
        },

        selectTrackById: (assetId) => {
            const { tracks } = get();
            const index = tracks.findIndex((t) => t.assetId === assetId);
            if (index !== -1) {
                const track = tracks[index];
                set({ currentIndex: index, activeTrack: track });
                triggerNativePlay(track);
            }
        },
    };
});
