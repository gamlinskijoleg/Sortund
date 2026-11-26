import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAudioPlayerStatus, type AudioPlayer } from "expo-audio";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    Alert,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withSpring,
    withTiming,
} from "react-native-reanimated";
import { runOnJS } from "react-native-worklets";

import { AppScreen } from "../app-screen";
import { getPlayerInstance, togglePlayback } from "../../player/music-player";
import { usePlayerStore } from "../../store/usePlayerStore";
import { useAppTheme } from "../../theme/app-theme";
import { useT, useValueLabel } from "../../i18n";
import { toggleFavourite } from "../../data/library";
import { formatDuration } from "../../library/track-utils";
import { Cover, EmptyState, IconButton, Sheet, type IconName } from "../ui/primitives";
import { TrackListItem } from "../shared/track-list-item";
import { AddToPlaylistSheet } from "../track/add-to-playlist-sheet";
import { openTrack } from "./music-home-screen";

const PlaybackSlider = React.memo(
    ({ player, fallbackDuration }: { player: AudioPlayer; fallbackDuration: number }) => {
        const theme = useAppTheme();
        const { currentTime, duration } = useAudioPlayerStatus(player);
        const playedMs = currentTime ? currentTime * 1000 : 0;
        const totalMs = duration > 0 ? duration * 1000 : fallbackDuration;

        const width = useSharedValue(0);
        const dragMs = useSharedValue(0);
        const sliding = useSharedValue(false);
        const played = useSharedValue(0);
        const total = useSharedValue(totalMs);
        const [slidingMs, setSlidingMs] = useState<number | null>(null);

        useEffect(() => {
            played.value = playedMs;
            total.value = totalMs;
        }, [playedMs, totalMs, played, total]);

        const finish = (ms: number) => {
            player.seekTo(ms / 1000).catch(() => undefined);
            setTimeout(() => {
                sliding.value = false;
                setSlidingMs(null);
            }, 120);
        };

        const gesture = Gesture.Pan()
            .minDistance(0)
            .onBegin((e) => {
                sliding.value = true;
                dragMs.value = Math.max(0, Math.min(e.x / width.value, 1)) * total.value;
                runOnJS(setSlidingMs)(dragMs.value);
            })
            .onUpdate((e) => {
                dragMs.value = Math.max(0, Math.min(e.x / width.value, 1)) * total.value;
                runOnJS(setSlidingMs)(dragMs.value);
            })
            .onFinalize(() => {
                runOnJS(finish)(dragMs.value);
            });

        const percent = () => {
            "worklet";
            const ms = sliding.value ? dragMs.value : played.value;
            return total.value > 0 ? Math.min(100, (ms / total.value) * 100) : 0;
        };
        const fill = useAnimatedStyle(() => ({ width: `${percent()}%` }));
        const knob = useAnimatedStyle(() => ({
            left: `${percent()}%`,
            transform: [{ scale: withTiming(sliding.value ? 1.4 : 1, { duration: 120 }) }],
        }));

        return (
            <View style={{ marginTop: 22 }}>
                <GestureDetector gesture={gesture}>
                    <View
                        accessibilityRole="adjustable"
                        accessibilityLabel={formatDuration(playedMs)}
                        onLayout={(e) => {
                            width.value = e.nativeEvent.layout.width;
                        }}
                        style={styles.sliderHit}
                    >
                        <View
                            style={[styles.sliderTrack, { backgroundColor: theme.surfaceStrong }]}
                        >
                            <Animated.View
                                style={[styles.sliderFill, { backgroundColor: theme.text }, fill]}
                            />
                        </View>
                        <Animated.View
                            style={[styles.knob, { backgroundColor: theme.text }, knob]}
                        />
                    </View>
                </GestureDetector>
                <View style={styles.times}>
                    <Text
                        style={[
                            styles.time,
                            { color: slidingMs !== null ? theme.text : theme.textSubtle },
                        ]}
                    >
                        {formatDuration(slidingMs ?? playedMs)}
                    </Text>
                    <Text style={[styles.time, { color: theme.textSubtle }]}>
                        {formatDuration(totalMs)}
                    </Text>
                </View>
            </View>
        );
    }
);
PlaybackSlider.displayName = "PlaybackSlider";

