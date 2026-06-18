import React, { useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { YStack, XStack, Text, Image, Button, View } from "tamagui";

import { AppScreen } from "../app-screen";
import { getPlayerInstance, togglePlayback } from "../../player/music-player";
import { usePlayerStore } from "@/store/usePlayerStore";
import { AppTheme, useAppTheme } from "@/theme/app-theme";
import { AudioPlayer, useAudioPlayerStatus } from "expo-audio";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-worklets";

function formatTime(milliseconds: number) {
    const safeSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    const minutes = Math.floor(safeSeconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainder = safeSeconds % 60;

    const formattedMins = String(minutes % 60).padStart(2, "0");
    const formattedSecs = String(remainder).padStart(2, "0");

    if (hours > 0) {
        return `${hours}:${formattedMins}:${formattedSecs}`;
    }
    return `${formattedMins}:${formattedSecs}`;
}

interface SliderProps {
    player: AudioPlayer;
    fallbackDuration: number;
    theme: AppTheme;
}

const PlaybackSlider = React.memo(
    ({ player, fallbackDuration, theme }: SliderProps) => {
        const { currentTime, duration } = useAudioPlayerStatus(player);

        const playedMs = currentTime ? currentTime * 1000 : 0;
        const totalMs = duration > 0 ? duration * 1000 : fallbackDuration;

        // 1. UI-Thread values for the 60fps gesture
        const width = useSharedValue(0);
        const progressMs = useSharedValue(0);
        const isSliding = useSharedValue(false);

        // 2. JS-Thread state specifically to override text ONLY when dragging
        const [slidingTimeMs, setSlidingTimeMs] = useState<number | null>(null);

        const updateSlidingTime = (newTimeMs: number) => {
            setSlidingTimeMs(newTimeMs);
        };

        const finalizeSeek = (newTimeMs: number) => {
            player.seekTo(newTimeMs / 1000);

            // Delay the "release" of the slider to ensure the player has time to update its currentTime and avoid janky jumps
            setTimeout(() => {
                isSliding.value = false;
                setSlidingTimeMs(null);
            }, 100);
        };

        const gesture = Gesture.Pan()
            .minDistance(0)
            .onBegin((e) => {
                isSliding.value = true;
                const percent = Math.max(0, Math.min(e.x / width.value, 1));
                const newTimeMs = percent * totalMs;

                progressMs.value = newTimeMs;
                runOnJS(updateSlidingTime)(newTimeMs);
            })
            .onUpdate((e) => {
                const percent = Math.max(0, Math.min(e.x / width.value, 1));
                const newTimeMs = percent * totalMs;

                progressMs.value = newTimeMs;
                runOnJS(updateSlidingTime)(newTimeMs);
            })
            .onFinalize(() => {
                // Whether it was a long drag or a quick tap, progressMs.value
                // holds the exact right coordinate. Just seek to it!
                runOnJS(finalizeSeek)(progressMs.value);
            });

        // 4. Dynamically pick whether to animate based on the gesture OR real time
        const animatedStyle = useAnimatedStyle(() => {
            const activeTimeMs = isSliding.value ? progressMs.value : playedMs;
            // Avoid division by zero
            const percent = totalMs > 0 ? (activeTimeMs / totalMs) * 100 : 0;

            return {
                width: `${percent}%`,
            };
        });

        // 5. Pick the text time
        const displayTimeMs = slidingTimeMs !== null ? slidingTimeMs : playedMs;

        return (
            <YStack marginBottom={20}>
                {/* Track Time Text */}
                <XStack justifyContent="space-between" marginBottom={8}>
                    <Text
                        color={
                            slidingTimeMs !== null
                                ? theme.accent
                                : theme.textMuted
                        }
                        fontSize={13}
                        fontWeight="600"
                    >
                        {formatTime(displayTimeMs)}
                    </Text>
                    <Text
                        color={theme.textMuted}
                        fontSize={13}
                        fontWeight="600"
                    >
                        {formatTime(totalMs)}
                    </Text>
                </XStack>

                {/* Reanimated Custom Slider Track */}
                <GestureDetector gesture={gesture}>
                    <View
                        onLayout={(e) => {
                            width.value = e.nativeEvent.layout.width;
                        }}
                        height={24}
                        justifyContent="center"
                        width="100%"
                    >
                        {/* Background Track */}
                        <View
                            height={8}
                            width="100%"
                            backgroundColor={theme.surfaceStrong}
                            borderRadius={999}
                        />

                        {/* Active Track */}
                        <Animated.View
                            style={[
                                {
                                    position: "absolute",
                                    height: 8,
                                    borderRadius: 999,
                                    backgroundColor: theme.accent,
                                },
                                animatedStyle,
                            ]}
                        />

                        {/* Thumb / Marker */}
                        <Animated.View
                            style={[
                                {
                                    position: "absolute",
                                    width: 16,
                                    height: 16,
                                    borderRadius: 8,
                                    backgroundColor: theme.accent,
                                    borderWidth: 2,
                                    borderColor: theme.background,
                                    elevation: 2,
                                    shadowColor: "#000",
                                    shadowOffset: { width: 0, height: 1 },
                                    shadowOpacity: 0.2,
                                    shadowRadius: 1.41,
                                    // Offset the thumb so its center aligns with the end of the active track
                                    transform: [{ translateX: -8 }],
                                    // Anchor to the left side
                                },
                                // We map the width percentage to the left position of the thumb
                                useAnimatedStyle(() => {
                                    const activeTimeMs = isSliding.value
                                        ? progressMs.value
                                        : playedMs;
                                    const percent =
                                        totalMs > 0
                                            ? (activeTimeMs / totalMs) * 100
                                            : 0;
                                    return { left: `${percent}%` };
                                }),
                            ]}
                        />
                    </View>
                </GestureDetector>
            </YStack>
        );
    }
);

PlaybackSlider.displayName = "PlaybackSlider";

const PlayPauseButton = ({
    player,
    theme,
}: {
    player: AudioPlayer;
    theme: AppTheme;
}) => {
    const { playing } = useAudioPlayerStatus(player);
    return (
        <Button
            onPress={togglePlayback}
            width={84}
            height={84}
            borderRadius={42}
            backgroundColor={theme.accent}
            pressStyle={{ backgroundColor: theme.accentStrong }}
            justifyContent="center"
            alignItems="center"
            padding={0}
            elevation={12}
            shadowColor={theme.shadow}
        >
            <MaterialCommunityIcons
                name={playing ? "pause" : "play"}
                size={36}
                color={theme.inverseText}
                style={playing ? undefined : { marginLeft: 4 }}
            />
        </Button>
    );
};

export default function MusicListenScreen() {
    const theme = useAppTheme();
    const player = getPlayerInstance();
    const activeTrack = usePlayerStore((state) => state.activeTrack);

    const playNext = usePlayerStore((state) => state.playNext);
    const playPrevious = usePlayerStore((state) => state.playPrevious);

    if (!activeTrack || !player) {
        return (
            <AppScreen backgroundColor={theme.background} statusBarStyle="dark">
                <YStack flex={1} justifyContent="center" alignItems="center">
                    <Text color={theme.textMuted} fontSize={16}>
                        Player is empty or loading...
                    </Text>
                </YStack>
            </AppScreen>
        );
    }

    return (
        <AppScreen backgroundColor={theme.background} statusBarStyle="dark">
            <YStack
                flex={1}
                paddingHorizontal={16}
                paddingTop={8}
                paddingBottom={16}
            >
                {/* Top panel */}
                <XStack
                    alignItems="center"
                    justifyContent="space-between"
                    gap="$3"
                    marginBottom={20}
                >
                    <Button
                        onPress={router.back}
                        width={42}
                        height={42}
                        borderRadius={21}
                        backgroundColor={theme.surface}
                        pressStyle={{ backgroundColor: theme.surfaceStrong }}
                        justifyContent="center"
                        alignItems="center"
                        padding={0}
                        chromeless
                    >
                        <MaterialCommunityIcons
                            name="chevron-left"
                            size={30}
                            color={theme.text}
                        />
                    </Button>

                    <YStack
                        flex={1}
                        alignItems="center"
                        justifyContent="center"
                    >
                        <Text
                            color={theme.textMuted}
                            fontSize={12}
                            fontWeight="700"
                            textTransform="uppercase"
                            letterSpacing={1.2}
                        >
                            Now playing
                        </Text>
                        <Text
                            color={theme.text}
                            fontSize={16}
                            fontWeight="700"
                            marginTop={2}
                            numberOfLines={1}
                        >
                            Listening screen
                        </Text>
                    </YStack>

                    <Button
                        width={42}
                        height={42}
                        borderRadius={21}
                        backgroundColor={theme.surface}
                        pressStyle={{ backgroundColor: theme.surfaceStrong }}
                        justifyContent="center"
                        alignItems="center"
                        padding={0}
                        chromeless
                    >
                        <MaterialCommunityIcons
                            name="playlist-music"
                            size={24}
                            color={theme.text}
                        />
                    </Button>
                </XStack>

                {/* Track cover visualization */}
                <YStack
                    alignItems="center"
                    justifyContent="center"
                    marginTop={8}
                    marginBottom={16}
                    minHeight={300}
                >
                    <View
                        position="absolute"
                        width={280}
                        height={280}
                        borderRadius={140}
                        backgroundColor={activeTrack.color}
                        opacity={0.2}
                        transform={[{ scale: 1.2 }]}
                        style={{ filter: "blur(40px)" }}
                    />

                    <YStack
                        width={254}
                        height={254}
                        borderRadius={42}
                        backgroundColor={activeTrack.color}
                        justifyContent="center"
                        alignItems="center"
                        overflow="hidden"
                        elevation={18}
                        shadowColor={theme.shadow}
                        shadowOpacity={0.2}
                        shadowRadius={24}
                        shadowOffset={{ width: 0, height: 16 }}
                    >
                        <View
                            position="absolute"
                            top={0}
                            left={0}
                            right={0}
                            bottom={0}
                            backgroundColor="rgba(255,255,255,0.04)"
                            zIndex={2}
                        />
                        {activeTrack.artwork ? (
                            <Image
                                source={{ uri: activeTrack.artwork }}
                                width="100%"
                                height="100%"
                                resizeMode="cover"
                            />
                        ) : (
                            <MaterialCommunityIcons
                                name="music-note"
                                size={58}
                                color={theme.inverseText}
                            />
                        )}
                    </YStack>
                </YStack>

                {/* Track metadata */}
                <YStack alignItems="center" marginBottom={16}>
                    <Text
                        color={theme.text}
                        fontSize={24}
                        lineHeight={30}
                        fontWeight="800"
                        textAlign="center"
                        numberOfLines={2}
                    >
                        {activeTrack.title}
                    </Text>
                    <Text
                        color={theme.textMuted}
                        fontSize={16}
                        fontWeight="500"
                        marginTop={8}
                        textAlign="center"
                        numberOfLines={1}
                    >
                        {activeTrack.artist}
                    </Text>
                </YStack>

                {/* 100% Solid Custom Reanimated Player */}
                <PlaybackSlider
                    player={player}
                    fallbackDuration={activeTrack.duration || 0}
                    theme={theme}
                />

                {/* Player controls */}
                <XStack
                    alignItems="center"
                    justifyContent="space-between"
                    paddingHorizontal={24}
                    marginBottom={16}
                >
                    <Button
                        onPress={playPrevious}
                        width={56}
                        height={56}
                        borderRadius={28}
                        backgroundColor={theme.surface}
                        pressStyle={{ backgroundColor: theme.surfaceStrong }}
                        justifyContent="center"
                        alignItems="center"
                        padding={0}
                        chromeless
                    >
                        <MaterialCommunityIcons
                            name="skip-previous"
                            size={28}
                            color={theme.text}
                        />
                    </Button>

                    <PlayPauseButton player={player} theme={theme} />

                    <Button
                        onPress={playNext}
                        width={56}
                        height={56}
                        borderRadius={28}
                        backgroundColor={theme.surface}
                        pressStyle={{ backgroundColor: theme.surfaceStrong }}
                        justifyContent="center"
                        alignItems="center"
                        padding={0}
                        chromeless
                    >
                        <MaterialCommunityIcons
                            name="skip-next"
                            size={28}
                            color={theme.text}
                        />
                    </Button>
                </XStack>
            </YStack>
        </AppScreen>
    );
}
