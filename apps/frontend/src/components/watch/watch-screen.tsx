import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppScreen } from "../app-screen";

const watchItems = [
    {
        title: "Live session clips",
        subtitle: "Highlights from recent plays and streams.",
        color: "#111111",
    },
    {
        title: "Lyric videos",
        subtitle: "Open the videos section for clips and visualizers.",
        color: "#3d748d",
    },
    {
        title: "Saved watches",
        subtitle: "Keep a short queue of things to return to later.",
        color: "#5b4db3",
    },
];

export default function WatchScreen() {
    return (
        <AppScreen backgroundColor="#101012" statusBarStyle="light">
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
                            color="#ffffff"
                        />
                    </Pressable>
                    <View>
                        <Text style={styles.kicker}>Watch</Text>
                        <Text style={styles.title}>
                            Video-first music views
                        </Text>
                    </View>
                </View>

                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {watchItems.map((item) => (
                        <View
                            key={item.title}
                            style={[styles.card, { borderColor: item.color }]}
                        >
                            <View
                                style={[
                                    styles.cardAccent,
                                    { backgroundColor: item.color },
                                ]}
                            />
                            <Text style={styles.cardTitle}>{item.title}</Text>
                            <Text style={styles.cardSubtitle}>
                                {item.subtitle}
                            </Text>
                        </View>
                    ))}
                </ScrollView>

                <View style={styles.bottomNav}>
                    <Pressable
                        accessibilityRole="button"
                        onPress={() => router.push("/")}
                        style={styles.navItem}
                    >
                        <MaterialCommunityIcons
                            name="headphones"
                            size={30}
                            color="#6e6e6e"
                        />
                        <Text style={styles.navLabel}>My music</Text>
                    </Pressable>
                    <View style={styles.navItemActive}>
                        <MaterialCommunityIcons
                            name="watch-variant"
                            size={34}
                            color="#ffffff"
                        />
                        <Text style={styles.navLabelActive}>Watch</Text>
                    </View>
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
        marginBottom: 18,
    },
    backButton: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: "rgba(255,255,255,0.1)",
        justifyContent: "center",
        alignItems: "center",
    },
    kicker: {
        color: "#9a9a9a",
        textTransform: "uppercase",
        letterSpacing: 1.1,
        fontSize: 12,
        fontWeight: "700",
        marginBottom: 2,
    },
    title: {
        color: "#ffffff",
        fontSize: 26,
        lineHeight: 30,
        fontWeight: "800",
    },
    scrollContent: {
        paddingTop: 4,
        paddingBottom: 120,
        gap: 14,
    },
    card: {
        borderRadius: 24,
        borderWidth: 1,
        padding: 18,
        backgroundColor: "rgba(255,255,255,0.04)",
        overflow: "hidden",
    },
    cardAccent: {
        width: 60,
        height: 6,
        borderRadius: 999,
        marginBottom: 14,
    },
    cardTitle: {
        color: "#ffffff",
        fontSize: 18,
        fontWeight: "700",
        marginBottom: 6,
    },
    cardSubtitle: {
        color: "#c6c6c6",
        fontSize: 14,
        lineHeight: 20,
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
        backgroundColor: "#101012",
    },
    navItem: {
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
    },
    navItemActive: {
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
    },
    navLabel: {
        color: "#6e6e6e",
        fontSize: 14,
        fontWeight: "500",
    },
    navLabelActive: {
        color: "#ffffff",
        fontSize: 14,
        fontWeight: "500",
    },
});
