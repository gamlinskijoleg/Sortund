import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAudioPlayerStatus, type AudioPlayer } from "expo-audio";
import { Image } from "expo-image";
import { router, usePathname } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePlayerStore } from "../../store/usePlayerStore";
import { useAppTheme } from "../../theme/app-theme";
import { NAV_HEIGHT, TAB_ROUTES } from "./music-bottom-nav";

export const MINI_PLAYER_SPACE = 150;

function Controls({ player }: { player: AudioPlayer }) {
    const theme = useAppTheme();
    const { playing } = useAudioPlayerStatus(player);
    const playNext = usePlayerStore((s) => s.playNext);
    return (
        <View style={styles.controls}>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={playing ? "Pause" : "Play"}
                hitSlop={10}
                onPress={() => (playing ? player.pause() : player.play())}
            >
                <MaterialCommunityIcons
                    name={playing ? "pause" : "play"}
                    size={28}
                    color={theme.inverseText}
                />
            </Pressable>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next"
                hitSlop={10}
                onPress={playNext}
            >
                <MaterialCommunityIcons name="skip-next" size={26} color={theme.inverseText} />
            </Pressable>
        </View>
    );
}

/** Mini player shown above every screen except the full player (REQ 46). */
export function MiniPlayer() {
    const theme = useAppTheme();
    const insets = useSafeAreaInsets();
    const pathname = usePathname();
    const track = usePlayerStore((s) => s.activeTrack);
    const player = usePlayerStore((s) => s.playerInstance);

    if (!track || !player || pathname === "/listen" || pathname.startsWith("/auth")) return null;
    const bottom = (TAB_ROUTES.has(pathname) ? NAV_HEIGHT : 0) + insets.bottom + 8;

    return (
        <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: "/listen", params: { assetId: track.assetId } })}
            style={[styles.bar, { bottom, backgroundColor: theme.accent }]}
        >
            <View style={[styles.cover, { backgroundColor: track.color }]}>
                {track.artwork ? (
                    <Image
                        source={{ uri: track.artwork }}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                    />
                ) : (
                    <MaterialCommunityIcons name="music-note" size={18} color="#fff" />
                )}
            </View>
            <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: theme.inverseText }]} numberOfLines={1}>
                    {track.title}
                </Text>
                <Text style={[styles.artist, { color: theme.inverseTextMuted }]} numberOfLines={1}>
                    {track.artist}
                </Text>
            </View>
            <Controls player={player} />
        </Pressable>
    );
}

const styles = StyleSheet.create({
    bar: {
        position: "absolute",
        left: 12,
        right: 12,
        height: 58,
        borderRadius: 16,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 8,
        gap: 10,
        elevation: 6,
        shadowColor: "#000",
        shadowOpacity: 0.2,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
    },
    cover: {
        width: 42,
        height: 42,
        borderRadius: 8,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
    },
    title: { fontSize: 14, fontWeight: "700" },
    artist: { fontSize: 12 },
    controls: { flexDirection: "row", alignItems: "center", gap: 14, paddingRight: 6 },
});
