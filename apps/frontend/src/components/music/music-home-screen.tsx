import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppScreen } from "../app-screen";
import { featureCards, musicSections, musicTracks } from "../../data/music";

function MusicSearchBar() {
    return (
        <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/search")}
            style={styles.searchBar}
        >
            <MaterialCommunityIcons name="magnify" size={24} color="#9a9a9a" />
            <Text style={styles.searchPlaceholder} numberOfLines={1}>
                Search songs, playlists, and artists
            </Text>
            <View style={styles.searchDivider} />
            <MaterialCommunityIcons
                name="microphone"
                size={24}
                color="#7f7f7f"
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
    const iconName =
        title === "Favourites"
            ? "heart"
            : title === "Playlists"
              ? "playlist-music"
              : "clock-outline";

    return (
        <Pressable
            accessibilityRole="button"
            onPress={() => router.push(href)}
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
                            ? "#a53a67"
                            : title === "Playlists"
                              ? "#3d748d"
                              : "#5b4db3"
                    }
                />
            </View>
            <Text style={styles.featureTitle}>{title}</Text>
        </Pressable>
    );
}

function SectionTabs() {
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
                            isActive && styles.tabPillActive,
                            pressed && styles.pressed,
                        ]}
                    >
                        <Text
                            style={[
                                styles.tabText,
                                isActive && styles.tabActiveText,
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
    return (
        <View style={styles.shuffleRow}>
            <View style={styles.shuffleLeft}>
                <View style={styles.playButton}>
                    <MaterialCommunityIcons
                        name="play"
                        size={20}
                        color="#ffffff"
                    />
                </View>
                <Text style={styles.shuffleText}>Shuffle playback</Text>
            </View>

            <View style={styles.shuffleActions}>
                <MaterialCommunityIcons
                    name="swap-vertical"
                    size={28}
                    color="#111111"
                />
                <MaterialCommunityIcons
                    name="format-list-bulleted"
                    size={28}
                    color="#111111"
                />
            </View>
        </View>
    );
}

function TrackRow({
    title,
    artist,
    color,
}: {
    title: string;
    artist: string;
    color: string;
}) {
    return (
        <View style={styles.trackRow}>
            <View style={[styles.trackArt, { backgroundColor: color }]}>
                <MaterialCommunityIcons
                    name="music-note"
                    size={16}
                    color="#f8fafc"
                    style={styles.trackNoteBadge}
                />
                <Text style={styles.trackMonogram}>M</Text>
            </View>
            <View style={styles.trackTextWrap}>
                <Text style={styles.trackTitle} numberOfLines={1}>
                    {title}
                </Text>
                <Text style={styles.trackArtist} numberOfLines={1}>
                    {artist}
                </Text>
            </View>
            <MaterialCommunityIcons
                name="dots-vertical"
                size={28}
                color="#bdbdbd"
            />
        </View>
    );
}

function MiniPlayer() {
    return (
        <View style={styles.miniPlayer}>
            <View style={styles.miniArtWrap}>
                <View style={styles.miniVinylOuter}>
                    <View style={styles.miniVinylInner} />
                </View>
                <View style={styles.miniArt}>
                    <Text style={styles.trackMonogram}>M</Text>
                </View>
            </View>

            <View style={styles.miniTextWrap}>
                <Text style={styles.miniTitle} numberOfLines={1}>
                    Adele - Skyfall (Lyrics)
                </Text>
                <Text style={styles.miniArtist} numberOfLines={1}>
                    7clouds Rock
                </Text>
            </View>

            <View style={styles.miniActions}>
                <View style={styles.miniPlayCircle}>
                    <MaterialCommunityIcons
                        name="play"
                        size={16}
                        color="#ffffff"
                    />
                </View>
                <MaterialCommunityIcons
                    name="skip-next"
                    size={18}
                    color="#ffffff"
                />
            </View>
        </View>
    );
}

function BottomNav() {
    return (
        <View style={styles.bottomNav}>
            <View style={styles.navItemActive}>
                <MaterialCommunityIcons
                    name="headphones"
                    size={30}
                    color="#111111"
                />
                <Text style={styles.navLabelActive}>My music</Text>
            </View>
            <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/watch")}
                style={styles.navItem}
            >
                <MaterialCommunityIcons
                    name="watch-variant"
                    size={34}
                    color="#d8d8d8"
                />
                <Text style={styles.navLabel}>Watch</Text>
            </Pressable>
        </View>
    );
}

export default function MusicHomeScreen() {
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
                            color="#111111"
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
                    {musicTracks.map((track) => (
                        <TrackRow key={track.title} {...track} />
                    ))}
                </ScrollView>

                <MiniPlayer />
                <BottomNav />
            </View>
        </AppScreen>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: "#ffffff",
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
        backgroundColor: "#f4f4f4",
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        gap: 10,
    },
    searchPlaceholder: {
        flex: 1,
        color: "#8f8f8f",
        fontSize: 15,
        includeFontPadding: false,
        paddingVertical: 0,
    },
    searchDivider: {
        width: 1,
        height: 18,
        backgroundColor: "#d2d2d2",
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
        color: "#ffffff",
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
    tabPillActive: {
        backgroundColor: "#000000",
    },
    tabText: {
        color: "#6f6f6f",
        fontSize: 18,
        fontWeight: "500",
    },
    tabActiveText: {
        color: "#ffffff",
        fontSize: 18,
        fontWeight: "700",
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
        backgroundColor: "#1f1f1f",
        justifyContent: "center",
        alignItems: "center",
    },
    shuffleText: {
        fontSize: 18,
        color: "#111111",
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
        color: "#f8fafc",
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
        color: "#2f2f2f",
        fontSize: 16,
        lineHeight: 21,
        fontWeight: "500",
        marginBottom: 6,
    },
    trackArtist: {
        color: "#8d8d8d",
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
        backgroundColor: "#d4cce0",
        flexDirection: "row",
        alignItems: "center",
        paddingLeft: 58,
        paddingRight: 18,
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
        color: "#ffffff",
        fontSize: 15,
        fontWeight: "700",
        lineHeight: 18,
        marginBottom: 6,
    },
    miniArtist: {
        color: "#f0eef3",
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
    bottomNav: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: 82,
        flexDirection: "row",
        justifyContent: "space-evenly",
        alignItems: "center",
        backgroundColor: "#ffffff",
        borderTopWidth: 0,
    },
    navItemActive: {
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
    },
    navItem: {
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
    },
    navLabelActive: {
        color: "#000000",
        fontSize: 14,
        fontWeight: "500",
    },
    navLabel: {
        color: "#bebebe",
        fontSize: 14,
        fontWeight: "500",
    },
});
