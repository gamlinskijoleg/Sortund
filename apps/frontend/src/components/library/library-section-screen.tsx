import { AppScreen } from "../app-screen";
import { librarySectionCopy, type LibrarySectionKey } from "../../data/music";
import { useAppTheme } from "../../theme/app-theme";
import { PageHeader } from "../shared/page-header";
import { YStack, Text } from "tamagui";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";

const libraryIcons: Record<
    LibrarySectionKey,
    keyof typeof MaterialCommunityIcons.glyphMap
> = {
    favourites: "heart",
    playlists: "playlist-music",
    recent: "clock-outline",
};

export default function LibrarySectionScreen() {
    const theme = useAppTheme();

    const params = useLocalSearchParams<{ section?: string | string[] }>();
    const rawSection = Array.isArray(params.section)
        ? params.section[0]
        : params.section;
    const section = (
        rawSection && rawSection in librarySectionCopy
            ? rawSection
            : "favourites"
    ) as LibrarySectionKey;
    const copy = librarySectionCopy[section];

    return (
        <AppScreen>
            <YStack flex={1} paddingHorizontal={16} paddingTop={8}>
                <PageHeader title={copy.title} subtitle={copy.subtitle} />

                <YStack
                    borderRadius={24}
                    padding={18}
                    gap={10}
                    backgroundColor={theme.surfaceStrong}
                >
                    <MaterialCommunityIcons
                        name={libraryIcons[section]}
                        size={30}
                        color={theme.text}
                    />
                    <Text
                        fontSize={18}
                        lineHeight={22}
                        fontWeight="700"
                        color={theme.text}
                    >
                        Saved area view
                    </Text>
                    <Text fontSize={14} lineHeight={20} color={theme.textMuted}>
                        This page is now route-driven, so it can grow into real
                        saved-area management without changing the home layout.
                    </Text>
                </YStack>
            </YStack>
        </AppScreen>
    );
}
