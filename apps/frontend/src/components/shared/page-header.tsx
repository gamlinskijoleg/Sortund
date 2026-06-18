import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { XStack, Text, YStack } from "tamagui";
import { useAppTheme } from "../../theme/app-theme";
import React from "react";

export function PageHeader({
    title,
    subtitle,
    showBackButton = true,
    trailingAction,
}: {
    title?: string;
    subtitle?: string;
    showBackButton?: boolean;
    trailingAction?: React.ReactNode;
}) {
    const theme = useAppTheme();

    return (
        <YStack marginBottom={20}>
            <XStack alignItems="center" justifyContent="space-between">
                <XStack alignItems="center" gap={12}>
                    {showBackButton && (
                        <XStack
                            pressStyle={{ opacity: 0.7 }}
                            onPress={router.back}
                        >
                            <MaterialCommunityIcons
                                name="chevron-left"
                                size={30}
                                color={theme.text}
                            />
                        </XStack>
                    )}

                    {title && (
                        <Text
                            fontSize={28}
                            lineHeight={32}
                            fontWeight="800"
                            color={theme.text}
                        >
                            {title}
                        </Text>
                    )}
                </XStack>
                {trailingAction && trailingAction}
            </XStack>
            {subtitle && (
                <Text fontSize={15} color={theme.textMuted} marginTop={8}>
                    {subtitle}
                </Text>
            )}
        </YStack>
    );
}
