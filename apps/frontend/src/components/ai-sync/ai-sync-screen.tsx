import { MaterialCommunityIcons } from "@expo/vector-icons";
import { YStack, XStack, View, Spinner } from "tamagui";
import { useState } from "react";
import { AppScreen } from "../app-screen";
import { type MusicTrack } from "../../data/music";
import { useAppTheme } from "../../theme/app-theme";
import { DeviceEventEmitter } from "react-native";
import { TrackListItem } from "../shared/track-list-item";
import { analyzeTrackAPI, downloadArtworkAsync } from "../../utils/ai-api";
import { updateTrackAfterAnalysisInDbAsync } from "../../data/db";
import { log } from "@/utils/logger";
import { useLocalTrackSearch } from "../../hooks/use-local-track-search";
import { SearchBar } from "../shared/search-bar";
import { SearchList } from "../shared/search-list";

const ITEM_HEIGHT = 90; // 68 (image height) + 22 (marginBottom)

const handleAnalyzeTrack = async (
    track: MusicTrack,
    setIsAnalyzing: (v: boolean) => void,
    setTrackData: (data: Partial<MusicTrack>) => void
) => {
    if (!track.assetId) return;
    setIsAnalyzing(true);
    try {
        const result = await analyzeTrackAPI(track.sourceUri);

        let finalArtwork = result.artwork;
        if (finalArtwork && finalArtwork.startsWith("http")) {
            const localUri = await downloadArtworkAsync(finalArtwork, track.assetId);
            if (localUri) {
                finalArtwork = localUri;
            }
        }

        const updatedData: Partial<MusicTrack> = {
            title: result.title,
            artist: result.artist,
            album: result.album || track.album,
            artwork: finalArtwork || track.artwork,
            genre: result.genre || track.genre,
            date: result.date || track.date,
            rating: result.rating || track.rating,
            analysis_source: result.analysis_source,
            tags: result.tags,
            isAnalyzed: true,
        };

        setTrackData(updatedData);

        // Update local SQLite DB
        await updateTrackAfterAnalysisInDbAsync(track.assetId, updatedData);
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

function AiTrackRow({ track }: { track: MusicTrack }) {
    const theme = useAppTheme();
    const [trackData, setTrackData] = useState({
        title: track.title,
        artist: track.artist,
        isAnalyzed: track.isAnalyzed,
        artwork: track.artwork,
    });
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const onAnalyze = () => {
        if (isAnalyzing || !track.assetId) return;
        void handleAnalyzeTrack(track, setIsAnalyzing, (newData) => {
            setTrackData((prev) => ({ ...prev, ...newData }));
        });
    };

    return (
        <TrackListItem
            track={{ ...track, ...trackData }}
            trailingActionSlot={
                <XStack
                    pressStyle={{ opacity: trackData.isAnalyzed ? 1 : 0.5 }}
                    onPress={trackData.isAnalyzed ? undefined : onAnalyze}
                    padding={8}
                    opacity={trackData.isAnalyzed ? 0.5 : 1}
                >
                    {isAnalyzing ? (
                        <Spinner size="small" color={theme.text} />
                    ) : trackData.isAnalyzed ? (
                        <MaterialCommunityIcons name="check-circle" size={28} color={theme.text} />
                    ) : (
                        <MaterialCommunityIcons name="cloud-upload" size={28} color={theme.text} />
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
                    getItemLayout={(_, index) => ({
                        length: ITEM_HEIGHT,
                        offset: ITEM_HEIGHT * index,
                        index,
                    })}
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
