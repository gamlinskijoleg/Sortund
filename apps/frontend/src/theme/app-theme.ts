import { useTheme } from "tamagui";

export function useAppTheme() {
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

        accent: theme.brandPink.val,
        accentSoft: theme.brandSoft.val,
        accentStrong: theme.brandBlue.val,

        inverseText: theme.background.val,
        inverseTextMuted: "$brandPink",
        shadow: theme.shadowColor.val,
    };
}

export type AppTheme = ReturnType<typeof useAppTheme>;
