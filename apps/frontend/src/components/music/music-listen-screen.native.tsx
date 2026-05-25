import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import TrackPlayer, {
    PlaybackState,
    useActiveMediaItem,
    useIsPlaying,
    usePlaybackState,
    useProgress,
} from "@rntp/player";

import { AppScreen } from "../app-screen";
import { useMusicTracks } from "../../data/music";
import { startTrackPlayback } from "../../player/music-player";

function formatTime(seconds: number) {
    const safeSeconds = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(safeSeconds / 60);
    const remainder = safeSeconds % 60;

    return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export default function MusicListenScreen() {
    const params = useLocalSearchParams<{
        sourceUri?: string;
        title?: string;
        artist?: string;
        color?: string;
    }>();
    const sourceUri =
        typeof params.sourceUri === "string" && params.sourceUri.length > 0
            ? decodeURIComponent(params.sourceUri)
            : undefined;
    const fallbackTitle =
        typeof params.title === "string" ? params.title : "Local track";
    const fallbackArtist =
        typeof params.artist === "string"
            ? params.artist
            : "From your device library";
    const fallbackColor =
        typeof params.color === "string" ? params.color : "#1f2430";

    const { tracks, isLoading, error } = useMusicTracks();
    const activeItem = useActiveMediaItem();
    const isPlaying = useIsPlaying();
    const playbackState = usePlaybackState();
    const progress = useProgress(0.5);
    const [playbackError, setPlaybackError] = useState<string | null>(null);
    const preparedKeyRef = useRef<string | null>(null);
    const pendingPlayRef = useRef(false);

    const selectedTrack = useMemo(() => {
        if (!tracks.length) {
            return null;
        }

        if (sourceUri) {
            const match = tracks.find((track) => track.sourceUri === sourceUri);
            if (match) {
                return match;
            }
        }

        return tracks[0] ?? null;
    }, [sourceUri, tracks]);

    useEffect(() => {
        if (!tracks.length) {
            return;
        }

        const queueKey = `${tracks
            .map((track) => track.sourceUri ?? track.title)
            .join("|")}::${sourceUri ?? ""}`;

        if (preparedKeyRef.current === queueKey) {
            return;
        }

        let isActive = true;
        preparedKeyRef.current = queueKey;
        pendingPlayRef.current = true;

        startTrackPlayback(tracks, sourceUri).catch((loadError: unknown) => {
            if (!isActive) {
                return;
            }

            setPlaybackError(
                loadError instanceof Error
                    ? loadError.message
                    : "Unable to start playback.",
            );
        });

        return () => {
            isActive = false;
        };
    }, [sourceUri, tracks]);

    useEffect(() => {
        if (!pendingPlayRef.current) {
            return;
        }

        if (playbackState !== PlaybackState.Ready) {
            return;
        }

        pendingPlayRef.current = false;

        TrackPlayer.play();
    }, [playbackState]);

    const activeTitle = activeItem?.title ?? selectedTrack?.title ?? fallbackTitle;
    const activeArtist =
        activeItem?.artist ?? selectedTrack?.artist ?? fallbackArtist;
    const activeColor = selectedTrack?.color ?? fallbackColor;
    const totalSeconds = progress.duration || selectedTrack?.duration || 0;
    const playedSeconds = progress.position;
    const bufferedSeconds = progress.buffered;
    const playedWidth =
        totalSeconds > 0 ? Math.min(100, (playedSeconds / totalSeconds) * 100) : 0;
    const bufferedWidth =
        totalSeconds > 0 ? Math.min(100, (bufferedSeconds / totalSeconds) * 100) : 0;

    async function handlePlayPausePress() {
        try {
            if (isPlaying) {
                await TrackPlayer.pause();
                return;
            }

            if (playbackState !== PlaybackState.Ready || !activeItem) {
                pendingPlayRef.current = true;
                await startTrackPlayback(tracks, sourceUri);
                return;
            }

            TrackPlayer.play();
        } catch (loadError: unknown) {
            setPlaybackError(
                loadError instanceof Error
                    ? loadError.message
                    : "Unable to toggle playback.",
            );
        }
    }

    return (
        <AppScreen backgroundColor="#0b0d12" statusBarStyle="light">
            <View style={styles.screen}>
                <View style={styles.topRow}>
                    <Pressable
                        accessibilityRole="button"
                        onPress={() => router.back()}
                        style={styles.iconButton}
                    >
                        <MaterialCommunityIcons
                            name="chevron-left"
                            size={30}
                            color="#f8fafc"
                        />
                    </Pressable>
                    <View style={styles.topCopy}>
                        <Text style={styles.kicker}>Now playing</Text>
                        <Text style={styles.headerTitle} numberOfLines={1}>
                            Listening screen
                        </Text>
                    </View>
                    <Pressable accessibilityRole="button" style={styles.iconButton}>
                        <MaterialCommunityIcons
                            name="playlist-music"
                            size={24}
                            color="#f8fafc"
                        />
                    </Pressable>
                </View>

                <View style={styles.visualWrap}>
                    <View
                        style={[
                            styles.glow,
                            { backgroundColor: activeColor, opacity: 0.34 },
                        ]}
                    />
                    <View
                        style={[
                            styles.albumArt,
                            { backgroundColor: activeColor },
                        ]}
                    >
                        <View style={styles.albumArtOverlay} />
                        <MaterialCommunityIcons
                            name="music-note"
                            size={58}
                            color="#ffffff"
                        />
                    </View>
                </View>

                <View style={styles.trackMeta}>
                    <Text style={styles.trackTitle} numberOfLines={2}>
                        {activeTitle}
                    </Text>
                    <Text style={styles.trackArtist} numberOfLines={1}>
                        {activeArtist}
                    </Text>
                </View>

                <View style={styles.progressBlock}>
                    <View style={styles.progressLabels}>
                        <Text style={styles.progressTime}>
                            {formatTime(playedSeconds)}
                        </Text>
                        <Text style={styles.progressTime}>
                            {formatTime(totalSeconds)}
                        </Text>
                    </View>
                    <View style={styles.progressRail}>
                        <View
                            style={[
                                styles.progressBuffered,
                                { width: `${bufferedWidth}%` },
                            ]}
                        />
                        <View
                            style={[
                                styles.progressPlayed,
                                { width: `${playedWidth}%` },
                            ]}
                        />
                    </View>
                </View>

                <View style={styles.controlsRow}>
                    <Pressable
                        accessibilityRole="button"
                        onPress={() => TrackPlayer.skipToPrevious()}
                        style={styles.secondaryControl}
                    >
                        <MaterialCommunityIcons
                            name="skip-previous"
                            size={34}
                            color="#f8fafc"
                        />
                    </Pressable>
                    <Pressable
                        accessibilityRole="button"
                        onPress={() => TrackPlayer.seekBy(-15)}
                        style={styles.secondaryControl}
                    >
                        <MaterialCommunityIcons
                            name="rewind-15"
                            size={30}
                            color="#f8fafc"
                        />
                    </Pressable>
                    <Pressable
                        accessibilityRole="button"
                        onPress={() => {
                            console.log("Play/pause pressed, current state:", { isPlaying, activeItem });
                            void handlePlayPausePress();
                        }}
                        style={styles.playButton}
                    >
                        <MaterialCommunityIcons
                            name={isPlaying ? "pause" : "play"}
                            size={34}
                            color="#0b0d12"
                            style={isPlaying ? undefined : styles.playIconShift}
                        />
                    </Pressable>
                    <Pressable
                        accessibilityRole="button"
                        onPress={() => TrackPlayer.seekBy(15)}
                        style={styles.secondaryControl}
                    >
                        <MaterialCommunityIcons
                            name="fast-forward-15"
                            size={30}
                            color="#f8fafc"
                        />
                    </Pressable>
                    <Pressable
                        accessibilityRole="button"
                        onPress={() => TrackPlayer.skipToNext()}
                        style={styles.secondaryControl}
                    >
                        <MaterialCommunityIcons
                            name="skip-next"
                            size={34}
                            color="#f8fafc"
                        />
                    </Pressable>
                </View>

                <View style={styles.footerCard}>
                    <View style={styles.footerChip} />
                    <Text style={styles.footerTitle}>Local library playback</Text>
                    <Text style={styles.footerText} numberOfLines={2}>
                        {isLoading
                            ? "Preparing your audio library..."
                            : playbackError || error || "Tap a track to start listening."}
                    </Text>
                </View>
            </View>
        </AppScreen>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 16,
    },
    topRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 28,
    },
    iconButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: "rgba(255,255,255,0.08)",
        justifyContent: "center",
        alignItems: "center",
    },
    topCopy: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    kicker: {
        color: "rgba(248,250,252,0.68)",
        fontSize: 12,
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: 1.2,
    },
    headerTitle: {
        color: "#f8fafc",
        fontSize: 16,
        fontWeight: "700",
        marginTop: 2,
    },
    visualWrap: {
        alignItems: "center",
        justifyContent: "center",
        marginTop: 12,
        marginBottom: 24,
        minHeight: 300,
    },
    glow: {
        position: "absolute",
        width: 280,
        height: 280,
        borderRadius: 140,
        opacity: 0.28,
        transform: [{ scale: 1.2 }],
    },
    albumArt: {
        width: 254,
        height: 254,
        borderRadius: 42,
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
        shadowColor: "#000000",
        shadowOpacity: 0.3,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 16 },
        elevation: 18,
    },
    albumArtOverlay: {
        backgroundColor: "rgba(255,255,255,0.08)",
    },
    trackMeta: {
        alignItems: "center",
        marginBottom: 22,
    },
    trackTitle: {
        color: "#f8fafc",
        fontSize: 28,
        lineHeight: 34,
        fontWeight: "800",
        textAlign: "center",
    },
    trackArtist: {
        color: "rgba(248,250,252,0.72)",
        fontSize: 16,
        fontWeight: "500",
        marginTop: 10,
        textAlign: "center",
    },
    progressBlock: {
        marginBottom: 28,
    },
    progressLabels: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 10,
    },
    progressTime: {
        color: "rgba(248,250,252,0.7)",
        fontSize: 13,
        fontWeight: "600",
    },
    progressRail: {
        height: 10,
        borderRadius: 999,
        overflow: "hidden",
        backgroundColor: "rgba(255,255,255,0.12)",
    },
    progressBuffered: {
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        backgroundColor: "rgba(255,255,255,0.22)",
    },
    progressPlayed: {
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        backgroundColor: "#ffffff",
    },
    controlsRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 24,
    },
    secondaryControl: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: "rgba(255,255,255,0.08)",
        justifyContent: "center",
        alignItems: "center",
    },
    playButton: {
        width: 84,
        height: 84,
        borderRadius: 42,
        backgroundColor: "#ffffff",
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#000000",
        shadowOpacity: 0.24,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 12 },
        elevation: 16,
    },
    playIconShift: {
        marginLeft: 4,
    },
    footerCard: {
        borderRadius: 24,
        padding: 18,
        backgroundColor: "rgba(255,255,255,0.08)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.12)",
    },
    footerChip: {
        width: 52,
        height: 5,
        borderRadius: 999,
        backgroundColor: "rgba(255,255,255,0.32)",
        marginBottom: 14,
    },
    footerTitle: {
        color: "#f8fafc",
        fontSize: 18,
        fontWeight: "700",
        marginBottom: 8,
    },
    footerText: {
        color: "rgba(248,250,252,0.76)",
        fontSize: 14,
        lineHeight: 20,
    },
});