function useIsPlaying(player: AudioPlayer) {
    return useAudioPlayerStatus(player).playing;
}

function PlayPauseButton({ player }: { player: AudioPlayer }) {
    const theme = useAppTheme();
    const t = useT();
    const playing = useIsPlaying(player);
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(playing ? "player.pause" : "player.play")}
            onPress={togglePlayback}
            style={({ pressed }) => [
                styles.play,
                { backgroundColor: theme.text, transform: [{ scale: pressed ? 0.92 : 1 }] },
            ]}
        >
            <MaterialCommunityIcons
                name={playing ? "pause" : "play"}
                size={38}
                color={theme.inverseText}
                style={playing ? undefined : { marginLeft: 4 }}
            />
        </Pressable>
    );
}

function Artwork({ player, uri, size }: { player: AudioPlayer; uri?: string; size: number }) {
    const playing = useIsPlaying(player);
    const scale = useSharedValue(1);
    useEffect(() => {
        scale.value = withTiming(playing ? 1 : 0.86, {
            duration: 450,
            easing: Easing.out(Easing.cubic),
        });
    }, [playing, scale]);
    const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
    return (
        <Animated.View style={[styles.artShadow, style]}>
            <Cover uri={uri} size={size} radius={14} />
        </Animated.View>
    );
}

function ToggleIcon({
    icon,
    on,
    label,
    onPress,
    badge,
}: {
    icon: IconName;
    on: boolean;
    label: string;
    onPress: () => void;
    badge?: string;
}) {
    const theme = useAppTheme();
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: on }}
            onPress={onPress}
            style={({ pressed }) => [styles.toggleIcon, pressed && { opacity: 0.6 }]}
        >
            <MaterialCommunityIcons
                name={icon}
                size={24}
                color={on ? theme.text : theme.textSubtle}
            />
            <View style={styles.dotSlot}>
                {badge ? (
                    <Text style={{ color: theme.text, fontSize: 9, fontWeight: "800" }}>
                        {badge}
                    </Text>
                ) : (
                    on && <View style={[styles.dot, { backgroundColor: theme.text }]} />
                )}
            </View>
        </Pressable>
    );
}

function BottomAction({
    icon,
    label,
    onPress,
}: {
    icon: IconName;
    label: string;
    onPress: () => void;
}) {
    const theme = useAppTheme();
    return (
        <Pressable
            accessibilityRole="button"
            onPress={onPress}
            style={({ pressed }) => [
                styles.bottomAction,
                pressed && { backgroundColor: theme.surface },
            ]}
        >
            <MaterialCommunityIcons name={icon} size={22} color={theme.textMuted} />
            <Text style={{ color: theme.textMuted, fontSize: 11 }}>{label}</Text>
        </Pressable>
    );
}

function HeartButton({ active, onPress }: { active: boolean; onPress: () => void }) {
    const theme = useAppTheme();
    const t = useT();
    const scale = useSharedValue(1);
    const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(active ? "track.unfavourite" : "track.favourite")}
            accessibilityState={{ selected: active }}
            onPress={() => {
                scale.set(withSequence(withTiming(1.3, { duration: 110 }), withSpring(1)));
                onPress();
            }}
            style={styles.heart}
            hitSlop={6}
        >
            <Animated.View style={style}>
                <MaterialCommunityIcons
                    name={active ? "heart" : "heart-outline"}
                    size={28}
                    color={theme.text}
                />
            </Animated.View>
        </Pressable>
    );
}

