import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { MusicTrack } from "../../data/types";
import { useAppTheme } from "../../theme/app-theme";

export const TRACK_ROW_HEIGHT = 72;

export const TrackListItem = React.memo(
    ({
        track,
        onPress,
        onLongPress,
        trailingActionSlot,
        subtitle,
        selected,
    }: {
        track: MusicTrack;
        onPress?: () => void;
        onLongPress?: () => void;
        trailingActionSlot?: React.ReactNode;
        subtitle?: string;
        selected?: boolean;
    }) => {
        const theme = useAppTheme();
        const meta = [
            track.genre,
            track.mood,
            track.bpm ? `${Math.round(track.bpm)} BPM` : undefined,
        ]
            .filter(Boolean)
            .join(" · ");

        return (
            <Pressable
                onPress={onPress}
                onLongPress={onLongPress}
                accessibilityRole="button"
                accessibilityLabel={`${track.title}, ${track.artist}`}
                style={({ pressed }) => [
                    styles.row,
                    {
                        opacity: pressed ? 0.8 : 1,
                        backgroundColor: selected ? theme.accentSoft : "transparent",
                    },
                ]}
            >
                <View style={[styles.cover, { backgroundColor: track.color }]}>
                    {track.artwork ? (
                        <Image
                            source={{ uri: track.artwork }}
                            style={StyleSheet.absoluteFill}
                            contentFit="cover"
                        />
                    ) : (
                        <MaterialCommunityIcons
                            name="music-note"
                            size={22}
                            color="rgba(255,255,255,0.85)"
                        />
                    )}
                    {selected && (
                        <View style={[styles.check, { backgroundColor: theme.accent }]}>
                            <MaterialCommunityIcons name="check" size={14} color="#fff" />
                        </View>
                    )}
                </View>

                <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
                        {track.isFavourite ? "♥ " : ""}
                        {track.title}
                    </Text>
                    <Text style={[styles.subtitle, { color: theme.textMuted }]} numberOfLines={1}>
                        {subtitle ?? track.artist}
                    </Text>
                    {!!meta && !subtitle && (
                        <Text style={[styles.meta, { color: theme.textSubtle }]} numberOfLines={1}>
                            {meta}
                        </Text>
                    )}
                </View>

                {trailingActionSlot}
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
        paddingHorizontal: 16,
        gap: 12,
    },
    cover: {
        width: 54,
        height: 54,
        borderRadius: 8,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
    },
    check: {
        position: "absolute",
        right: 3,
        bottom: 3,
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
    },
    title: { fontSize: 15, fontWeight: "600" },
    subtitle: { fontSize: 13, marginTop: 2 },
    meta: { fontSize: 12, marginTop: 2 },
});
