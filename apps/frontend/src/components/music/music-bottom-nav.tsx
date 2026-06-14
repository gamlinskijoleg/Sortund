import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppTheme } from "../../theme/app-theme";

const musicRoutes = new Set(["/", "/artists", "/albums"]);

export function MusicBottomNav() {
    const theme = useAppTheme();
    const pathname = usePathname();
    const insets = useSafeAreaInsets();

    if (!musicRoutes.has(pathname) && pathname !== "/watch") {
        return null;
    }

    return (
        <View
            style={[
                styles.bottomNav,
                {
                    backgroundColor: "#fff",
                    borderTopColor: theme.border,
                    paddingBottom: insets.bottom,
                    height: 52 + insets.bottom,
                },
            ]}
        >
            <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/")}
                style={styles.navItem}
            >
                <MaterialCommunityIcons
                    name="headphones"
                    size={20}
                    color={theme.text}
                />
                <Text style={[styles.navLabel, { color: theme.text }]}>
                    My music
                </Text>
            </Pressable>

            <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/watch")}
                style={styles.navItem}
            >
                <MaterialCommunityIcons
                    name="television-classic"
                    size={20}
                    color={theme.textSubtle}
                />
                <Text
                    style={[
                        styles.navLabel,
                        {
                            color: theme.textSubtle,
                        },
                    ]}
                >
                    Watch
                </Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    bottomNav: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: 52,
        flexDirection: "row",
        justifyContent: "space-between",
        paddingHorizontal: "20%",
        alignItems: "center",
        borderTopWidth: 1,
    },
    navItem: {
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
    },
    navLabel: {
        fontSize: 12,
        fontWeight: "500",
    },
});
