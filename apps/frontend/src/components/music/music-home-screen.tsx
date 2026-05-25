import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppScreen } from "../app-screen";
import {
    createListenRoute,
    featureCards,
    musicSections,
    type MusicTrack,
    useMusicTracks,
} from "../../data/music";
import { useAppTheme } from "../../theme/app-theme";

function MusicSearchBar() {
    const theme = useAppTheme();

    return (
        <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/search")}
            style={[styles.searchBar, { backgroundColor: theme.surface }]}
        >
            <MaterialCommunityIcons
                name="magnify"
                size={24}
                color={theme.textSubtle}
            />
            <Text
                style={[styles.searchPlaceholder, { color: theme.textSubtle }]}
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
    );
}

function MusicFeatureCard({
    title,
    color,
    href,
}: {
    title: string;
    color: string;
    href: "/library/favourites" | "/library/playlists" | "/library/recent";
}) {
    const theme = useAppTheme();
    const iconName =
        title === "Favourites"
            ? "heart"
            : title === "Playlists"
              ? "playlist-music"
              : "clock-outline";

    return (
        <Pressable
            accessibilityRole="button"
            onPress={() => router.push(href as never)}
            style={({ pressed }) => [
                styles.featureCard,
                { backgroundColor: color, opacity: pressed ? 0.92 : 1 },
            ]}
        >
            <View style={styles.featureIcon}>
                <MaterialCommunityIcons
                    name={
                        iconName as keyof typeof MaterialCommunityIcons.glyphMap
                    }
                    size={20}
                    color={
                        title === "Favourites"
                            ? theme.accentStrong
                            : title === "Playlists"
                              ? theme.accent
                              : theme.textMuted
                    }
                />
            </View>
            <Text style={[styles.featureTitle, { color: theme.inverseText }]}>
                {title}
            </Text>
        </Pressable>
    );
}

