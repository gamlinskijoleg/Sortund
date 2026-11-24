import { useColorScheme } from "react-native";
import { useSettingsStore } from "../store/useSettingsStore";

const light = {
    background: "#ffffff",
    surface: "#f3f3f6",
    surfaceStrong: "#e9e9ef",
    text: "#141418",
    textMuted: "#5d5f6b",
    textSubtle: "#8a8c97",
    textPlaceholder: "#a3a5ae",
    border: "#e3e4ea",
    accent: "#a53a67",
    accentSoft: "#f5d3df",
    accentStrong: "#3d748d",
    inverseText: "#ffffff",
    inverseTextMuted: "#f3dbe5",
    shadow: "#000000",
    success: "#1f8a4c",
    danger: "#c0392b",
    warning: "#b7791f",
    navBackground: "#ffffff",
};

const dark: typeof light = {
    background: "#111216",
    surface: "#1c1d23",
    surfaceStrong: "#272830",
    text: "#eef0f4",
    textMuted: "#a5a8b4",
    textSubtle: "#7d808c",
    textPlaceholder: "#6a6d78",
    border: "#2c2e36",
    accent: "#d0588a",
    accentSoft: "#4a2536",
    accentStrong: "#5ba3c4",
    inverseText: "#ffffff",
    inverseTextMuted: "#f3dbe5",
    shadow: "#000000",
    success: "#3fbf75",
    danger: "#e5675a",
    warning: "#e0a84a",
    navBackground: "#16171c",
};

export type AppTheme = typeof light;

export function useResolvedScheme(): "light" | "dark" {
    const mode = useSettingsStore((s) => s.themeMode);
    const system = useColorScheme();
    if (mode === "system") return system === "dark" ? "dark" : "light";
    return mode;
}

/** Colours of the current theme: light, dark or following the system setting. */
export function useAppTheme(): AppTheme {
    return useResolvedScheme() === "dark" ? dark : light;
}
