import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "../app-screen";
import { playTrack } from "../../player/music-player";

function formatTime(miliseconds: number) {
    const safeSeconds = Math.max(0, Math.floor(miliseconds / 1000));
    const minutes = Math.floor(safeSeconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainder = safeSeconds % 60;
    if (hours > 0) {
        return `${hours}:${String(minutes % 60).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
    }
    return `${String(minutes % 60).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export default function MusicListenScreen() {
    const params = useLocalSearchParams<{
        assetId: string;
        sourceUri: string;
        title: string;
        artist: string;
        color: string;
    }>();
    const sourceUri = decodeURIComponent(params.sourceUri);

    const assetId = params.assetId;
    const activeTrack = {
        assetId,
        sourceUri,
        title: params.title ?? "Unknown track",
        artist: params.artist ?? "Unknown artist",
        color: params.color ?? "#3d748d",
        duration: null,
    };

    const [isPlaying, setIsPlaying] = useState(false);

    async function handlePlay() {
        try {
            await playTrack(activeTrack);
            setIsPlaying(true);
        } catch (err) {
            console.warn("Play failed", err);
        }
    }

    async function handlePause() {
        try {
            const player = await import("../../player/music-player.native");
            await player.pausePlayback();
            setIsPlaying(false);
        } catch (err) {
            console.warn("Pause failed", err);
        }
    }

    const activeTitle = activeTrack.title;
    const activeArtist = activeTrack.artist;
    const activeColor = activeTrack.color;
    const totalSeconds = activeTrack.duration ?? 0;
    const playedSeconds = 0;
    const bufferedSeconds = 0;
    const playedWidth =
        totalSeconds > 0
            ? Math.min(100, (playedSeconds / totalSeconds) * 100)
            : 0;
    const bufferedWidth =
        totalSeconds > 0
            ? Math.min(100, (bufferedSeconds / totalSeconds) * 100)
            : 0;

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
                    <Pressable
                        accessibilityRole="button"
                        style={styles.iconButton}
                    >
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
                    <View
                        style={{
                            flexDirection: "row",
                            justifyContent: "center",
                            gap: 12,
                        }}
                    >
                        <Pressable
                            accessibilityRole="button"
                            onPress={() => {
                                if (isPlaying) {
                                    handlePause();
                                } else {
                                    handlePlay();
                                }
                            }}
                            style={styles.playButton}
                        >
                            <MaterialCommunityIcons
                                name={isPlaying ? "pause" : "play"}
                                size={32}
                                color={isPlaying ? "#000000" : "#0b0d12"}
                                style={
                                    isPlaying ? undefined : styles.playIconShift
                                }
                            />
                        </Pressable>
                    </View>
                </View>

                <View style={styles.footerCard}>
                    <View style={styles.footerChip} />
                    <Text style={styles.footerTitle}>
                        Local library playback
                    </Text>
                    <Text style={styles.footerText} numberOfLines={2}>
                        Tap play to start listening.
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