/** Current queue (REQ 44): tap a track to jump to it. */
function QueueSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
    const t = useT();
    const queue = usePlayerStore((s) => s.tracks);
    const current = usePlayerStore((s) => s.currentIndex);
    const upcoming = queue.slice(current + 1).concat(queue.slice(0, Math.max(0, current)));
    return (
        <Sheet visible={visible} onClose={onClose} title={t("player.upNext")} scroll={false}>
            {upcoming.length === 0 ? (
                <EmptyState icon="playlist-music" text={t("player.queueEmpty")} />
            ) : (
                <FlatList
                    showsVerticalScrollIndicator={false}
                    showsHorizontalScrollIndicator={false}
                    style={{ maxHeight: 520, marginHorizontal: -16 }}
                    data={upcoming}
                    keyExtractor={(x, i) => `${x.assetId}-${i}`}
                    renderItem={({ item }) => (
                        <TrackListItem
                            track={item}
                            onPress={() => usePlayerStore.getState().selectTrackById(item.assetId)}
                        />
                    )}
                />
            )}
        </Sheet>
    );
}

export default function MusicListenScreen() {
    const theme = useAppTheme();
    const t = useT();
    const label = useValueLabel();
    const { width } = useWindowDimensions();
    const player = getPlayerInstance();
    const activeTrack = usePlayerStore((s) => s.activeTrack);
    const playNext = usePlayerStore((s) => s.playNext);
    const playPrevious = usePlayerStore((s) => s.playPrevious);
    const shuffle = usePlayerStore((s) => s.shuffle);
    const repeat = usePlayerStore((s) => s.repeat);
    const [queueOpen, setQueueOpen] = useState(false);
    const [playlistOpen, setPlaylistOpen] = useState(false);

    if (!activeTrack || !player) {
        return (
            <AppScreen>
                <View style={{ paddingHorizontal: 8 }}>
                    <IconButton
                        icon="chevron-down"
                        size={28}
                        label={t("common.back")}
                        onPress={() => router.back()}
                    />
                </View>
                <EmptyState icon="music-note-off" text={t("player.empty")} />
            </AppScreen>
        );
    }

    const artSize = Math.min(width - 48, 380);
    const tags = [
        activeTrack.genre,
        label(activeTrack.mood),
        activeTrack.bpm ? `${Math.round(activeTrack.bpm)} BPM` : undefined,
        activeTrack.musicalKey,
    ].filter((x): x is string => !!x);
    const repeatLabel = t(
        repeat === "one"
            ? "player.repeatOne"
            : repeat === "all"
              ? "player.repeatAll"
              : "player.repeatOff"
    );

    return (
        <AppScreen>
            <View style={styles.header}>
                <IconButton
                    icon="chevron-down"
                    size={30}
                    label={t("common.back")}
                    onPress={() => router.back()}
                />
                <View style={{ flex: 1, alignItems: "center" }}>
                    <Text style={{ color: theme.textSubtle, fontSize: 12 }}>
                        {t("player.nowPlaying")}
                    </Text>
                    {!!activeTrack.album && (
                        <Text
                            style={{ color: theme.text, fontSize: 14, fontWeight: "600" }}
                            numberOfLines={1}
                        >
                            {activeTrack.album}
                        </Text>
                    )}
                </View>
                <IconButton
                    icon="dots-horizontal"
                    label={t("track.more")}
                    onPress={() => openTrack(activeTrack.assetId)}
                />
            </View>

            <View style={{ flex: 1, paddingHorizontal: 24 }}>
                <View style={{ alignItems: "center", marginTop: 16 }}>
                    <Artwork player={player} uri={activeTrack.artwork} size={artSize} />
                </View>

                <View style={styles.meta}>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
                            {activeTrack.title}
                        </Text>
                        <Text
                            style={{ color: theme.textMuted, fontSize: 16, marginTop: 4 }}
                            numberOfLines={1}
                        >
                            {activeTrack.artist}
                        </Text>
                    </View>
                    <HeartButton
                        active={!!activeTrack.isFavourite}
                        onPress={() => toggleFavourite(activeTrack.assetId)}
                    />
                </View>

                {tags.length > 0 && (
                    <View style={styles.tags}>
                        {tags.map((tag) => (
                            <Text
                                key={tag}
                                style={[
                                    styles.tag,
                                    { color: theme.textMuted, borderColor: theme.surfaceStrong },
                                ]}
                            >
                                {tag}
                            </Text>
                        ))}
                    </View>
                )}

                <PlaybackSlider player={player} fallbackDuration={activeTrack.duration || 0} />

                <View style={styles.controls}>
                    <ToggleIcon
                        icon="shuffle-variant"
                        on={shuffle}
                        label={t("player.shuffle")}
                        onPress={() => usePlayerStore.getState().toggleShuffle()}
                    />
                    <IconButton
                        icon="skip-previous"
                        size={38}
                        label={t("player.previous")}
                        onPress={playPrevious}
                        style={styles.skip}
                    />
                    <PlayPauseButton player={player} />
                    <IconButton
                        icon="skip-next"
                        size={38}
                        label={t("player.next")}
                        onPress={playNext}
                        style={styles.skip}
                    />
                    <ToggleIcon
                        icon={repeat === "one" ? "repeat-once" : "repeat"}
                        on={repeat !== "off"}
                        label={repeatLabel}
                        onPress={() => usePlayerStore.getState().cycleRepeat()}
                    />
                </View>

                <View style={{ flex: 1 }} />
                <View style={styles.bottom}>
                    <BottomAction
                        icon="playlist-music"
                        label={t("player.queue")}
                        onPress={() => setQueueOpen(true)}
                    />
                    <BottomAction
                        icon="waveform"
                        label={t("track.similarShort")}
                        onPress={() =>
                            router.push({
                                pathname: "/similar/[assetId]",
                                params: { assetId: activeTrack.assetId },
                            })
                        }
                    />
                    <BottomAction
                        icon="playlist-plus"
                        label={t("track.toPlaylist")}
                        onPress={() => setPlaylistOpen(true)}
                    />
                    <BottomAction
                        icon="information-outline"
                        label={t("track.about")}
                        onPress={() => openTrack(activeTrack.assetId)}
                    />
                </View>
            </View>

            <QueueSheet visible={queueOpen} onClose={() => setQueueOpen(false)} />
            <AddToPlaylistSheet
                visible={playlistOpen}
                assetIds={[activeTrack.assetId]}
                onClose={() => setPlaylistOpen(false)}
                onAdded={(name) =>
                    Alert.alert(t("common.done"), t("track.addedToPlaylist", { name }))
                }
            />
        </AppScreen>
    );
}

