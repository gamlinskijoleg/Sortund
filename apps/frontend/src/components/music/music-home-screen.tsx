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
import { SafeAreaView } from "react-native-safe-area-context";
import { AudioPlayer, useAudioPlayerStatus } from "expo-audio";

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
            borderRadius={20}
            padding={8}
            backgroundColor={color}
            justifyContent="space-between"
            pressStyle={{ opacity: 0.92 }}
            onPress={() => router.push(href)}
        >
            <XStack
                width={28}
                height={28}
                borderRadius={14}
                justifyContent="center"
                alignItems="center"
            >
                <MaterialCommunityIcons
                    name={iconName}
                    size={20}
                    color={theme.inverseText}
                />
            </XStack>
            <Text
                fontSize={16}
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
            justifyContent="space-between"
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
            <XStack alignItems="center" gap={4}>
                <XStack
                    width={30}
                    height={30}
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
                <Text fontSize={16} color={theme.text}>
                    Shuffle playback
                </Text>
            </XStack>

            <XStack alignItems="center" gap={18}>
                <MaterialCommunityIcons
                    name="swap-vertical"
                    size={24}
                    color={theme.text}
                />
                <MaterialCommunityIcons
                    name="format-list-bulleted"
                    size={24}
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
                        onPress={() => onPlayPause(track)}
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
                        onPress={playNext}
                        name="skip-next"
                        size={18}
                        color={theme.inverseText}
                    />
                </XStack>
            </XStack>
            {/* Вініл */}
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

export default function MusicHomeScreen() {
    const theme = useAppTheme();
    const { tracks, isLoading, error } = useMusicTracks();

    // Отримуємо поточний трек із глобального стору!
    const playerInstance = usePlayerStore((state) => state.playerInstance);
    const activeTrack = usePlayerStore((state) => state.activeTrack);
    const playNext = usePlayerStore((state) => state.playNext);
    const playToggle = usePlayerStore((state) => state.togglePlayPause);

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
                {displayTrack && playerInstance && (
                    <MiniPlayer
                        onPlayPause={playToggle}
                        playNext={playNext}
                        track={displayTrack}
                        activePlayerInstance={playerInstance}
                        onPress={() =>
                            router.push(createListenRoute(displayTrack))
                        }
                    />
                )}
            </YStack>
        </AppScreen>
    );
}
