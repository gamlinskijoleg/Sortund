import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppScreen } from "../app-screen";
import { librarySectionCopy, type LibrarySectionKey } from "../../data/music";

const libraryIcons: Record<
    LibrarySectionKey,
    keyof typeof MaterialCommunityIcons.glyphMap
> = {
    favourites: "heart",
    playlists: "playlist-music",
    recent: "clock-outline",
};

export default function LibrarySectionScreen() {
    const params = useLocalSearchParams<{ section?: string | string[] }>();
    const rawSection = Array.isArray(params.section)
        ? params.section[0]
        : params.section;
    const section = (
        rawSection && rawSection in librarySectionCopy
            ? rawSection
            : "favourites"
    ) as LibrarySectionKey;
    const copy = librarySectionCopy[section];

    return (
        <AppScreen>
            <View style={styles.screen}>
                <View style={styles.header}>
                    <Pressable
                        accessibilityRole="button"
                        onPress={() => router.back()}
                        style={styles.backButton}
                    >
                        <MaterialCommunityIcons
                            name="chevron-left"
                            size={30}
                            color="#111111"
                        />
                    </Pressable>
                    <View style={styles.headerTextWrap}>
                        <Text style={styles.kicker}>Library</Text>
                        <Text style={styles.title}>{copy.title}</Text>
                        <Text style={styles.subtitle}>{copy.subtitle}</Text>
                    </View>
                </View>

                <View style={styles.card}>
                    <MaterialCommunityIcons
                        name={libraryIcons[section]}
                        size={30}
                        color="#111111"
                    />
                    <Text style={styles.cardTitle}>Saved area view</Text>
                    <Text style={styles.cardSubtitle}>
                        This page is now route-driven, so it can grow into real
                        saved-area management without changing the home layout.
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
    },
    header: {
        flexDirection: "row",
        gap: 12,
        alignItems: "flex-start",
        marginBottom: 18,
    },
    backButton: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: "#f3f3f3",
        justifyContent: "center",
        alignItems: "center",
        marginTop: 2,
    },
    headerTextWrap: {
        flex: 1,
    },
    kicker: {
        color: "#8a8a8a",
        textTransform: "uppercase",
        letterSpacing: 1,
        fontSize: 12,
        fontWeight: "700",
        marginBottom: 4,
    },
    title: {
        color: "#111111",
        fontSize: 28,
        lineHeight: 32,
        fontWeight: "800",
        marginBottom: 6,
    },
    subtitle: {
        color: "#5f5f5f",
        fontSize: 15,
        lineHeight: 21,
    },
    card: {
        borderRadius: 24,
        backgroundColor: "#f6f4ff",
        padding: 18,
        gap: 10,
    },
    cardTitle: {
        fontSize: 18,
        lineHeight: 22,
        fontWeight: "700",
        color: "#111111",
    },
    cardSubtitle: {
        fontSize: 14,
        lineHeight: 20,
        color: "#4f4f4f",
    },
});
