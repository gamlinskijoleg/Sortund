import { AppScreen } from "../app-screen";
import { useAppTheme } from "../../theme/app-theme";
import { SearchBar } from "../shared/search-bar";
import { YStack, Text, XStack } from "tamagui";
import { FlatList, ActivityIndicator } from "react-native";
import React, { useState, useMemo } from "react";
import {
    useMusicTracks,
    createListenRoute,
    MusicTrack,
} from "../../data/music";
import { TrackListItem } from "../shared/track-list-item";
import { router } from "expo-router";
import { usePlayerStore } from "../../store/usePlayerStore";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useDebouncedValue } from "../../hooks/use-debounced-value";

export default function SearchScreen() {
    const theme = useAppTheme();
    const [query, setQuery] = useState("");
    const [debouncedQuery, isDebouncing] = useDebouncedValue(query);

    const { tracks, isLoading } = useMusicTracks();

    const filteredTracks = useMemo(() => {
        if (debouncedQuery.trim() === "") return [];
        const lowerQuery = debouncedQuery.toLowerCase();
        return tracks.filter(
            (track) =>
                track.title.toLowerCase().includes(lowerQuery) ||
                track.artist.toLowerCase().includes(lowerQuery) ||
                track.album?.toLowerCase().includes(lowerQuery)
        );
    }, [debouncedQuery, tracks]);

    const handleTrackPress = (selectedTrack: MusicTrack, index: number) => {
        const store = usePlayerStore.getState();
        store.setQueue(filteredTracks, index);
        router.push(createListenRoute(selectedTrack));
    };

    const showInitialState = query.trim() === "";
    const showNoResults =
        !showInitialState &&
        !isDebouncing &&
        !isLoading &&
        filteredTracks.length === 0;

    return (
        <AppScreen>
            <YStack
                flex={1}
                paddingHorizontal={16}
                paddingTop={8}
                position="relative"
            >
                <XStack alignItems="center" marginBottom={16} gap={12}>
                    <XStack
                        pressStyle={{ opacity: 0.7 }}
                        onPress={() => router.back()}
                    >
                        <MaterialCommunityIcons
                            name="chevron-left"
                            size={30}
                            color={theme.text}
                        />
                    </XStack>
                    <SearchBar
                        value={query}
                        placeholder="Search for songs on device"
                        onChangeText={setQuery}
                    />
                </XStack>

                <FlatList
                    data={
                        showInitialState || isDebouncing ? [] : filteredTracks
                    }
                    keyExtractor={(item) => item.sourceUri}
                    renderItem={({ item, index }) => (
                        <TrackListItem
                            track={item}
                            onPress={() => handleTrackPress(item, index)}
                        />
                    )}
                    contentContainerStyle={{ paddingBottom: 160 }}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        showInitialState ? (
                            <Text
                                color={theme.textSubtle}
                                textAlign="center"
                                marginTop={20}
                            >
                                Введіть назву пісні або артиста
                            </Text>
                        ) : isDebouncing || isLoading ? (
                            <YStack marginTop={20} alignItems="center">
                                <ActivityIndicator
                                    size="large"
                                    color={theme.text}
                                />
                            </YStack>
                        ) : showNoResults ? (
                            <Text
                                color={theme.textSubtle}
                                textAlign="center"
                                marginTop={20}
                            >
                                No results found for {debouncedQuery}
                            </Text>
                        ) : null
                    }
                />
            </YStack>
        </AppScreen>
    );
}
