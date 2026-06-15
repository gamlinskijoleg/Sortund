import { MaterialCommunityIcons } from "@expo/vector-icons";
import { YStack, XStack, Text, Image } from "tamagui";
import { type MusicTrack } from "../../data/music";
import { useAppTheme } from "../../theme/app-theme";
import React from "react";

export function TrackListItem({
    track,
    onPress,
    trailingActionSlot,
}: {
    track: MusicTrack;
    onPress?: () => void;
    trailingActionSlot?: React.ReactNode;
}) {
    const theme = useAppTheme();
    const { title, artist, color } = track;
    return (
        <XStack
            alignItems="center"
            marginBottom={22}
            pressStyle={{ opacity: 0.84 }}
            onPress={onPress}
        >
            <XStack
                width={68}
                height={68}
                borderRadius={6}
                marginRight={14}
                backgroundColor={color}
                overflow="hidden"
                justifyContent="center"
                alignItems="center"
                position="relative"
            >
                <MaterialCommunityIcons
                    name="music-note"
                    size={16}
                    color={theme.inverseText}
                    style={{
                        position: "absolute",
                        top: 5,
                        left: 5,
                        opacity: 0.9,
                    }}
                />
                {track.artwork ? (
                    <Image
                        source={{ uri: track.artwork }}
                        style={{ width: "100%", height: "100%" }}
                        objectFit="cover"
                    />
                ) : (
                    <Text
                        color="rgba(255,255,255,0.18)"
                        fontSize={40}
                        lineHeight={42}
                        fontWeight="800"
                    >
                        67
                    </Text>
                )}
            </XStack>

            <YStack flex={1} paddingRight={10}>
                <Text
                    fontSize={16}
                    lineHeight={21}
                    fontWeight="500"
                    color={theme.text}
                    marginBottom={6}
                    numberOfLines={1}
                >
                    {title}
                </Text>
                <Text
                    fontSize={15}
                    lineHeight={19}
                    color={theme.textMuted}
                    numberOfLines={1}
                >
                    {artist}
                </Text>
            </YStack>

            {trailingActionSlot ? (
                trailingActionSlot
            ) : (
                <MaterialCommunityIcons
                    name="dots-vertical"
                    size={28}
                    color={theme.border}
                />
            )}
        </XStack>
    );
}
