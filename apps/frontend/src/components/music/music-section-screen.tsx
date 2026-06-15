import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppScreen } from "../app-screen";
import {
    createListenRoute,
    musicSections,
    type MusicTrack,
    useMusicTracks,
} from "../../data/music";
import { useAppTheme } from "../../theme/app-theme";
import { log } from "@/utils/logger";

function SectionTabs() {
    const pathname = usePathname();
    const theme = useAppTheme();

    return (
        <View style={styles.tabsRow}>
            {musicSections.map((section) => {
                const isActive = section.href === pathname;

                return (
                    <Pressable
                        accessibilityRole="button"
                        key={section.label}
                        onPress={() => router.push(section.href)}
                        style={({ pressed }) => [
                            styles.tabPill,
                            {
                                backgroundColor: isActive
                                    ? theme.text
                                    : "transparent",
                            },
                            pressed && styles.pressed,
                        ]}
                    >
                        <Text
                            style={[
                                styles.tabText,
                                {
                                    color: isActive
                                        ? theme.inverseText
                                        : theme.textMuted,
                                },
                            ]}
                        >
                            {section.label}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

function TrackRow({
    track,
    onPress,
}: {
    track: MusicTrack;
    onPress?: () => void;
}) {
    const theme = useAppTheme();
    const { title, artist, color } = track;

    return (
        <Pressable
            accessibilityRole="button"
            onPress={onPress}
            style={({ pressed }) => [
                styles.trackRow,
                pressed && styles.pressed,
            ]}
        >
            <View style={[styles.trackArt, { backgroundColor: color }]}>
                <MaterialCommunityIcons
                    name="music-note"
                    size={16}
                    color={theme.inverseText}
                    style={styles.trackNoteBadge}
                />
                <Text style={styles.trackMonogram}>M</Text>
            </View>
            <View style={styles.trackTextWrap}>
                <Text
                    style={[styles.trackTitle, { color: theme.text }]}
                    numberOfLines={1}
                >
                    {title}
                </Text>
                <Text
                    style={[styles.trackArtist, { color: theme.textMuted }]}
                    numberOfLines={1}
                >
                    {artist}
                </Text>
            </View>
            <MaterialCommunityIcons
                name="dots-vertical"
                size={28}
                color={theme.border}
            />
        </Pressable>
    );
}

export default function MusicSectionScreen() {
    const theme = useAppTheme();
    const { tracks, isLoading, error } = useMusicTracks();

    log.debug("🎵 MusicSectionScreen rendered with tracks:", tracks.length);

    return (
        <AppScreen>
            <View style={styles.screen}>
                <View style={styles.topRow}>
                    <Pressable
                        accessibilityRole="button"
                        style={styles.filterButton}
                    >
                        <MaterialCommunityIcons
                            name="tune-variant"
                            size={30}
                            color={theme.text}
                        />
                    </Pressable>
                    <Pressable
                        accessibilityRole="button"
                        onPress={() => router.push("/search")}
                        style={[
                            styles.searchBar,
                            { backgroundColor: theme.surface },
                        ]}
                    >
                        <MaterialCommunityIcons
                            name="magnify"
                            size={24}
                            color={theme.textSubtle}
                        />
                        <Text
                            style={styles.searchPlaceholder}
                            numberOfLines={1}
                        >
                            Search songs, playlists, and artists
                        </Text>
                        <View
                            style={[
                                styles.searchDivider,
                                { backgroundColor: theme.border },
                            ]}
                        />
                        <MaterialCommunityIcons
                            name="microphone"
                            size={24}
                            color={theme.textMuted}
                        />
                    </Pressable>
                </View>

                <SectionTabs />

                <View
                    style={[
                        styles.banner,
                        { backgroundColor: theme.surfaceStrong },
                    ]}
                >
                    <Text style={[styles.bannerTitle, { color: theme.text }]}>
                        Browse the collection
                    </Text>
                    <Text
                        style={[
                            styles.bannerSubtitle,
                            { color: theme.textMuted },
                        ]}
                    >
                        Switch routes with the tabs above, or use the bottom bar
                        to jump between music and AI sync views.
                    </Text>
                </View>

                <ScrollView
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                >
                    {isLoading ? (
                        <Text
                            style={[
                                styles.emptyState,
                                { color: theme.textMuted },
                            ]}
                        >
                            Loading local music files...
                        </Text>
                    ) : error ? (
                        <Text
                            style={[
                                styles.emptyState,
                                { color: theme.textMuted },
                            ]}
                        >
                            {error}
                        </Text>
                    ) : tracks.length > 0 ? (
                        tracks.map((track) => (
                            <TrackRow
                                key={track.sourceUri ?? track.title}
                                track={track}
                                onPress={() =>
                                    router.push(createListenRoute(track))
                                }
                            />
                        ))
                    ) : (
                        <Text
                            style={[
                                styles.emptyState,
                                { color: theme.textMuted },
                            ]}
                        >
                            No local audio files found.
                        </Text>
                    )}
                </ScrollView>
            </View>
        </AppScreen>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        paddingTop: 8,
    },
    topRow: {
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    filterButton: {
        width: 28,
        height: 28,
        justifyContent: "center",
        alignItems: "center",
    },
    searchBar: {
        flex: 1,
        height: 50,
        borderRadius: 26,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        gap: 10,
    },
    searchPlaceholder: {
        flex: 1,
        fontSize: 15,
        includeFontPadding: false,
        paddingVertical: 0,
    },
    searchDivider: {
        width: 1,
        height: 18,
    },
    tabsRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        marginTop: 18,
        gap: 12,
    },
    tabPill: {
        height: 44,
        paddingHorizontal: 18,
        borderRadius: 17,
        justifyContent: "center",
        alignItems: "center",
    },
    tabText: {
        fontSize: 18,
        fontWeight: "500",
    },
    pressed: {
        opacity: 0.84,
    },
    banner: {
        marginTop: 20,
        marginHorizontal: 16,
        borderRadius: 24,
        padding: 18,
    },
    bannerTitle: {
        fontSize: 22,
        lineHeight: 26,
        fontWeight: "800",
        marginBottom: 8,
    },
    bannerSubtitle: {
        fontSize: 14,
        lineHeight: 20,
    },
    listContent: {
        paddingHorizontal: 16,
        paddingTop: 18,
        paddingBottom: 118,
    },
    emptyState: {
        fontSize: 15,
        lineHeight: 20,
        paddingVertical: 12,
    },
    trackRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 22,
    },
    trackArt: {
        width: 68,
        height: 68,
        borderRadius: 6,
        marginRight: 14,
        overflow: "hidden",
        justifyContent: "center",
        alignItems: "center",
    },
    trackNoteBadge: {
        position: "absolute",
        top: 5,
        left: 5,
        fontSize: 14,
        lineHeight: 14,
        opacity: 0.9,
    },
    trackMonogram: {
        color: "rgba(255,255,255,0.18)",
        fontSize: 40,
        lineHeight: 42,
        fontWeight: "800",
    },
    trackTextWrap: {
        flex: 1,
        paddingRight: 10,
    },
    trackTitle: {
        fontSize: 16,
        lineHeight: 21,
        fontWeight: "500",
        marginBottom: 6,
    },
    trackArtist: {
        fontSize: 15,
        lineHeight: 19,
    },
});
