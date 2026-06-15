import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { YStack, XStack, Text, View, Spinner } from "tamagui";
import { useState } from "react";
import { AppScreen } from "../app-screen";
import { type MusicTrack, useMusicTracks } from "../../data/music";
import { useAppTheme } from "../../theme/app-theme";
import { FlatList } from "react-native";
import { analyzeTrackAPI } from "../../utils/ai-api";
import { updateTrackMetadataInDb } from "../../data/db";
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
            updateTrackMetadataInDb(track.assetId, {
                title: result.title,
                artist: result.artist,
                albumTitle: result.album,
            });
            log.debug(`Successfully analyzed track: ${result.title}`);
        } catch (error) {
            log.error("Failed to analyze track:", error);
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <XStack alignItems="center" marginBottom={22}>
            <XStack
                width={68}
                height={68}
                borderRadius={6}
                marginRight={14}
                backgroundColor={track.color}
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
        </XStack>
    );
}

export default function AiAnalyzeScreen() {
    const theme = useAppTheme();
    const { tracks, isLoading, error } = useMusicTracks();

    const renderHeader = () => (
        <YStack gap={18} marginBottom={16} paddingHorizontal={16}>
            <XStack alignItems="center" gap={12} marginTop={16}>
                <MaterialCommunityIcons
                    name="arrow-left"
                    size={28}
                    color={theme.text}
                    onPress={() => router.back()}
                />
                <Text fontSize={24} fontWeight="bold" color={theme.text}>
                    AI Track Sync
                </Text>
            </XStack>
            <Text fontSize={15} color={theme.textMuted}>
                Upload your local tracks to the AI server to retrieve accurate
                metadata.
            </Text>
        </YStack>
    );

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
