import { AppScreen } from "../app-screen";
import { useAppTheme } from "../../theme/app-theme";
import { SearchBar } from "../shared/search-bar";
import { YStack, XStack } from "tamagui";
import React from "react";
import { createListenRoute, MusicTrack } from "../../data/music";
import { TrackListItem } from "../shared/track-list-item";
import { router } from "expo-router";
import { usePlayerStore } from "../../store/usePlayerStore";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SearchList } from "../shared/search-list";
import { useLocalTrackSearch } from "../../hooks/use-local-track-search";

export default function SearchScreen() {
    const theme = useAppTheme();

    const {
        tracks: filteredTracks,
        isLoading,
        searchQuery,
        setSearchQuery,
        debouncedQuery,
        isDebouncing,
    } = useLocalTrackSearch({ returnEmptyOnBlank: true });

    const handleTrackPress = (selectedTrack: MusicTrack, index: number) => {
        const store = usePlayerStore.getState();
        store.setQueue(filteredTracks, index);
        router.push(createListenRoute(selectedTrack));
    };

    const showInitialState = searchQuery.trim() === "";

    return (
        <AppScreen>
            <YStack flex={1} paddingHorizontal={16} paddingTop={8} position="relative">
                <XStack alignItems="center" marginBottom={16} gap={12}>
                    <XStack pressStyle={{ opacity: 0.7 }} onPress={router.back}>
                        <MaterialCommunityIcons name="chevron-left" size={30} color={theme.text} />
                    </XStack>
                    <SearchBar
                        value={searchQuery}
                        placeholder="Search for songs on device"
                        onChangeText={setSearchQuery}
                    />
                </XStack>

                <SearchList
                    data={filteredTracks}
                    isLoading={isLoading}
                    isDebouncing={isDebouncing}
                    showInitialState={showInitialState}
                    searchQuery={debouncedQuery}
                    initialStateMessage="Enter song or artist name"
                    keyExtractor={(item) => item.sourceUri}
                    renderItem={({ item, index }) => (
                        <TrackListItem track={item} onPress={() => handleTrackPress(item, index)} />
                    )}
                />
            </YStack>
        </AppScreen>
    );
}
