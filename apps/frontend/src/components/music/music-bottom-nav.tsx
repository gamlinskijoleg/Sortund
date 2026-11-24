import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useT, type TranslationKey } from "../../i18n";
import { useAppTheme } from "../../theme/app-theme";

type Tab = {
    href: "/" | "/ai-sync" | "/library" | "/stats" | "/settings";
    label: TranslationKey;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
};

const TABS: Tab[] = [
    { href: "/", label: "nav.music", icon: "music-note" },
    { href: "/ai-sync", label: "nav.ai", icon: "creation" },
    { href: "/library", label: "nav.library", icon: "bookshelf" },
    { href: "/stats", label: "nav.stats", icon: "chart-bar" },
    { href: "/settings", label: "nav.settings", icon: "cog-outline" },
];

export const TAB_ROUTES = new Set<string>(TABS.map((t) => t.href));
export const NAV_HEIGHT = 56;

export function MusicBottomNav() {
    const theme = useAppTheme();
    const t = useT();
    const pathname = usePathname();
    const insets = useSafeAreaInsets();

    if (!TAB_ROUTES.has(pathname)) return null;

    return (
        <View
            style={[
                styles.nav,
                {
                    backgroundColor: theme.navBackground,
                    borderTopColor: theme.border,
                    paddingBottom: insets.bottom,
                    height: NAV_HEIGHT + insets.bottom,
                },
            ]}
        >
            {TABS.map((tab) => {
                const active = pathname === tab.href;
                const color = active ? theme.accent : theme.textSubtle;
                return (
                    <Pressable
                        key={tab.href}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: active }}
                        onPress={() => {
                            if (!active) router.replace(tab.href);
                        }}
                        style={styles.item}
                    >
                        <MaterialCommunityIcons name={tab.icon} size={22} color={color} />
                        <Text style={[styles.label, { color }]} numberOfLines={1}>
                            {t(tab.label)}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    nav: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        flexDirection: "row",
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    item: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2, paddingTop: 6 },
    label: { fontSize: 11, fontWeight: "600" },
});
