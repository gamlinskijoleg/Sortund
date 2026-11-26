import { useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { FlatList, View } from "react-native";
import { AppScreen } from "../app-screen";
import { TRACK_ROW_HEIGHT, TrackListItem } from "../shared/track-list-item";
import { EmptyState, TopBar } from "../ui/primitives";
import { MINI_PLAYER_SPACE } from "../music/mini-player";
import { openTrack, playQueue } from "../music/music-home-screen";
import { CollectionHeader } from "./playlist-screen";
import { getRecentAssetIds } from "../../data/db";
import { useT } from "../../i18n";
import { usePlayerStore } from "../../store/usePlayerStore";

/** "Favourites" and "Recently played" lists (REQ 49). */
export default function LibrarySectionScreen() {
    const t = useT();
    const params = useLocalSearchParams<{ section?: string }>();
    const section = params.section === "recent" ? "recent" : "favourites";
    // All files: a favourite or recently played copy stays visible even if it is a duplicate.
    const library = usePlayerStore((s) => s.allTracks);
    const [recentIds, setRecentIds] = useState<string[]>([]);

    useFocusEffect(
        useCallback(() => {
            if (section === "recent") setRecentIds(getRecentAssetIds(100));
        }, [section])
    );

    const tracks = useMemo(() => {
        if (section === "favourites") return library.filter((x) => x.isFavourite);
        const byId = new Map(library.map((x) => [x.assetId, x]));
        return recentIds.map((id) => byId.get(id)).filter((x) => !!x);
    }, [section, library, recentIds]);

    return (
        <AppScreen>
            <View style={{ paddingHorizontal: 8 }}>
                <TopBar />
            </View>
            <FlatList
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
                data={tracks}
                keyExtractor={(x) => x.assetId}
                ListHeaderComponent={
                    <CollectionHeader
                        kicker={t("library.title")}
                        title={t(section === "recent" ? "library.recent" : "library.favourites")}
                        tracks={tracks}
                    />
                }
                renderItem={({ item, index }) => (
                    <TrackListItem
                        track={item}
                        onPress={() => playQueue(tracks, index)}
                        onLongPress={() => openTrack(item.assetId)}
                        onMore={() => openTrack(item.assetId)}
                    />
                )}
                getItemLayout={(_, index) => ({
                    length: TRACK_ROW_HEIGHT,
                    offset: TRACK_ROW_HEIGHT * index,
                    index,
                })}
                ListEmptyComponent={
                    <EmptyState
                        icon={section === "recent" ? "history" : "heart-outline"}
                        text={t(
                            section === "recent" ? "library.recentEmpty" : "library.favouritesEmpty"
                        )}
                    />
                }
                contentContainerStyle={{ paddingBottom: MINI_PLAYER_SPACE }}
            />
        </AppScreen>
    );
}
