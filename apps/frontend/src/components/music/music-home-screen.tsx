import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import { YStack, XStack, Text, View } from "tamagui";
import { AppScreen } from "../app-screen";
import {
    createListenRoute,
    featureCards,
    type MusicTrack,
    useMusicLibrary,
} from "../../data/music";
import { useAppTheme } from "../../theme/app-theme";
import { usePlayerStore } from "@/store/usePlayerStore";
import { FlatList } from "react-native";
import { SearchBar } from "../shared/search-bar";
import { TrackListItem } from "../shared/track-list-item";
import { AsyncListState } from "../shared/async-list-state";
import { MiniPlayer } from "./mini-player";
import { sectionTabRoutes } from "@/config/routes";

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
    const pathname = usePathname();

    return (
        <XStack
            alignItems="center"
            paddingHorizontal={16}
            marginTop={18}
            justifyContent="space-between"
        >
            {sectionTabRoutes.map((section) => {
                const isActive = section.href === pathname;

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
                        onPress={() => isActive || router.push(section.href)}
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

export default function MusicHomeScreen() {
    const theme = useAppTheme();
    // Initialize library in background once
    useMusicLibrary();
    const tracks = usePlayerStore((state) => state.libraryTracks);
    const isLoading = usePlayerStore((state) => state.isLibraryLoading);

    // Getting current track from global store!
    const playerInstance = usePlayerStore((state) => state.playerInstance);
    const activeTrack = usePlayerStore((state) => state.activeTrack);
    const playNext = usePlayerStore((state) => state.playNext);
    const playToggle = usePlayerStore((state) => state.togglePlayPause);

    const handleTrackPress = (selectedTrack: MusicTrack, index: number) => {
        const store = usePlayerStore.getState();

        // 1. Update queue and active track
        store.setQueue(tracks, index);

        // 2. If there is no auto-play logic in your music-player or store,
        // be sure to call the player launch function here! For example:
        // getPlayerInstance().play(); or the accompanying function you wrote.

        router.push(createListenRoute(selectedTrack));
    };

    const displayTrack = activeTrack || tracks[0];

    // Move header render to a separate function so FlatList can render it above the list
    const renderHeader = () => (
        <YStack gap={18} marginBottom={16}>
            {/* Search */}
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
                <View flex={1}>
                    <SearchBar />
                </View>
                {__DEV__ === true && (
                    <XStack
                        width={32}
                        height={32}
                        borderRadius={16}
                        backgroundColor={theme.background || "#f0f0f0"}
                        justifyContent="center"
                        alignItems="center"
                        pressStyle={{ opacity: 0.8 }}
                        onPress={() => router.push("/debug-db")}
                    >
                        <MaterialCommunityIcons
                            name="database"
                            size={20}
                            color={theme.text}
                        />
                    </XStack>
                )}
            </XStack>

            {/* Feature cards */}
            <XStack gap={10} paddingHorizontal={16}>
                {featureCards.map((card) => (
                    <MusicFeatureCard key={card.title} {...card} />
                ))}
            </XStack>

            {/* Tabs and Action bar */}
            <YStack>
                <SectionTabs />
                <ActionBar />
            </YStack>
        </YStack>
    );

    // Loading / error / empty list state inside FlatList
    const renderEmptyOrStatus = () => (
        <AsyncListState
            isLoading={isLoading}
            error={null}
            loadingMessage="Loading local music files..."
            emptyMessage="No local audio files found."
        />
    );

    return (
        <AppScreen>
            <YStack flex={1} paddingTop={8} position="relative">
                <FlatList
                    data={isLoading ? [] : tracks}
                    keyExtractor={(item, index) =>
                        item.sourceUri ?? `${item.title}-${index}`
                    }
                    // Header that scrolls with the list of tracks
                    ListHeaderComponent={renderHeader}
                    // Track rows themselves (ONLY what the user sees is rendered!)
                    renderItem={({ item, index }) => (
                        <View paddingHorizontal={16}>
                            <TrackListItem
                                track={item}
                                onPress={() => handleTrackPress(item, index)}
                            />
                        </View>
                    )}
                    // What to show if the list is empty or loading
                    ListEmptyComponent={renderEmptyOrStatus}
                    // Scroll container styles (e.g., large bottom padding for MiniPlayer)
                    contentContainerStyle={{
                        paddingBottom: 160,
                    }}
                    showsVerticalScrollIndicator={false}
                    // Speed optimization for large lists
                    removeClippedSubviews={true}
                    maxToRenderPerBatch={10}
                    windowSize={5}
                />

                {/* Mini-player fixed above the list at the very bottom */}
                {displayTrack && playerInstance && (
                    <MiniPlayer
                        onPlayPause={playToggle}
                        playNext={playNext}
                        track={displayTrack}
                        activePlayerInstance={playerInstance}
                        onPress={() => {
                            if (!activeTrack && tracks.length > 0) {
                                usePlayerStore.getState().setQueue(tracks, 0);
                            }
                            router.push(createListenRoute(displayTrack));
                        }}
                    />
                )}
            </YStack>
        </AppScreen>
    );
}
