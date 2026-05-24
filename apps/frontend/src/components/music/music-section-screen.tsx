import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppScreen } from "../app-screen";
import { musicSections, musicTracks } from "../../data/music";

function SectionTabs() {
    const pathname = usePathname();

    return (
        <View style={styles.tabsRow}>
            {musicSections.map((section) => {
                const isActive = pathname === section.href;

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

export default function MusicSectionScreen() {
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
                    <Pressable
                        accessibilityRole="button"
                        onPress={() => router.push("/search")}
                        style={styles.searchBar}
                    >
                        <MaterialCommunityIcons
                            name="magnify"
                            size={24}
                            color="#9a9a9a"
                        />
                        <Text
                            style={styles.searchPlaceholder}
                            numberOfLines={1}
                        >
                            Search songs, playlists, and artists
                        </Text>
                        <View style={styles.searchDivider} />
                        <MaterialCommunityIcons
                            name="microphone"
                            size={24}
                            color="#7f7f7f"
                        />
                    </Pressable>
                </View>

                <SectionTabs />

                <View style={styles.banner}>
                    <Text style={styles.bannerTitle}>
                        Browse the collection
                    </Text>
                    <Text style={styles.bannerSubtitle}>
                        Switch routes with the tabs above, or use the bottom bar
                        to jump between music and watch views.
                    </Text>
                </View>

                <ScrollView
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                >
                    {musicTracks.map((track) => (
                        <TrackRow key={track.title} {...track} />
                    ))}
                </ScrollView>

                <View style={styles.bottomNav}>
                    <Pressable
                        accessibilityRole="button"
                        onPress={() => router.push("/")}
                        style={styles.navItemActive}
                    >
                        <MaterialCommunityIcons
                            name="headphones"
                            size={30}
                            color="#111111"
                        />
                        <Text style={styles.navLabelActive}>My music</Text>
                    </Pressable>
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
    banner: {
        marginTop: 20,
        marginHorizontal: 16,
        borderRadius: 24,
        padding: 18,
        backgroundColor: "#f4f0e8",
    },
    bannerTitle: {
        fontSize: 22,
        lineHeight: 26,
        fontWeight: "800",
        color: "#111111",
        marginBottom: 8,
    },
    bannerSubtitle: {
        fontSize: 14,
        lineHeight: 20,
        color: "#595959",
    },
    listContent: {
        paddingHorizontal: 16,
        paddingTop: 18,
        paddingBottom: 118,
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
