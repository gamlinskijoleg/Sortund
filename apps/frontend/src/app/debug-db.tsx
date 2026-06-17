import { useEffect, useState } from "react";
import { FlatList } from "react-native";
import { YStack, XStack, Text } from "tamagui";
import { AppScreen } from "../components/app-screen";
import { getCachedTracks } from "../data/db";
import { useAppTheme } from "../theme/app-theme";
import { MusicTrack } from "@/data/music";

export default function DebugDbScreen() {
    const theme = useAppTheme();
    const [tracks, setTracks] = useState<MusicTrack[]>([]);

    useEffect(() => {
        const loadData = () => {
            try {
                const data = getCachedTracks();
                setTracks(data);
            } catch (error) {
                console.error("Error loading DB data:", error);
            }
        };
        loadData();
    }, []);

    if (__DEV__ !== true) {
        return (
            <AppScreen>
                <YStack flex={1} justifyContent="center" alignItems="center">
                    <Text color={theme.text}>Not authorized</Text>
                </YStack>
            </AppScreen>
        );
    }

    return (
        <AppScreen>
            <YStack flex={1} padding={16} paddingTop={32}>
                <XStack
                    justifyContent="space-between"
                    alignItems="center"
                    marginBottom={16}
                >
                    <Text fontSize={24} fontWeight="bold" color={theme.text}>
                        DB Debug (Tracks)
                    </Text>
                </XStack>

                <Text color={theme.textMuted} marginBottom={16}>
                    Total records: {tracks.length}
                </Text>

                <FlatList
                    data={tracks}
                    keyExtractor={(item, index) =>
                        item.assetId || String(index)
                    }
                    renderItem={({ item }) => (
                        <YStack
                            padding={12}
                            backgroundColor={theme.background || "#f0f0f0"}
                            borderRadius={8}
                            marginBottom={8}
                            borderWidth={1}
                            borderColor={theme.border || "#e0e0e0"}
                        >
                            <Text
                                color={theme.text}
                                fontSize={14}
                                fontFamily="$mono"
                            >
                                {JSON.stringify(item, null, 2)}
                            </Text>
                        </YStack>
                    )}
                />
            </YStack>
        </AppScreen>
    );
}
