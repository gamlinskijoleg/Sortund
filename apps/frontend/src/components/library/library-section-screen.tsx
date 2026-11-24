import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { FlatList, View } from "react-native";
import { AppScreen } from "../app-screen";
import { PageHeader } from "../shared/page-header";
import { TRACK_ROW_HEIGHT, TrackListItem } from "../shared/track-list-item";
import { AppButton, EmptyState } from "../ui/primitives";
import { MINI_PLAYER_SPACE } from "../music/mini-player";
import { playQueue } from "../music/music-home-screen";
import { getRecentAssetIds } from "../../data/db";
import { useT } from "../../i18n";
import { usePlayerStore } from "../../store/usePlayerStore";

/** "Favourites" and "Recently played" lists (REQ 49). */
export default function LibrarySectionScreen() {
    const t = useT();
    const params = useLocalSearchParams<{ section?: string }>();
    const section = params.section === "recent" ? "recent" : "favourites";
    const library = usePlayerStore((s) => s.libraryTracks);
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
            <FlatList
                data={tracks}
                keyExtractor={(x) => x.assetId}
                ListHeaderComponent={
                    <View style={{ padding: 16, gap: 8 }}>
                        <PageHeader
                            title={t(
                                section === "recent" ? "library.recent" : "library.favourites"
                            )}
                        />
                        {tracks.length > 0 && (
                            <View style={{ flexDirection: "row", gap: 8 }}>
                                <AppButton
                                    compact
                                    icon="play"
                                    label={t("home.playAll")}
                                    onPress={() => playQueue(tracks, 0)}
                                />
                                <AppButton
                                    compact
                                    variant="secondary"
                                    icon="shuffle-variant"
                                    label={t("home.shuffle")}
                                    onPress={() => playQueue(tracks, 0, true)}
                                />
                            </View>
                        )}
                    </View>
                }
                renderItem={({ item, index }) => (
                    <TrackListItem
                        track={item}
                        onPress={() => playQueue(tracks, index)}
                        onLongPress={() =>
                            router.push({
                                pathname: "/track/[assetId]",
                                params: { assetId: item.assetId },
                            })
                        }
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