const styles = StyleSheet.create({
    header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, height: 52 },
    artShadow: {
        borderRadius: 14,
        elevation: 16,
        shadowColor: "#000",
        shadowOpacity: 0.5,
        shadowRadius: 30,
        shadowOffset: { width: 0, height: 20 },
    },
    meta: { flexDirection: "row", alignItems: "center", marginTop: 28, gap: 8 },
    title: { fontSize: 24, fontWeight: "700", letterSpacing: -0.4 },
    heart: {
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
        marginRight: -8,
    },
    tags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 14 },
    tag: {
        fontSize: 13,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderWidth: 1,
        borderRadius: 14,
    },
    sliderHit: { height: 24, justifyContent: "center" },
    sliderTrack: { height: 4, borderRadius: 2, overflow: "hidden" },
    sliderFill: { height: 4, borderRadius: 2 },
    knob: { position: "absolute", width: 14, height: 14, borderRadius: 7, marginLeft: -7 },
    times: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
    time: { fontSize: 12, fontVariant: ["tabular-nums"] },
    controls: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 12,
    },
    skip: { width: 60, height: 60, borderRadius: 30 },
    play: {
        width: 78,
        height: 78,
        borderRadius: 39,
        alignItems: "center",
        justifyContent: "center",
    },
    toggleIcon: { width: 44, height: 52, alignItems: "center", justifyContent: "center" },
    dotSlot: { height: 8, alignItems: "center", justifyContent: "center", marginTop: 2 },
    dot: { width: 4, height: 4, borderRadius: 2 },
    bottom: { flexDirection: "row", justifyContent: "space-around", paddingBottom: 12 },
    bottomAction: {
        alignItems: "center",
        gap: 4,
        minWidth: 72,
        paddingVertical: 8,
        borderRadius: 12,
    },
});
