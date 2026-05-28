import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { YStack, XStack, Text, View } from "tamagui";

import { AppScreen } from "../app-screen";
import {
    createListenRoute,
    featureCards,
    musicSections,
    type MusicTrack,
    useMusicTracks,
} from "../../data/music";
import { useAppTheme } from "../../theme/app-theme";
import { usePlayerStore } from "@/store/usePlayerStore";
import { FlatList } from "react-native";

function MusicSearchBar() {
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
            onPress={() => router.push("/search")}
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
                Search songs, playlists, and artists
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

function MusicFeatureCard({
    title,
    color,
    href,
}: {
    title: string;
    color: string;
    href: "/library/favourites" | "/library/playlists" | "/library/recent";
}) {
    const theme = useAppTheme();
    const iconName =
        title === "Favourites"
            ? "heart"
            : title === "Playlists"
              ? "playlist-music"
              : "clock-outline";

    return (
        <YStack
            flex={1}
            minHeight={84}
            borderRadius={20}
            padding={12}
            backgroundColor={color}
            justifyContent="space-between"
            pressStyle={{ opacity: 0.92 }}
            onPress={() => router.push(href)}
        >
            <XStack
                width={28}
                height={28}
                borderRadius={14}
                backgroundColor="rgba(255,255,255,0.98)"
                justifyContent="center"
                alignItems="center"
            >
                <MaterialCommunityIcons
                    name={iconName}
                    size={20}
                    color={
                        title === "Favourites"
                            ? theme.accentStrong
                            : title === "Playlists"
                              ? theme.accent
                              : theme.textMuted
                    }
                />
            </XStack>
            <Text
                fontSize={20}
                fontWeight="700"
                lineHeight={24}
                color={theme.inverseText}
            >
                {title}
            </Text>
        </YStack>
    );
}

function SectionTabs() {
    const theme = useAppTheme();

    return (
        <XStack
            alignItems="center"
            paddingHorizontal={16}
            marginTop={18}
            gap={12}
        >
            {musicSections.map((section) => {
                const isActive = section.href === "/";

                return (
                    <XStack
                        key={section.label}
                        height={44}
                        paddingHorizontal={18}
                        borderRadius={17}
                        backgroundColor={isActive ? theme.text : "transparent"}
                        justifyContent="center"
                        alignItems="center"
                        pressStyle={{ opacity: 0.84 }}
                        onPress={() => router.push(section.href)}
                    >
                        <Text
                            fontSize={18}
                            fontWeight="500"
                            color={
                                isActive ? theme.inverseText : theme.textMuted
                            }
                        >
                            {section.label}
                        </Text>
                    </XStack>
                );
            })}
        </XStack>
    );
}

function ActionBar() {
    const theme = useAppTheme();

    return (
        <XStack
            marginTop={26}
            paddingHorizontal={16}
            alignItems="center"
            justifyContent="space-between"
        >
            <XStack alignItems="center" gap={10}>
                <XStack
                    width={48}
                    height={48}
                    borderRadius={24}
                    backgroundColor={theme.text}
                    justifyContent="center"
                    alignItems="center"
                >
                    <MaterialCommunityIcons
                        name="play"
                        size={20}
                        color={theme.inverseText}
                    />
                </XStack>
                <Text fontSize={18} fontWeight="600" color={theme.text}>
                    Shuffle playback
                </Text>
            </XStack>

            <XStack alignItems="center" gap={18}>
                <MaterialCommunityIcons
                    name="swap-vertical"
                    size={28}
                    color={theme.text}
                />
                <MaterialCommunityIcons
                    name="format-list-bulleted"
                    size={28}
                    color={theme.text}
                />
            </XStack>
        </XStack>
    );
}

function TrackRow({
    track,
    onPress,
}: {
    track: MusicTrack;
    onPress?: () => void;
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
                <Text
                    color="rgba(255,255,255,0.18)"
                    fontSize={40}
                    lineHeight={42}
                    fontWeight="800"
                >
                    M
                </Text>
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

            <MaterialCommunityIcons
                name="dots-vertical"
                size={28}
                color={theme.border}
            />
        </XStack>
    );
}

function MiniPlayer({
    track,
    onPress,
}: {
    track?: MusicTrack;
    onPress?: () => void;
}) {
    const theme = useAppTheme();

    return (
        <XStack
            position="absolute"
            left={16}
            right={16}
            bottom={70}
            height={72}
            borderRadius={22}
            backgroundColor={theme.surfaceStrong}
            alignItems="center"
            paddingLeft={58}
            paddingRight={18}
            pressStyle={{ opacity: 0.92 }}
            onPress={onPress}
        >
            {/* Вініл та обкладинка накладені через абсолютне позиціонування */}
            <XStack
                position="absolute"
                left={-2}
                top={-7}
                width={82}
                height={82}
                justifyContent="center"
                alignItems="center"
            >
                <View
                    position="absolute"
                    left={0}
                    top={4}
                    width={56}
                    height={56}
                    borderRadius={28}
                    backgroundColor="#2f2a3e"
                    borderWidth={6}
                    borderColor="#4f465d"
                >
                    <View
                        position="absolute"
                        left={16}
                        top={16}
                        width={12}
                        height={12}
                        borderRadius={6}
                        backgroundColor="#6f6780"
                    />
                </View>
                <XStack
                    position="absolute"
                    left={22}
                    top={21}
                    width={44}
                    height={44}
                    borderRadius={22}
                    backgroundColor={track?.color ?? theme.accent}
                    justifyContent="center"
                    alignItems="center"
                    overflow="hidden"
                >
                    <Text
                        color="rgba(255,255,255,0.18)"
                        fontSize={40}
                        lineHeight={42}
                        fontWeight="800"
                    >
                        M
                    </Text>
                </XStack>
            </XStack>

            <YStack flex={1} paddingLeft={4}>
                <Text
                    fontSize={15}
                    fontWeight="700"
                    lineHeight={18}
                    color={theme.inverseText}
                    marginBottom={6}
                    numberOfLines={1}
                >
                    {track?.title ?? "Loading local music"}
                </Text>
                <Text
                    fontSize={14}
                    lineHeight={17}
                    fontWeight="500"
                    color={theme.inverseText}
                    opacity={0.82}
                    numberOfLines={1}
                >
                    {track?.artist ?? "Scanning your music files"}
                </Text>
            </YStack>

            <XStack alignItems="center" gap={18} paddingLeft={10}>
                <XStack
                    width={34}
                    height={34}
                    borderRadius={17}
                    borderWidth={3}
                    borderColor="rgba(255,255,255,0.65)"
                    justifyContent="center"
                    alignItems="center"
                >
                    <MaterialCommunityIcons
                        name="play"
                        size={16}
                        color={theme.inverseText}
                    />
                </XStack>
                <MaterialCommunityIcons
                    name="skip-next"
                    size={18}
                    color={theme.inverseText}
                />
            </XStack>
        </XStack>
    );
}

export default function MusicHomeScreen() {
    const theme = useAppTheme();
    const { tracks, isLoading, error } = useMusicTracks();

    // Отримуємо поточний трек із глобального стору!
    const activeTrack = usePlayerStore((state) => state.activeTrack);

    const handleTrackPress = (selectedTrack: MusicTrack, index: number) => {
        const store = usePlayerStore.getState();

        // 1. Оновлюємо чергу та активний трек
        store.setQueue(tracks, index);

        // 2. Якщо у твоєму music-player або сторі немає автоплей-логіки,
        // обов'язково викликай функцію запуску плеєра тут! Наприклад:
        // getPlayerInstance().play(); або супутню функцію, яку ти написав.

        router.push(createListenRoute(selectedTrack));
    };

    const displayTrack = activeTrack || tracks[0];

    // Виносимо рендер шапки в окрему функцію, щоб FlatList міг її відрендерити зверху списку
    const renderHeader = () => (
        <YStack gap={18} marginBottom={16}>
            {/* Пошук */}
            <XStack paddingHorizontal={16} alignItems="center" gap={12}>
                <XStack
                    width={28}
                    height={28}
                    justifyContent="center"
                    alignItems="center"
                >
                    <MaterialCommunityIcons
                        name="tune-variant"
                        size={30}
                        color={theme.text}
                    />
                </XStack>
                <MusicSearchBar />
            </XStack>

            {/* Картки фіч */}
            <XStack gap={10} paddingHorizontal={16}>
                {featureCards.map((card) => (
                    <MusicFeatureCard key={card.title} {...card} />
                ))}
            </XStack>

            {/* Таби та Екшн-бар */}
            <YStack>
                <SectionTabs />
                <ActionBar />
            </YStack>
        </YStack>
    );

    // Стан завантаження / помилки / порожнього списку всередині FlatList
    const renderEmptyOrStatus = () => {
        if (isLoading) {
            return (
                <Text
                    fontSize={15}
                    padding={16}
                    textAlign="center"
                    color={theme.textMuted}
                >
                    Loading local music files...
                </Text>
            );
        }
        if (error) {
            return (
                <Text
                    fontSize={15}
                    padding={16}
                    textAlign="center"
                    color={theme.textMuted}
                >
                    {error}
                </Text>
            );
        }
        return (
            <Text
                fontSize={15}
                padding={16}
                textAlign="center"
                color={theme.textMuted}
            >
                No local audio files found.
            </Text>
        );
    };

    return (
        <AppScreen>
            <YStack flex={1} paddingTop={8} position="relative">
                <FlatList
                    data={isLoading || error ? [] : tracks}
                    keyExtractor={(item, index) =>
                        item.sourceUri ?? `${item.title}-${index}`
                    }
                    // Шапка, яка скролиться разом зі списком треків
                    ListHeaderComponent={renderHeader}
                    // Самі рядки треків (рендериться ТІЛЬКИ те, що бачить користувач!)
                    renderItem={({ item, index }) => (
                        <View paddingHorizontal={16}>
                            <TrackRow
                                track={item}
                                onPress={() => handleTrackPress(item, index)}
                            />
                        </View>
                    )}
                    // Що показувати, якщо список порожній або вантажиться
                    ListEmptyComponent={renderEmptyOrStatus}
                    // Стилі контейнера для скролу (наприклад, великий паддінг знизу під MiniPlayer)
                    contentContainerStyle={{
                        paddingBottom: 160,
                    }}
                    showsVerticalScrollIndicator={false}
                    // Оптимізація швидкості для великих списків
                    removeClippedSubviews={true}
                    maxToRenderPerBatch={10}
                    windowSize={5}
                />

                {/* Міні-плеєр зафіксований поверх списку в самому низу */}
                {displayTrack && (
                    <MiniPlayer
                        track={displayTrack}
                        onPress={() =>
                            router.push(createListenRoute(displayTrack))
                        }
                    />
                )}
            </YStack>
        </AppScreen>
    );
}
