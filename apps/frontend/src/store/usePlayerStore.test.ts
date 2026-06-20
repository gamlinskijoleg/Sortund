import { usePlayerStore } from "./usePlayerStore";
import type { MusicTrack } from "../data/music";
import { AudioPlayer } from "expo-audio";

// Mock the tracks data
const mockTracks: MusicTrack[] = [
    { assetId: "1", title: "Track 1", artist: "Artist 1", duration: 100 },
    { assetId: "2", title: "Track 2", artist: "Artist 2", duration: 200 },
    { assetId: "3", title: "Track 3", artist: "Artist 3", duration: 300 },
] as MusicTrack[];

describe("usePlayerStore", () => {
    beforeEach(() => {
        // Reset the store state before each test
        usePlayerStore.setState({
            tracks: [],
            currentIndex: -1,
            activeTrack: null,
            playerInstance: null,
            isPlaying: false,
            libraryTracks: [],
            isLibraryLoading: true,
            hasSynced: false,
        });
    });

    describe("setQueue", () => {
        it("should set the queue and start playing by default", () => {
            usePlayerStore.getState().setQueue(mockTracks, 0);

            const state = usePlayerStore.getState();
            expect(state.tracks).toEqual(mockTracks);
            expect(state.currentIndex).toBe(0);
            expect(state.activeTrack).toEqual(mockTracks[0]);
            expect(state.isPlaying).toBe(true);
        });

        it("should set the queue but not start playing if shouldPlay is false", () => {
            usePlayerStore.getState().setQueue(mockTracks, 1, false);

            const state = usePlayerStore.getState();
            expect(state.tracks).toEqual(mockTracks);
            expect(state.currentIndex).toBe(1);
            expect(state.activeTrack).toEqual(mockTracks[1]);
            expect(state.isPlaying).toBe(false);
        });
    });

    describe("playNext", () => {
        it("should do nothing if queue is empty", () => {
            usePlayerStore.getState().playNext();

            const state = usePlayerStore.getState();
            expect(state.currentIndex).toBe(-1);
            expect(state.activeTrack).toBeNull();
        });

        it("should play the next track and loop to the start", () => {
            usePlayerStore.getState().setQueue(mockTracks, 2, false);
            usePlayerStore.getState().playNext();

            const state = usePlayerStore.getState();
            expect(state.currentIndex).toBe(0);
            expect(state.activeTrack).toEqual(mockTracks[0]);
            expect(state.isPlaying).toBe(true);
        });
    });

    describe("playPrevious", () => {
        it("should play the previous track and loop to the end", () => {
            usePlayerStore.getState().setQueue(mockTracks, 0, false);
            usePlayerStore.getState().playPrevious();

            const state = usePlayerStore.getState();
            expect(state.currentIndex).toBe(2);
            expect(state.activeTrack).toEqual(mockTracks[2]);
            expect(state.isPlaying).toBe(true);
        });
    });

    describe("togglePlayPause", () => {
        it("should pause if currently playing the same track", () => {
            const pauseMock = jest.fn();
            const playMock = jest.fn();
            const mockPlayerInstance = {
                playing: true,
                pause: pauseMock,
                play: playMock,
            } as unknown as AudioPlayer;

            usePlayerStore.setState({
                playerInstance: mockPlayerInstance,
                activeTrack: mockTracks[0],
            });
            usePlayerStore.getState().togglePlayPause(mockTracks[0]!);

            const state = usePlayerStore.getState();
            expect(pauseMock).toHaveBeenCalled();
            expect(state.isPlaying).toBe(false);
        });

        it("should play if currently paused", () => {
            const pauseMock = jest.fn();
            const playMock = jest.fn();
            const mockPlayerInstance = {
                playing: false,
                pause: pauseMock,
                play: playMock,
            } as unknown as AudioPlayer;

            usePlayerStore.setState({
                playerInstance: mockPlayerInstance,
                activeTrack: mockTracks[0],
            });
            usePlayerStore.getState().togglePlayPause(mockTracks[0]!);

            const state = usePlayerStore.getState();
            expect(playMock).toHaveBeenCalled();
            expect(state.isPlaying).toBe(true);
        });

        it("should update activeTrack if a new track is toggled", () => {
            const pauseMock = jest.fn();
            const playMock = jest.fn();
            const mockPlayerInstance = {
                playing: false,
                pause: pauseMock,
                play: playMock,
            } as unknown as AudioPlayer;

            usePlayerStore.setState({
                playerInstance: mockPlayerInstance,
                activeTrack: mockTracks[0],
            });
            usePlayerStore.getState().togglePlayPause(mockTracks[1]!);

            const state = usePlayerStore.getState();
            expect(state.activeTrack).toEqual(mockTracks[1]);
            expect(playMock).toHaveBeenCalled();
            expect(state.isPlaying).toBe(true);
        });
    });

    describe("selectTrackById", () => {
        it("should select the correct track", () => {
            usePlayerStore.getState().setQueue(mockTracks, 0, false);
            usePlayerStore.getState().selectTrackById("2");

            const state = usePlayerStore.getState();
            expect(state.currentIndex).toBe(1);
            expect(state.activeTrack).toEqual(mockTracks[1]);
        });
    });
});
