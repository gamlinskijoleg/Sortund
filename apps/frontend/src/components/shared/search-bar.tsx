import { MaterialCommunityIcons } from "@expo/vector-icons";
import { XStack, Text, View } from "tamagui";
import { useAppTheme } from "../../theme/app-theme";
import React from "react";
import { router } from "expo-router";

export function SearchBar({
    placeholder = "Search songs, playlists, and artists",
    onPress,
}: {
    placeholder?: string;
    onPress?: () => void;
}) {
    const theme = useAppTheme();

    return (
        <XStack
            flex={1}
            height={50}
            borderRadius={26}
            backgroundColor={theme.surface}
            alignItems="center"
            paddingHorizontal={14}
            gap={10}
            onPress={onPress ?? (() => router.push("/search"))}
        >
            <MaterialCommunityIcons
                name="magnify"
                size={24}
                color={theme.textSubtle}
            />
            <Text
                flex={1}
                fontSize={15}
                color={theme.textSubtle}
                numberOfLines={1}
            >
                {placeholder}
            </Text>
            <View width={1} height={18} backgroundColor={theme.border} />
            <MaterialCommunityIcons
                name="microphone"
                size={24}
                color={theme.textMuted}
            />
        </XStack>
    );
}