function SectionTabs() {
    const theme = useAppTheme();

    return (
        <View style={styles.tabsRow}>
            {musicSections.map((section) => {
                const isActive = section.href === "/";

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

function ActionBar() {
    const theme = useAppTheme();

    return (
        <View style={styles.shuffleRow}>
            <View style={styles.shuffleLeft}>
                <View
                    style={[styles.playButton, { backgroundColor: theme.text }]}
                >
                    <MaterialCommunityIcons
                        name="play"
                        size={20}
                        color={theme.inverseText}
                    />
                </View>
                <Text style={[styles.shuffleText, { color: theme.text }]}>
                    Shuffle playback
                </Text>
            </View>

            <View style={styles.shuffleActions}>
                <MaterialCommunityIcons
                    name="swap-vertical"
                    size={28}
                    color={theme.text}
                />
                <MaterialCommunityIcons
                    name="format-list-bulleted"
                    size={28}
                    color={theme.text}
                />
            </View>
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
                pressed && styles.trackRowPressed,
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

function MiniPlayer({
    track,
    onPress,
}: {
    track?: MusicTrack;
    onPress?: () => void;
}) {
    const theme = useAppTheme();

    return (
        <Pressable
            accessibilityRole="button"
            onPress={onPress}
            style={({ pressed }) => [
                styles.miniPlayer,
                { backgroundColor: theme.surfaceStrong },
                pressed && styles.miniPressed,
            ]}
        >
            <View style={styles.miniArtWrap}>
                <View style={styles.miniVinylOuter}>
                    <View style={styles.miniVinylInner} />
                </View>
                <View
                    style={[
                        styles.miniArt,
                        { backgroundColor: track?.color ?? theme.accent },
                    ]}
                >
                    <Text style={styles.trackMonogram}>M</Text>
                </View>
            </View>

            <View style={styles.miniTextWrap}>
                <Text
                    style={[styles.miniTitle, { color: theme.inverseText }]}
                    numberOfLines={1}
                >
                    {track?.title ?? "Loading local music"}
                </Text>
                <Text
                    style={[
                        styles.miniArtist,
                        { color: theme.inverseText, opacity: 0.82 },
                    ]}
                    numberOfLines={1}
                >
                    {track?.artist ?? "Scanning your music files"}
                </Text>
            </View>

            <View style={styles.miniActions}>
                <View style={styles.miniPlayCircle}>
                    <MaterialCommunityIcons
                        name="play"
                        size={16}
                        color={theme.inverseText}
                    />
                </View>
                <MaterialCommunityIcons
                    name="skip-next"
                    size={18}
                    color={theme.inverseText}
                />
            </View>
        </Pressable>
    );
}

export default function MusicHomeScreen() {
    const theme = useAppTheme();
    const { tracks, isLoading, error } = useMusicTracks();

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
                    <MusicSearchBar />
                </View>

                <View style={styles.featureRow}>
                    {featureCards.map((card) => (
                        <MusicFeatureCard key={card.title} {...card} />
                    ))}
                </View>

                <SectionTabs />
                <ActionBar />

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
                                onPress={() => router.push(createListenRoute(track))}
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

                <MiniPlayer
                    track={tracks[0]}
                    onPress={
                        tracks[0]
                            ? () => router.push(createListenRoute(tracks[0]))
                            : undefined
                    }
                />
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
    featureRow: {
        flexDirection: "row",
        gap: 10,
        paddingHorizontal: 16,
        marginTop: 18,
    },
    featureCard: {
        flex: 1,
        minHeight: 84,
        borderRadius: 20,
        padding: 12,
        justifyContent: "space-between",
    },
    featureIcon: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: "rgba(255,255,255,0.98)",
        justifyContent: "center",
        alignItems: "center",
    },
    featureTitle: {
        fontSize: 20,
        fontWeight: "700",
        lineHeight: 24,
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
    shuffleRow: {
        marginTop: 26,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    shuffleLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    playButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: "center",
        alignItems: "center",
    },
    shuffleText: {
        fontSize: 18,
        fontWeight: "600",
    },
    shuffleActions: {
        flexDirection: "row",
        alignItems: "center",
        gap: 18,
    },
    listContent: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 220,
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
    trackRowPressed: {
        opacity: 0.84,
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
    miniPlayer: {
        position: "absolute",
        left: 16,
        right: 16,
        bottom: 70,
        height: 72,
        borderRadius: 22,
        flexDirection: "row",
        alignItems: "center",
        paddingLeft: 58,
        paddingRight: 18,
    },
    miniPressed: {
        opacity: 0.92,
    },
    miniArtWrap: {
        position: "absolute",
        left: -2,
        top: -7,
        width: 82,
        height: 82,
        justifyContent: "center",
        alignItems: "center",
    },
    miniVinylOuter: {
        position: "absolute",
        left: 0,
        top: 4,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: "#2f2a3e",
        borderWidth: 6,
        borderColor: "#4f465d",
    },
    miniVinylInner: {
        position: "absolute",
        left: 16,
        top: 16,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: "#6f6780",
    },
    miniArt: {
        position: "absolute",
        left: 22,
        top: 21,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: "#4b89a5",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
    },
    miniTextWrap: {
        flex: 1,
        paddingLeft: 4,
    },
    miniTitle: {
        fontSize: 15,
        fontWeight: "700",
        lineHeight: 18,
        marginBottom: 6,
    },
    miniArtist: {
        fontSize: 14,
        lineHeight: 17,
        fontWeight: "500",
    },
    miniActions: {
        flexDirection: "row",
        alignItems: "center",
        gap: 18,
        paddingLeft: 10,
    },
    miniPlayCircle: {
        width: 34,
        height: 34,
        borderRadius: 17,
        borderWidth: 3,
        borderColor: "rgba(255,255,255,0.65)",
        justifyContent: "center",
        alignItems: "center",
    },
});
