import { FlatList, FlatListProps, ActivityIndicator } from "react-native";
import { YStack, Text } from "tamagui";
import { useAppTheme } from "../../theme/app-theme";
import React from "react";

interface SearchListProps<T> extends Omit<FlatListProps<T>, "data"> {
    data: readonly T[];
    isLoading?: boolean;
    isDebouncing?: boolean;
    showInitialState?: boolean;
    initialStateMessage?: string;
    noResultsMessage?: string;
    searchQuery?: string;
}

export function SearchList<T>({
    data,
    isLoading,
    isDebouncing,
    showInitialState,
    initialStateMessage = "Search...",
    noResultsMessage = "No results found",
    searchQuery,
    ...props
}: SearchListProps<T>) {
    const theme = useAppTheme();

    const showNoResults = !showInitialState && !isDebouncing && !isLoading && data.length === 0;

    return (
        <FlatList
            data={showInitialState || isDebouncing ? [] : data}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 160 }}
            ListEmptyComponent={
                showInitialState ? (
                    <Text color={theme.textSubtle} textAlign="center" marginTop={20}>
                        {initialStateMessage}
                    </Text>
                ) : isDebouncing || isLoading ? (
                    <YStack marginTop={20} alignItems="center">
                        <ActivityIndicator size="large" color={theme.text} />
                    </YStack>
                ) : showNoResults ? (
                    <Text color={theme.textSubtle} textAlign="center" marginTop={20}>
                        {searchQuery ? `No results found for ${searchQuery}` : noResultsMessage}
                    </Text>
                ) : null
            }
            {...props}
        />
    );
}
