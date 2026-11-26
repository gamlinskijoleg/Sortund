import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAudioPlayerStatus, type AudioPlayer } from "expo-audio";
import { router, usePathname } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useT } from "../../i18n";
import { usePlayerStore } from "../../store/usePlayerStore";
import { useAppTheme } from "../../theme/app-theme";
import { Cover } from "../ui/primitives";
import { NAV_HEIGHT, TAB_ROUTES } from "./music-bottom-nav";

/** Bottom padding for scrollable content so nothing hides under the mini player and tab bar. */
export const MINI_PLAYER_SPACE = 160;
const BAR_HEIGHT = 60;

function isHidden(pathname: string) {
    return pathname === "/listen" || pathname.startsWith("/auth");
}

/** Distance from the screen bottom to the top edge of the mini player (for floating bars). */
export function useBottomOverlayOffset() {
    const insets = useSafeAreaInsets();
    const pathname = usePathname();
    const hasTrack = usePlayerStore((s) => !!s.activeTrack);
    const base = (TAB_ROUTES.has(pathname) ? NAV_HEIGHT : 0) + insets.bottom + 8;
    return hasTrack && !isHidden(pathname) ? base + BAR_HEIGHT + 8 : base;
}

function Progress({ player }: { player: AudioPlayer }) {
    const theme = useAppTheme();
    const { currentTime, duration } = useAudioPlayerStatus(player);
    const percent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
    return (
        <View style={[styles.progress, { backgroundColor: theme.surfaceStrong }]}>
            <View style={{ width: `${percent}%`, height: 2, backgroundColor: theme.text }} />
        </View>
    );
}

function Controls({ player }: { player: AudioPlayer }) {
    const theme = useAppTheme();
    const t = useT();
    const { playing } = useAudioPlayerStatus(player);
    const playNext = usePlayerStore((s) => s.playNext);
    return (
        <View style={styles.controls}>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(playing ? "player.pause" : "player.play")}
                onPress={() => (playing ? player.pause() : player.play())}
                style={({ pressed }) => [styles.ctrl, pressed && { opacity: 0.6 }]}
            >
                <MaterialCommunityIcons
                    name={playing ? "pause" : "play"}
                    size={28}
                    color={theme.text}
                />
            </Pressable>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("player.next")}
                onPress={playNext}
                style={({ pressed }) => [styles.ctrl, pressed && { opacity: 0.6 }]}
            >
                <MaterialCommunityIcons name="skip-next" size={26} color={theme.text} />
            </Pressable>
        </View>
    );
}

/** Mini player shown above every screen except the full player and sign-in (REQ 46). */
export function MiniPlayer() {
    const theme = useAppTheme();
    const insets = useSafeAreaInsets();
    const pathname = usePathname();
    const track = usePlayerStore((s) => s.activeTrack);
    const player = usePlayerStore((s) => s.playerInstance);

    if (!track || !player || isHidden(pathname)) return null;
    const bottom = (TAB_ROUTES.has(pathname) ? NAV_HEIGHT : 0) + insets.bottom + 8;

    return (
        <Animated.View
            entering={FadeInDown.duration(250)}
            exiting={FadeOutDown.duration(200)}
            style={[styles.wrap, { bottom }]}
        >
            <Pressable
                accessibilityRole="button"
                accessibilityHint={track.title}
                onPress={() =>
                    router.push({ pathname: "/listen", params: { assetId: track.assetId } })
                }
                style={({ pressed }) => [
                    styles.bar,
                    { backgroundColor: theme.elevated, borderColor: theme.border },
                    pressed && { transform: [{ scale: 0.98 }] },
                ]}
            >
                <Cover uri={track.artwork} size={40} />
                <View style={{ flex: 1 }}>
                    <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
                        {track.title}
                    </Text>
                    <Text style={[styles.artist, { color: theme.textMuted }]} numberOfLines={1}>
                        {track.artist}
                    </Text>
                </View>
                <Controls player={player} />
                <Progress player={player} />
            </Pressable>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    wrap: { position: "absolute", left: 8, right: 8 },
    bar: {
        height: BAR_HEIGHT,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        flexDirection: "row",
        alignItems: "center",
        paddingLeft: 10,
        paddingRight: 4,
        gap: 12,
        overflow: "hidden",
        elevation: 10,
        shadowColor: "#000",
        shadowOpacity: 0.3,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
    },
    title: { fontSize: 14, fontWeight: "600" },
    artist: { fontSize: 13, marginTop: 1 },
    controls: { flexDirection: "row", alignItems: "center" },
    ctrl: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    progress: { position: "absolute", left: 10, right: 10, bottom: 0, height: 2 },
});
