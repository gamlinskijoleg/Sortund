import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppScreen } from "../app-screen";
import { useAppTheme } from "../../theme/app-theme";

export default function WatchScreen() {
    const theme = useAppTheme();

    return (
        <AppScreen statusBarStyle="light">
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
                    <View>
                        <Text
                            style={[
                                styles.kicker,
                                { color: theme.text, opacity: 0.7 },
                            ]}
                        >
                            Watch
                        </Text>
                        <Text style={[styles.title, { color: theme.text }]}>
                            Video-first music views
                        </Text>
                    </View>
                </View>
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                ></ScrollView>
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
        justifyContent: "center",
        alignItems: "center",
    },
    kicker: {
        textTransform: "uppercase",
        letterSpacing: 1.1,
        fontSize: 12,
        fontWeight: "700",
        marginBottom: 2,
    },
    title: {
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
        overflow: "hidden",
    },
    cardAccent: {
        width: 60,
        height: 6,
        borderRadius: 999,
        marginBottom: 14,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: "700",
        marginBottom: 6,
    },
    cardSubtitle: {
        fontSize: 14,
        lineHeight: 20,
    },
});
