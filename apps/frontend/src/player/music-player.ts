import { Platform } from "react-native";

import type { MusicTrack } from "../data/music";

async function loadNativePlayer() {
    return import("./music-player.native");
}

export async function initPlayer() {
    if (Platform.OS === "web") {
        return;
    }

    const player = await loadNativePlayer();
    return player.initPlayer();
}

export async function playTrack(track: MusicTrack) {
    if (Platform.OS === "web") {
        return;
    }

    const player = await loadNativePlayer();
    return player.playTrack(track);
}

export async function pausePlayback() {
    if (Platform.OS === "web") {
        return;
    }

    const player = await loadNativePlayer();
    return player.pausePlayback();
}

export async function togglePlayback() {
    if (Platform.OS === "web") {
        return;
    }

    const player = await loadNativePlayer();
    return player.togglePlayback();
}

export default {
    initPlayer,
    playTrack,
    pausePlayback,
    togglePlayback,
};
