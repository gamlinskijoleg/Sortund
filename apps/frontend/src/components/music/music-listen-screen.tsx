import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppScreen } from "../app-screen";

export default function MusicListenScreen() {
    return (
        <AppScreen backgroundColor="#0b0d12" statusBarStyle="light">
            <View style={styles.screen}>
                <View style={styles.iconWrap}>
                    <MaterialCommunityIcons
                        name="music-note"
                        size={54}
                        color="#ffffff"
                    />
                </View>
                <Text style={styles.title}>Listening screen</Text>
                <Text style={styles.body}>
                    Audio playback is available in the native app build with
                    React Native Track Player.
                </Text>
                <Pressable
                    accessibilityRole="button"
                    onPress={() => router.back()}
                    style={styles.button}
                >
                    <Text style={styles.buttonText}>Go back</Text>
                </Pressable>
            </View>
        </AppScreen>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        paddingHorizontal: 24,
        justifyContent: "center",
        alignItems: "center",
        gap: 16,
    },
    iconWrap: {
        width: 120,
        height: 120,
        borderRadius: 38,
        backgroundColor: "rgba(255,255,255,0.1)",
        justifyContent: "center",
        alignItems: "center",
    },
    title: {
        color: "#f8fafc",
        fontSize: 26,
        fontWeight: "800",
        textAlign: "center",
    },
    body: {
        color: "rgba(248,250,252,0.72)",
        fontSize: 15,
        lineHeight: 21,
        textAlign: "center",
        maxWidth: 320,
    },
    button: {
        marginTop: 8,
        paddingHorizontal: 18,
        paddingVertical: 12,
        borderRadius: 999,
        backgroundColor: "#ffffff",
    },
    buttonText: {
        color: "#0b0d12",
        fontSize: 15,
        fontWeight: "700",
    },
});
