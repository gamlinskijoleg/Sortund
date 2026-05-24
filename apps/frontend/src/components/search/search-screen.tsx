import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppScreen } from "../app-screen";
import { searchSuggestions } from "../../data/music";

export default function SearchScreen() {
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
                    <Text style={styles.title}>Search</Text>
                </View>

                <View style={styles.searchBox}>
                    <MaterialCommunityIcons
                        name="magnify"
                        size={24}
                        color="#9a9a9a"
                    />
                    <Text style={styles.searchText}>
                        Search songs, albums, and people
                    </Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Quick prompts</Text>
                    {searchSuggestions.map((suggestion) => (
                        <View key={suggestion} style={styles.suggestionRow}>
                            <MaterialCommunityIcons
                                name="radio-tower"
                                size={18}
                                color="#5b4db3"
                            />
                            <Text style={styles.suggestionText}>
                                {suggestion}
                            </Text>
                        </View>
                    ))}
                </View>
            </View>
        </AppScreen>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        paddingHorizontal: 16,
        backgroundColor: "#ffffff",
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
        backgroundColor: "#f3f3f3",
        justifyContent: "center",
        alignItems: "center",
    },
    title: {
        fontSize: 28,
        lineHeight: 32,
        fontWeight: "800",
        color: "#111111",
    },
    searchBox: {
        minHeight: 58,
        borderRadius: 18,
        backgroundColor: "#f4f4f4",
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 16,
        marginBottom: 18,
    },
    searchText: {
        flex: 1,
        color: "#8f8f8f",
        fontSize: 16,
    },
    card: {
        borderRadius: 24,
        backgroundColor: "#f9f7fd",
        padding: 18,
    },
    cardTitle: {
        fontSize: 18,
        lineHeight: 22,
        fontWeight: "700",
        marginBottom: 14,
        color: "#111111",
    },
    suggestionRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginBottom: 12,
    },
    suggestionText: {
        flex: 1,
        color: "#4b4b4b",
        fontSize: 15,
        lineHeight: 20,
    },
});
