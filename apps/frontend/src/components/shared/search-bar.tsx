import { MaterialCommunityIcons } from "@expo/vector-icons";
import { XStack, Text, View, Input } from "tamagui";
import { useAppTheme } from "../../theme/app-theme";
import React from "react";
import { router } from "expo-router";

export function SearchBar({
    placeholder = "Search songs, playlists, and artists",
    onPress,
    value,
    onChangeText,
    autoFocus,
}: {
    placeholder?: string;
    onPress?: () => void;
    value?: string;
    onChangeText?: (text: string) => void;
    autoFocus?: boolean;
}) {
    const theme = useAppTheme();
    const isInteractive = onChangeText !== undefined;

    return (
        <XStack
            height={40}
            flex={1}
            borderRadius={26}
            paddingHorizontal={8}
            paddingVertical={0}
            backgroundColor={theme.surfaceStrong}
            alignItems="center"
            gap={4}
            onPress={onPress ?? (() => router.push("/search"))}
        >
            <MaterialCommunityIcons name="magnify" size={20} color={theme.textMuted} />
            {isInteractive ? (
                <Input
                    marginLeft={8}
                    borderWidth={0}
                    flex={1}
                    paddingHorizontal={0}
                    paddingVertical={0}
                    height={"100%"}
                    backgroundColor="transparent"
                    color={theme.text}
                    fontSize={12}
                    placeholder={placeholder}
                    placeholderTextColor={theme.textPlaceholder}
                    value={value}
                    onChangeText={onChangeText}
                    autoFocus={autoFocus}
                    focusStyle={{ outlineWidth: 0 }}
                />
            ) : (
                <Text flex={1} fontSize={12} color={theme.textSubtle} numberOfLines={1}>
                    {placeholder}
                </Text>
            )}
            {value && isInteractive && (
                <XStack>
                    <MaterialCommunityIcons
                        onPress={() => onChangeText?.("")}
                        color={theme.textPlaceholder}
                        name="close-circle"
                        size={20}
                    />
                </XStack>
            )}
            <View width={1} height={"50%"} backgroundColor={theme.textPlaceholder} />
            <MaterialCommunityIcons name="microphone" size={20} color={theme.textPlaceholder} />
        </XStack>
    );
}
