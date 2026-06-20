import { useTheme } from "tamagui";

export function useAppTheme(): Record<string, string> {
    const theme = useTheme();

    return {
        background: theme.background.val,
        surface: theme.backgroundHover.val,
        surfaceStrong: theme.backgroundPress.val,
        text: theme.color.val,
        textMuted: theme.colorHover.val,
        textSubtle: theme.colorPress.val,
        textPlaceholder: theme.placeholderColor.val,
        border: theme.borderColor.val,

        accent: (theme as Record<string, { val?: string }>).brandPink?.val || "#a53a67",
        accentSoft: (theme as Record<string, { val?: string }>).brandSoft?.val || "#f5d3d8",
        accentStrong: (theme as Record<string, { val?: string }>).brandBlue?.val || "#3d748d",

        inverseText: theme.background.val,
        inverseTextMuted: "$brandPink",
        shadow: theme.shadowColor.val,
    };
}

export type AppTheme = ReturnType<typeof useAppTheme>;
