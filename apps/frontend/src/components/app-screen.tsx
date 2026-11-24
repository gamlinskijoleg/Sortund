import type { ReactNode } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { useAppTheme } from "../theme/app-theme";

type AppScreenProps = {
    children: ReactNode;
    backgroundColor?: string;
    edges?: Edge[];
    style?: ViewStyle;
    /** @deprecated the status bar follows the theme in the root layout */
    statusBarStyle?: "light" | "dark";
};

export function AppScreen({
    children,
    backgroundColor,
    edges = ["top", "bottom"],
    style,
}: AppScreenProps) {
    const theme = useAppTheme();

    return (
        <SafeAreaView
            style={[styles.safeArea, { backgroundColor: backgroundColor ?? theme.background }]}
            edges={edges}
        >
            <View style={[styles.container, style]}>{children}</View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    container: {
        flex: 1,
    },
});
