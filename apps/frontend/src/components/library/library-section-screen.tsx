import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppScreen } from "../app-screen";
import { librarySectionCopy, type LibrarySectionKey } from "../../data/music";
import { useAppTheme } from "../../theme/app-theme";

const libraryIcons: Record<
    LibrarySectionKey,
    keyof typeof MaterialCommunityIcons.glyphMap
> = {
    favourites: "heart",
    playlists: "playlist-music",
    recent: "clock-outline",
};

export default function LibrarySectionScreen() {
    const theme = useAppTheme();

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
                            color={theme.text}
                        />
                    </Pressable>
                    <View style={styles.headerTextWrap}>
                        <Text
                            style={[styles.kicker, { color: theme.textMuted }]}
                        >
                            Library
                        </Text>
                        <Text style={[styles.title, { color: theme.text }]}>
                            {copy.title}
                        </Text>
                        <Text
                            style={[
                                styles.subtitle,
                                { color: theme.textMuted },
                            ]}
                        >
                            {copy.subtitle}
                        </Text>
                    </View>
                </View>

                <View
                    style={[
                        styles.card,
                        { backgroundColor: theme.surfaceStrong },
                    ]}
                >
                    <MaterialCommunityIcons
                        name={libraryIcons[section]}
                        size={30}
                        color={theme.text}
                    />
                    <Text style={[styles.cardTitle, { color: theme.text }]}>
                        Saved area view
                    </Text>
                    <Text
                        style={[
                            styles.cardSubtitle,
                            { color: theme.textMuted },
                        ]}
                    >
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
        justifyContent: "center",
        alignItems: "center",
        marginTop: 2,
    },
    headerTextWrap: {
        flex: 1,
    },
    kicker: {
        textTransform: "uppercase",
        letterSpacing: 1,
        fontSize: 12,
        fontWeight: "700",
        marginBottom: 4,
    },
    title: {
        fontSize: 28,
        lineHeight: 32,
        fontWeight: "800",
        marginBottom: 6,
    },
    subtitle: {
        fontSize: 15,
        lineHeight: 21,
    },
    card: {
        borderRadius: 24,
        padding: 18,
        gap: 10,
    },
    cardTitle: {
        fontSize: 18,
        lineHeight: 22,
        fontWeight: "700",
    },
    cardSubtitle: {
        fontSize: 14,
        lineHeight: 20,
    },
});
