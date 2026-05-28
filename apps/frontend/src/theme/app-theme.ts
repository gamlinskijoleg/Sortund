import { useTheme } from "tamagui";

export type AppTheme = {
    background: string;
    surface: string;
    surfaceStrong: string;
    text: string;
    textMuted: string;
    textSubtle: string;
    border: string;
    accent: string;
    accentSoft: string;
    accentStrong: string;
    inverseText: string;
    shadow: string;
};

function readThemeValue(
    theme: Record<string, { val?: string } | undefined>,
    key: string,
    fallback: string
) {
    return theme[key]?.val ?? fallback;
}

export function useAppTheme(): AppTheme {
    const theme = useTheme();

    return {
        background: readThemeValue(theme, "background", "#ffffff"),
        surface: readThemeValue(theme, "backgroundHover", "#f4f4f4"),
        surfaceStrong: readThemeValue(theme, "backgroundPress", "#ededed"),
        text: readThemeValue(theme, "color", "#111111"),
        textMuted: readThemeValue(theme, "colorHover", "#6f6f6f"),
        textSubtle: readThemeValue(theme, "colorPress", "#8f8f8f"),
        border: readThemeValue(theme, "borderColor", "#d2d2d2"),
        accent: readThemeValue(theme, "blue10", "#3d748d"),
        accentSoft: readThemeValue(theme, "blue4", "#d9e6eb"),
        accentStrong: readThemeValue(theme, "blue12", "#2f7bb4"),
        inverseText: readThemeValue(theme, "background", "#ffffff"),
        shadow: readThemeValue(theme, "shadowColor", "rgba(0,0,0,0.12)"),
    };
}
