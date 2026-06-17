import { MaterialCommunityIcons } from "@expo/vector-icons";
import { YStack, XStack, View, Spinner } from "tamagui";
import { useState } from "react";
import { AppScreen } from "../app-screen";
import { type MusicTrack } from "../../data/music";
import { useAppTheme } from "../../theme/app-theme";
import { DeviceEventEmitter } from "react-native";
import { TrackListItem } from "../shared/track-list-item";
import { analyzeTrackAPI, downloadArtworkAsync } from "../../utils/ai-api";
import { updateTrackAfterAnalysisInDb } from "../../data/db";
import { log } from "@/utils/logger";
import { useLocalTrackSearch } from "../../hooks/use-local-track-search";
import { SearchBar } from "../shared/search-bar";
import { SearchList } from "../shared/search-list";

function AiTrackRow({ track }: { track: MusicTrack }) {
    const theme = useAppTheme();
    const [title, setTitle] = useState(track.title);
    const [artist, setArtist] = useState(track.artist);
    const [isAnalyzed, setIsAnalyzed] = useState(track.isAnalyzed);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const handleAnalyze = async () => {
        if (isAnalyzing || !track.assetId) return;
        setIsAnalyzing(true);
        try {
            const result = await analyzeTrackAPI(track.sourceUri);
            setTitle(result.title);
            setArtist(result.artist);
            setIsAnalyzed(true);

            let finalArtwork = result.artwork;
            if (finalArtwork && finalArtwork.startsWith("http")) {
                const localUri = await downloadArtworkAsync(
                    finalArtwork,
                    track.assetId
                );
                if (localUri) {
                    finalArtwork = localUri;
                }
            }

            const updatedData = {
                title: result.title,
                artist: result.artist,
                album: result.album,
                artwork: finalArtwork,
                genre: result.genre,
                date: result.date,
                rating: result.rating,
                analysis_source: result.analysis_source,
                tags: result.tags,
            };
            // Update local SQLite DB
            updateTrackAfterAnalysisInDb(track.assetId, updatedData);
            DeviceEventEmitter.emit("track_updated", {
                assetId: track.assetId,
                ...updatedData,
            });
            log.debug(`Successfully analyzed track: ${result.title}`);
        } catch (error) {
            log.error("Failed to analyze track:", error);
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <TrackListItem
            track={{ ...track, title, artist }}
            trailingActionSlot={
                <XStack
                    pressStyle={{ opacity: isAnalyzed ? 1 : 0.5 }}
                    onPress={isAnalyzed ? undefined : handleAnalyze}
                    padding={8}
                    opacity={isAnalyzed ? 0.5 : 1}
                >
                    {isAnalyzing ? (
                        <Spinner size="small" color={theme.text} />
                    ) : isAnalyzed ? (
                        <MaterialCommunityIcons
                            name="check-circle"
                            size={28}
                            color={theme.text}
                        />
                    ) : (
                        <MaterialCommunityIcons
                            name="cloud-upload"
                            size={28}
                            color={theme.text}
                        />
                    )}
                </XStack>
            }
        />
    );
}

export default function AiAnalyzeScreen() {
    const {
        tracks: filteredTracks,
        isLoading,
        searchQuery,
        setSearchQuery,
        isDebouncing,
        debouncedQuery,
    } = useLocalTrackSearch();

    return (
        <AppScreen>
            <YStack flex={1} paddingTop={8} position="relative">
                <XStack paddingHorizontal={16} paddingBottom={12}>
                    <SearchBar
                        value={searchQuery}
                        placeholder="Search local files..."
                        onChangeText={setSearchQuery}
                    />
                </XStack>
                <SearchList
                    data={filteredTracks}
                    isLoading={isLoading}
                    isDebouncing={isDebouncing}
                    showInitialState={false}
                    searchQuery={debouncedQuery}
                    noResultsMessage="No local audio files found."
                    keyExtractor={(item) => item.sourceUri}
                    renderItem={({ item }) => (
                        <View paddingHorizontal={16}>
                            <AiTrackRow track={item} />
                        </View>
                    )}
                    contentContainerStyle={{
                        paddingBottom: 40,
                    }}
                    // showsVerticalScrollIndicator={false}
                    removeClippedSubviews={true}
                    maxToRenderPerBatch={10}
                    windowSize={5}
                />
            </YStack>
        </AppScreen>
    );
}
