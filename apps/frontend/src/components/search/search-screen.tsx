import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppScreen } from "../app-screen";
import { useAppTheme } from "../../theme/app-theme";

export default function SearchScreen() {
    const theme = useAppTheme();

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
                    <Text style={[styles.title, { color: theme.text }]}>
                        Search
                    </Text>
                </View>

                <View
                    style={[
                        styles.searchBox,
                        { backgroundColor: theme.surface },
                    ]}
                >
                    <MaterialCommunityIcons
                        name="magnify"
                        size={24}
                        color={theme.textSubtle}
                    />
                    <Text
                        style={[styles.searchText, { color: theme.textMuted }]}
                    >
                        Search songs, albums, and people
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
        alignItems: "center",
        gap: 12,
        marginBottom: 20,
    },
    backButton: {
        width: 34,
        height: 34,
        borderRadius: 17,
        justifyContent: "center",
        alignItems: "center",
    },
    title: {
        fontSize: 28,
        lineHeight: 32,
        fontWeight: "800",
    },
    searchBox: {
        minHeight: 58,
        borderRadius: 18,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 16,
        marginBottom: 18,
    },
    searchText: {
        flex: 1,
        fontSize: 16,
    },
    card: {
        borderRadius: 24,
        padding: 18,
    },
    cardTitle: {
        fontSize: 18,
        lineHeight: 22,
        fontWeight: "700",
        marginBottom: 14,
    },
    suggestionRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginBottom: 12,
    },
    suggestionText: {
        flex: 1,
        fontSize: 15,
        lineHeight: 20,
    },
});
