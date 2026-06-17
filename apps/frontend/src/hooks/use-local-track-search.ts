import { useState, useMemo } from "react";
import { useMusicTracks } from "../data/music";
import { useDebouncedValue } from "./use-debounced-value";

interface UseTrackSearchOptions {
    returnEmptyOnBlank?: boolean;
}

export function useLocalTrackSearch({
    returnEmptyOnBlank = false,
}: UseTrackSearchOptions = {}) {
    const { tracks, isLoading, error } = useMusicTracks();
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedQuery, isDebouncing] = useDebouncedValue(searchQuery);

    const filteredTracks = useMemo(() => {
        if (!tracks) return [];
        if (debouncedQuery.trim() === "") {
            return returnEmptyOnBlank ? [] : tracks;
        }
        const lowerQuery = debouncedQuery.toLowerCase();
        return tracks.filter(
            (t) =>
                t.title?.toLowerCase().includes(lowerQuery) ||
                t.artist?.toLowerCase().includes(lowerQuery) ||
                t.album?.toLowerCase().includes(lowerQuery)
        );
    }, [tracks, debouncedQuery, returnEmptyOnBlank]);

    return {
        tracks: filteredTracks,
        isLoading,
        error,
        searchQuery,
        setSearchQuery,
        debouncedQuery,
        isDebouncing,
        isSearching: searchQuery.trim().length > 0,
    };
}
