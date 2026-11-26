import { useColorScheme } from "react-native";
import { useSettingsStore } from "../store/useSettingsStore";

/**
 * Monochrome palette: black, white and greys only. Status colours (success/danger/warning)
 * intentionally equal the text colour; states are told apart by icons and wording, not hue.
 */
const light = {
    background: "#ffffff",
    surface: "#f2f2f2",
    surfaceStrong: "#e6e6e6",
    elevated: "#f4f4f4",
    text: "#0a0a0a",
    textMuted: "#525252",
    textSubtle: "#6b6b6b",
    textPlaceholder: "#a3a3a3",
    border: "#e5e5e5",
    accent: "#0a0a0a",
    accentSoft: "#e6e6e6",
    accentStrong: "#000000",
    inverseText: "#ffffff",
    inverseTextMuted: "#d4d4d4",
    shadow: "#000000",
    success: "#0a0a0a",
    danger: "#0a0a0a",
    warning: "#0a0a0a",
    navBackground: "#ffffff",
    overlay: "rgba(0,0,0,0.35)",
};

const dark: typeof light = {
    background: "#000000",
    surface: "#111111",
    surfaceStrong: "#1f1f1f",
    elevated: "#1c1c1c",
    text: "#fafafa",
    textMuted: "#a3a3a3",
    textSubtle: "#8a8a8a",
    textPlaceholder: "#6b6b6b",
    border: "#1f1f1f",
    accent: "#fafafa",
    accentSoft: "#262626",
    accentStrong: "#ffffff",
    inverseText: "#000000",
    inverseTextMuted: "#525252",
    shadow: "#000000",
    success: "#fafafa",
    danger: "#fafafa",
    warning: "#fafafa",
    navBackground: "#000000",
    overlay: "rgba(0,0,0,0.6)",
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
