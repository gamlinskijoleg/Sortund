import type { ReactNode } from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

type AppScreenProps = {
    children: ReactNode;
    backgroundColor?: string;
    edges?: Edge[];
    style?: ViewStyle;
    statusBarStyle?: "light" | "dark";
};

export function AppScreen({
    children,
    backgroundColor = "#ffffff",
    edges = ["top", "bottom"],
    style,
    statusBarStyle = "dark",
}: AppScreenProps) {
    return (
        <SafeAreaView
            style={[styles.safeArea, { backgroundColor }]}
            edges={edges}
        >
            <StatusBar style={statusBarStyle} />
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
