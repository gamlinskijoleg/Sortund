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
    const themeValues = theme as unknown as Record<
        string,
        { val?: string } | undefined
    >;

    return {
        background: readThemeValue(themeValues, "background", "#ffffff"),
        surface: readThemeValue(themeValues, "backgroundHover", "#f4f4f4"),
        surfaceStrong: readThemeValue(
            themeValues,
            "backgroundPress",
            "#ededed"
        ),
        text: readThemeValue(themeValues, "color", "#111111"),
        textMuted: readThemeValue(themeValues, "colorHover", "#6f6f6f"),
        textSubtle: readThemeValue(themeValues, "colorPress", "#8f8f8f"),
        border: readThemeValue(themeValues, "borderColor", "#d2d2d2"),
        accent: readThemeValue(themeValues, "blue10", "#3d748d"),
        accentSoft: readThemeValue(themeValues, "blue4", "#d9e6eb"),
        accentStrong: readThemeValue(themeValues, "blue12", "#2f7bb4"),
        inverseText: readThemeValue(themeValues, "background", "#ffffff"),
        shadow: readThemeValue(themeValues, "shadowColor", "rgba(0,0,0,0.12)"),
    };
}
