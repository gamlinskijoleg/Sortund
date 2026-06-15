import { AppScreen } from "../app-screen";
import { useAppTheme } from "../../theme/app-theme";
import { PageHeader } from "../shared/page-header";
import { SearchBar } from "../shared/search-bar";
import { YStack } from "tamagui";
import { StyleSheet } from "react-native";

export default function SearchScreen() {
    const theme = useAppTheme();

    return (
        <AppScreen>
            <YStack flex={1} paddingHorizontal={16} paddingTop={8}>
                <PageHeader title="Search" />
                <SearchBar
                    placeholder="Search songs, albums, and people"
                    onPress={() => {}}
                />
            </YStack>
        </AppScreen>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 24,
        padding: 18,
    },
    cardTitle: {
        fontSize: 18,
        lineHeight: 22,
        fontWeight: "700",
        marginBottom: 14,
    },
    suggestionRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginBottom: 12,
    },
    suggestionText: {
        flex: 1,
        fontSize: 15,
        lineHeight: 20,
    },
});
