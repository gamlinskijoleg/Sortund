import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAudioPlayerStatus, type AudioPlayer } from "expo-audio";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { MusicTrack } from "../../data/types";
import { useT } from "../../i18n";
import { formatDuration } from "../../library/track-utils";
import { usePlayerStore } from "../../store/usePlayerStore";
import { useAppTheme } from "../../theme/app-theme";
import { Cover, Equalizer, IconButton } from "../ui/primitives";

export const TRACK_ROW_HEIGHT = 64;

/** Equaliser driven by the real player state (also paused from the notification or headset). */
function PlayingEqualizer({ player }: { player: AudioPlayer }) {
    const { playing } = useAudioPlayerStatus(player);
    return <Equalizer paused={!playing} />;
}

/** Small analysis-status icon in the subtitle line; finished and new tracks show nothing. */
function StatusIcon({ track }: { track: MusicTrack }) {
    const theme = useAppTheme();
    const t = useT();
    const status = track.analysisStatus;
    if (status === "processing")
        return (
            <ActivityIndicator
                size={12}
                color={theme.textMuted}
                accessibilityLabel={t("ai.status.processing")}
            />
        );
    if (status === "queued")
        return (
            <MaterialCommunityIcons
                name="clock-outline"
                size={13}
                color={theme.textMuted}
                accessibilityLabel={t("ai.status.queued")}
            />
        );
    if (status === "failed")
        return (
            <MaterialCommunityIcons
                name="alert-outline"
                size={13}
                color={theme.text}
                accessibilityLabel={t("ai.status.failed")}
            />
        );
    return null;
}

export const TrackListItem = React.memo(
    ({
        track,
        onPress,
        onLongPress,
        trailingActionSlot,
        leadingSlot,
        subtitle,
        selected,
        showDuration = true,
        onMore,
    }: {
        track: MusicTrack;
        onPress?: () => void;
        onLongPress?: () => void;
        trailingActionSlot?: React.ReactNode;
        leadingSlot?: React.ReactNode;
        subtitle?: string;
        selected?: boolean;
        showDuration?: boolean;
        /** Adds a "more" button that opens the track card. */
        onMore?: () => void;
    }) => {
        const theme = useAppTheme();
        const t = useT();
        const isCurrent = usePlayerStore((s) => s.activeTrack?.assetId === track.assetId);
        const player = usePlayerStore((s) => s.playerInstance);

        return (
            <Pressable
                onPress={onPress}
                onLongPress={onLongPress}
                delayLongPress={350}
                accessibilityRole="button"
                accessibilityState={{ selected: !!selected }}
                accessibilityLabel={`${track.title}, ${track.artist}`}
                style={({ pressed }) => [
                    styles.row,
                    {
                        backgroundColor: pressed
                            ? theme.surface
                            : selected
                              ? theme.surface
                              : "transparent",
                    },
                ]}
            >
                {leadingSlot}
                <Cover uri={track.artwork} size={48} />

                <View style={{ flex: 1 }}>
                    <View style={styles.titleLine}>
                        {isCurrent && player && <PlayingEqualizer player={player} />}
                        <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
                            {track.title}
                        </Text>
                    </View>
                    <View style={styles.subLine}>
                        <StatusIcon track={track} />
                        <Text
                            style={[styles.subtitle, { color: theme.textSubtle }]}
                            numberOfLines={1}
                        >
                            {subtitle ?? track.artist}
                        </Text>
                    </View>
                </View>

                {showDuration && !trailingActionSlot && track.duration > 0 && (
                    <Text style={[styles.duration, { color: theme.textSubtle }]}>
                        {formatDuration(track.duration)}
                    </Text>
                )}
                {trailingActionSlot}
                {onMore && (
                    <IconButton
                        icon="dots-vertical"
                        size={20}
                        color={theme.textSubtle}
                        label={t("track.more")}
                        onPress={onMore}
                    />
                )}
            </Pressable>
        );
    }
);

TrackListItem.displayName = "TrackListItem";

const styles = StyleSheet.create({
    row: {
        flexDirection: "row",
        alignItems: "center",
        height: TRACK_ROW_HEIGHT,
        paddingLeft: 16,
        paddingRight: 8,
        gap: 12,
    },
    titleLine: { flexDirection: "row", alignItems: "center", gap: 8 },
    subLine: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 },
    title: { fontSize: 15, fontWeight: "500", flexShrink: 1 },
    subtitle: { fontSize: 13, flexShrink: 1 },
    duration: { fontSize: 13, fontVariant: ["tabular-nums"], paddingLeft: 8 },
});
