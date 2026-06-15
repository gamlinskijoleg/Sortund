import { MaterialCommunityIcons } from "@expo/vector-icons";
import { YStack, XStack, View, Spinner } from "tamagui";
import { useState } from "react";
import { AppScreen } from "../app-screen";
import { type MusicTrack, useMusicTracks } from "../../data/music";
import { useAppTheme } from "../../theme/app-theme";
import { FlatList } from "react-native";
import { TrackListItem } from "../shared/track-list-item";
import { PageHeader } from "../shared/page-header";
import { AsyncListState } from "../shared/async-list-state";
import { analyzeTrackAPI } from "../../utils/ai-api";
import { updateTrackAfterAnalysisInDb } from "../../data/db";
import { log } from "@/utils/logger";

function AiTrackRow({ track }: { track: MusicTrack }) {
    const theme = useAppTheme();
    const [title, setTitle] = useState(track.title);
    const [artist, setArtist] = useState(track.artist);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const handleAnalyze = async () => {
        if (isAnalyzing || !track.assetId) return;
        setIsAnalyzing(true);
        try {
            const result = await analyzeTrackAPI(track.sourceUri);
            setTitle(result.title);
            setArtist(result.artist);

            // Update local SQLite DB
            updateTrackAfterAnalysisInDb(track.assetId, {
                title: result.title,
                artist: result.artist,
                album: result.album,
                artwork: result.artwork,
                genre: result.genre,
                date: result.date,
                rating: result.rating,
                analysis_source: result.analysis_source,
                tags: result.tags,
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
                    pressStyle={{ opacity: 0.5 }}
                    onPress={handleAnalyze}
                    padding={8}
                >
                    {isAnalyzing ? (
                        <Spinner size="small" color={theme.text} />
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
    const { tracks, isLoading, error } = useMusicTracks();

    const renderHeader = () => (
        <View paddingHorizontal={16}>
            <PageHeader
                title="AI Track Sync"
                subtitle="Upload your local tracks to the AI server to retrieve accurate metadata."
                showBackButton={true}
            />
        </View>
    );

    const renderEmptyOrStatus = () => (
        <AsyncListState
            isLoading={isLoading}
            error={error}
            loadingMessage="Loading local music files..."
            emptyMessage="No local audio files found."
        />
    );

    return (
        <AppScreen>
            <YStack flex={1} paddingTop={8} position="relative">
                <FlatList
                    data={isLoading || error ? [] : tracks}
                    keyExtractor={(item, index) =>
                        item.sourceUri ?? `${item.title}-${index}`
                    }
                    ListHeaderComponent={renderHeader}
                    renderItem={({ item }) => (
                        <View paddingHorizontal={16}>
                            <AiTrackRow track={item} />
                        </View>
                    )}
                    ListEmptyComponent={renderEmptyOrStatus}
                    contentContainerStyle={{
                        paddingBottom: 40,
                    }}
                    showsVerticalScrollIndicator={false}
                    removeClippedSubviews={true}
                    maxToRenderPerBatch={10}
                    windowSize={5}
                />
            </YStack>
        </AppScreen>
    );
}
