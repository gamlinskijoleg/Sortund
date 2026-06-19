import { Text } from "tamagui";
import { useAppTheme } from "../../theme/app-theme";
import React from "react";

export function AsyncListState({
    isLoading,
    error,
    loadingMessage = "Loading...",
    emptyMessage = "No items found.",
}: {
    isLoading: boolean;
    error: string | null;
    loadingMessage?: string;
    emptyMessage?: string;
}) {
    const theme = useAppTheme();

    if (isLoading) {
        return (
            <Text fontSize={15} padding={16} textAlign="center" color={theme.textMuted}>
                {loadingMessage}
            </Text>
        );
    }

    if (error) {
        return (
            <Text fontSize={15} padding={16} textAlign="center" color={theme.textMuted}>
                {error}
            </Text>
        );
    }

    return (
        <Text fontSize={15} padding={16} textAlign="center" color={theme.textMuted}>
            {emptyMessage}
        </Text>
    );
}
