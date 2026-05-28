import React, { useState, useCallback } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { YStack, XStack, Text, Image, Button, View, Slider } from "tamagui";

import { AppScreen } from "../app-screen";
import { getPlayerInstance, togglePlayback } from "../../player/music-player";
import { usePlayerStore } from "@/store/usePlayerStore";
import { useAppTheme } from "@/theme/app-theme";
import { AudioPlayer, useAudioPlayerStatus } from "expo-audio";

function formatTime(milliseconds: number) {
    const safeSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    const minutes = Math.floor(safeSeconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainder = safeSeconds % 60;
    if (hours > 0) {
        return `${hours}:${String(minutes % 60).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
    }
    return `${String(minutes % 60).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

interface SliderProps {
    player: AudioPlayer;
    fallbackDuration: number;
    theme: any;
}

// Ізольований компонент трекера для максимальної плавності (60+ FPS)
const PlaybackSlider = React.memo(
    ({ player, fallbackDuration, theme }: SliderProps) => {
        const { currentTime, duration } = useAudioPlayerStatus(player);

        // Локальний стейт для трекінгу пальця
        const [isSliding, setIsSliding] = useState(false);
        const [slidingValue, setSlidingValue] = useState(0);

        const playedMs = currentTime ? currentTime * 1000 : 0;
        const totalMs =
            duration && duration > 0 ? duration * 1000 : fallbackDuration;

        // Справжній прогрес треку від плеєра
        const currentProgressPercent =
            totalMs > 0 ? (playedMs / totalMs) * 100 : 0;

        // ВИПРАВЛЕННЯ БЛИМАННЯ: Показуємо АБО значення пальця, АБО прогрес плеєра
        const activeProgress = isSliding
            ? slidingValue
            : currentProgressPercent;

        // Визначаємо час для лічильника
        const displayPlayedMs = isSliding
            ? (slidingValue / 100) * totalMs
            : playedMs;

        // Спрацьовує при кожному русі пальця
        const handleValueChange = useCallback((values: number[]) => {
            if (values[0] !== undefined) {
                // Вмикаємо режим "ігнорування плеєра" і фіксуємо координату пальця
                setIsSliding(true);
                setSlidingValue(values[0]);
            }
        }, []);

        // Спрацьовує ТІЛЬКИ коли відпустили палець
        const handleSlidingComplete = useCallback(
            (event: any, value: number) => {
                if (totalMs <= 0 || value === undefined) {
                    setIsSliding(false);
                    return;
                }

                const newPositionSec = (value / 100) * (totalMs / 1000);

                if (player && typeof player.seekTo === "function") {
                    player.seekTo(newPositionSec);
                }

                // Маленький хак: залишаємо локальне значення пальця активним ще на 100мс,
                // щоб плеєр встиг зробити seek і не повернув старий час на один кадр
                setTimeout(() => {
                    setIsSliding(false);
                }, 1);
            },
            [player, totalMs]
        );

        return (
            <YStack marginBottom={20}>
                {/* Час треку */}
                <XStack justifyContent="space-between" marginBottom={8}>
                    <Text
                        color={isSliding ? theme.accent : theme.textMuted}
                        fontSize={13}
                        fontWeight="600"
                    >
                        {formatTime(displayPlayedMs)}
                    </Text>
                    <Text
                        color={theme.textMuted}
                        fontSize={13}
                        fontWeight="600"
                    >
                        {formatTime(totalMs)}
                    </Text>
                </XStack>

                <View height={20} justifyContent="center">
                    {/* 1. ФОНОВИЙ ФАНТОМНИЙ ТРЕК */}
                    {isSliding && (
                        <View
                            position="absolute"
                            left={0}
                            right={0}
                            height={8}
                            borderRadius={999}
                            backgroundColor="transparent"
                            pointerEvents="none"
                            zIndex={1}
                        >
                            <View
                                width={`${slidingValue}%`}
                                height="100%"
                                backgroundColor={theme.accent}
                                borderRadius={999}
                                opacity={0.3}
                            />
                        </View>
                    )}

                    {/* 2. ОСНОВНИЙ СЛАЙДЕР */}
                    <Slider
                        value={[activeProgress]} // Використовуємо очищене від блимань значення
                        onValueChange={handleValueChange}
                        onSlideEnd={handleSlidingComplete}
                        max={100}
                        step={0.5}
                        width="100%"
                        size="$2"
                    >
                        <Slider.Track
                            backgroundColor={theme.surfaceStrong}
                            height={8}
                            borderRadius={999}
                        >
                            <Slider.TrackActive
                                backgroundColor={
                                    isSliding ? theme.textMuted : theme.accent
                                }
                            />
                        </Slider.Track>
                        <Slider.Thumb
                            index={0}
                            circular
                            size={16}
                            backgroundColor={theme.accent}
                            elevate
                            borderColor={theme.background}
                            borderWidth={2}
                        />
                    </Slider>
                </View>
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
    theme: any;
}) => {
    const { playing } = useAudioPlayerStatus(player);
    return (
        <Button
            onPress={() => togglePlayback()}
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
    const { playNext, playPrevious } = usePlayerStore();

    // ВИПРАВЛЕНО: Якщо немає треку АБО плеєр ще не створився в initPlayer
    if (!activeTrack || !player) {
        return (
            <AppScreen backgroundColor={theme.background} statusBarStyle="dark">
                <YStack flex={1} justifyContent="center" alignItems="center">
                    <Text color={theme.textMuted} fontSize={16}>
                        Плеєр порожній або завантажується...
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
                {/* Верхня панель */}
                <XStack
                    alignItems="center"
                    justifyContent="space-between"
                    gap="$3"
                    marginBottom={20}
                >
                    <Button
                        onPress={() => router.back()}
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

                {/* Візуалізація обкладинки треку */}
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
                        backgroundColor={activeTrack.color || theme.accentSoft}
                        opacity={0.2}
                        transform={[{ scale: 1.2 }]}
                        style={{ filter: "blur(40px)" }}
                    />

                    <YStack
                        width={254}
                        height={254}
                        borderRadius={42}
                        backgroundColor={
                            activeTrack.color || theme.surfaceStrong
                        }
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
                        {activeTrack.artworkUrl ? (
                            <Image
                                source={{ uri: activeTrack.artworkUrl }}
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

                {/* Метадані треку */}
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

                {/* ВИПРАВЛЕНО: Сюди йде 100% солідний інстанс плеєра */}
                <PlaybackSlider
                    player={player}
                    fallbackDuration={activeTrack.duration || 0}
                    theme={theme}
                />

                {/* Елементи керування плеєром */}
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

                    {/* ВИПРАВЛЕНО: Винесено кнопку для безпечного виклику хука */}
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
