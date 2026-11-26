import { findDuplicates, type DuplicateGroup } from "../library/duplicates";
import { create } from "zustand";
import type { MusicTrack } from "../data/types";
import { AudioPlayer } from "expo-audio";

export type RepeatMode = "off" | "all" | "one";

interface PlayerState {
    tracks: MusicTrack[];
    /** Queue in its original order, restored when shuffle is switched off. */
    originalTracks: MusicTrack[];
    currentIndex: number;
    activeTrack: MusicTrack | null;
    playerInstance: AudioPlayer | null;
    isPlaying: boolean;
    shuffle: boolean;
    repeat: RepeatMode;

    // Library cache
    /** Library without hidden duplicates: what lists, filters, smart playlists and analysis use. */
    libraryTracks: MusicTrack[];
    /** Every scanned file, including hidden duplicates; use it to look tracks up by id. */
    allTracks: MusicTrack[];
    /** Groups of identical files (the same audio in several folders). */
    duplicateGroups: DuplicateGroup[];
    isLibraryLoading: boolean;
    hasSynced: boolean;

    setPlayerInstance: (player: AudioPlayer) => void;
    setQueue: (tracks: MusicTrack[], startIndex: number, shouldPlay?: boolean) => void;
    playNext: () => void;
    /** Called when a track ends by itself — honours "repeat one" and "repeat off". */
    handleTrackFinished: () => "replay" | "next" | "stop";
    playPrevious: () => void;
    selectTrackById: (assetId: string) => void;
    togglePlayPause: (track: MusicTrack) => void;
    toggleShuffle: () => void;
    cycleRepeat: () => void;

    setLibraryTracks: (tracks: MusicTrack[]) => void;
    setLibraryLoading: (loading: boolean) => void;
    setHasSynced: (synced: boolean) => void;
}

/** Fisher–Yates shuffle that keeps `first` at position 0. */
export function shuffleQueue(tracks: MusicTrack[], first: MusicTrack | null): MusicTrack[] {
    const rest = tracks.filter((t) => t !== first);
    for (let i = rest.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rest[i], rest[j]] = [rest[j]!, rest[i]!];
    }
    return first ? [first, ...rest] : rest;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
    tracks: [],
    originalTracks: [],
    currentIndex: -1,
    activeTrack: null,
    playerInstance: null,
    isPlaying: false,
    shuffle: false,
    repeat: "all",

    libraryTracks: [],
    allTracks: [],
    duplicateGroups: [],
    isLibraryLoading: true,
    hasSynced: false,

    setLibraryTracks: (tracks) => {
        // Keep queue entries in sync with edited track data (titles, artwork).
        const byId = new Map(tracks.map((t) => [t.assetId, t]));
        const { activeTrack, tracks: queue } = get();
        const { visible, groups } = findDuplicates(tracks);
        set({
            libraryTracks: visible,
            allTracks: tracks,
            duplicateGroups: groups,
            tracks: queue.map((t) => byId.get(t.assetId) ?? t),
            activeTrack: activeTrack ? (byId.get(activeTrack.assetId) ?? activeTrack) : null,
        });
    },
    setLibraryLoading: (loading) => set({ isLibraryLoading: loading }),
    setHasSynced: (synced) => set({ hasSynced: synced }),
    setPlayerInstance: (playerInstance) => set({ playerInstance }),

    setQueue: (tracks, startIndex, shouldPlay = true) => {
        const track = tracks[startIndex] || null;
        if (get().shuffle && tracks.length > 1) {
            set({
                originalTracks: tracks,
                tracks: shuffleQueue(tracks, track),
                currentIndex: track ? 0 : -1,
                activeTrack: track,
                isPlaying: shouldPlay,
            });
            return;
        }
        set({
            tracks,
            originalTracks: tracks,
            currentIndex: startIndex,
            activeTrack: track,
            isPlaying: shouldPlay,
        });
    },

    playNext: () => {
        const { tracks, currentIndex, repeat } = get();
        if (tracks.length === 0) return;
        const atEnd = currentIndex + 1 >= tracks.length;
        if (atEnd && repeat === "off") {
            set({ isPlaying: false });
            return;
        }
        const nextIndex = atEnd ? 0 : currentIndex + 1;
        set({ currentIndex: nextIndex, activeTrack: tracks[nextIndex]!, isPlaying: true });
    },

    handleTrackFinished: () => {
        const { repeat, tracks, currentIndex } = get();
        if (repeat === "one") return "replay";
        if (repeat === "off" && currentIndex + 1 >= tracks.length) {
            set({ isPlaying: false });
            return "stop";
        }
        get().playNext();
        return "next";
    },

    playPrevious: () => {
        const { tracks, currentIndex } = get();
        if (tracks.length === 0) return;
        const prevIndex = (currentIndex - 1 + tracks.length) % tracks.length;
        set({ currentIndex: prevIndex, activeTrack: tracks[prevIndex]!, isPlaying: true });
    },

    togglePlayPause: (track) => {
        const { playerInstance, activeTrack } = get();
        if (!playerInstance) return;
        if (!activeTrack || activeTrack.assetId !== track.assetId) set({ activeTrack: track });
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
        if (index !== -1) set({ currentIndex: index, activeTrack: tracks[index]! });
    },

    toggleShuffle: () => {
        const { shuffle, tracks, originalTracks, activeTrack } = get();
        if (!shuffle) {
            const shuffled = shuffleQueue(tracks, activeTrack);
            set({
                shuffle: true,
                originalTracks: tracks,
                tracks: shuffled,
                currentIndex: activeTrack ? 0 : -1,
            });
        } else {
            const restored = originalTracks.length ? originalTracks : tracks;
            const index = activeTrack
                ? restored.findIndex((t) => t.assetId === activeTrack.assetId)
                : -1;
            set({ shuffle: false, tracks: restored, currentIndex: index });
        }
    },

    cycleRepeat: () => {
        const order: RepeatMode[] = ["off", "all", "one"];
        const { repeat } = get();
        set({ repeat: order[(order.indexOf(repeat) + 1) % order.length]! });
    },
}));
