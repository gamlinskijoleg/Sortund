import { MaterialCommunityIcons } from "@expo/vector-icons";
import { YStack, XStack, Text, View } from "tamagui";
import { SafeAreaView } from "react-native-safe-area-context";
import { AudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { type MusicTrack } from "../../data/music";
import { useAppTheme } from "../../theme/app-theme";
import React from "react";

export function MiniPlayer({
    track,
    onPress,
    onPlayPause,
    playNext,
    activePlayerInstance,
}: {
    track: MusicTrack;
    onPress: () => void;
    onPlayPause: (track: MusicTrack) => void;
    playNext: () => void;
    activePlayerInstance: AudioPlayer;
}) {
    const { playing } = useAudioPlayerStatus(activePlayerInstance);
    const theme = useAppTheme();

    return (
        <SafeAreaView>
            <XStack
                position="absolute"
                left={16}
                right={16}
                bottom={70}
                height={40}
                borderRadius={22}
                backgroundColor={theme.accent}
                alignItems="center"
                paddingLeft={58}
                paddingRight={18}
                paddingVertical={6}
                pressStyle={{ opacity: 0.92 }}
                onPress={onPress}
            >
                <YStack flex={1}>
                    <Text
                        fontSize={12}
                        fontWeight="700"
                        color={theme.inverseText}
                        numberOfLines={1}
                    >
                        {track?.title ?? "Loading local music"}
                    </Text>
                    <Text
                        fontSize={12}
                        fontWeight="500"
                        color={theme.inverseTextMuted}
                        opacity={0.82}
                        numberOfLines={1}
                    >
                        {track?.artist ?? "Scanning your music files"}
                    </Text>
                </YStack>

                <XStack alignItems="center" gap={18} paddingLeft={10}>
                    <XStack
                        onPress={(e) => {
                            e.stopPropagation();
                            onPlayPause(track);
                        }}
                        width={24}
                        aspectRatio={1}
                        borderRadius={17}
                        borderWidth={2}
                        borderColor="rgba(255,255,255,0.65)"
                        justifyContent="center"
                        alignItems="center"
                    >
                        <MaterialCommunityIcons
                            name={playing ? "pause" : "play"}
                            size={16}
                            color={theme.inverseText}
                        />
                    </XStack>
                    <MaterialCommunityIcons
                        onPress={(e) => {
                            e.stopPropagation();
                            playNext();
                        }}
                        name="skip-next"
                        size={18}
                        color={theme.inverseText}
                    />
                </XStack>
            </XStack>
            {/* Vinyl */}
            <View
                position="absolute"
                left={16}
                bottom={70}
                height={50}
                aspectRatio={1}
                borderRadius={28}
                borderWidth={6}
                borderColor="#4f465d"
                justifyContent="center"
                alignItems="center"
                pointerEvents="none"
            >
                <XStack
                    width={40}
                    height={40}
                    borderRadius={22}
                    backgroundColor={track?.color ?? theme.accent}
                    justifyContent="center"
                    alignItems="center"
                    overflow="hidden"
                >
                    <Text color="rgba(255,255,255,0.18)" fontWeight="800">
                        M
                    </Text>
                </XStack>
            </View>
        </SafeAreaView>
    );
}
