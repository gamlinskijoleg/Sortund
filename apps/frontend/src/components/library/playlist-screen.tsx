import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import { Alert, FlatList, View } from "react-native";
import { AppScreen } from "../app-screen";
import { PageHeader } from "../shared/page-header";
import { TrackListItem } from "../shared/track-list-item";
import { AppButton, EmptyState, Field, IconButton, Sheet } from "../ui/primitives";
import { MINI_PLAYER_SPACE } from "../music/mini-player";
import { playQueue } from "../music/music-home-screen";
import { useT } from "../../i18n";
import { evaluateSmartPlaylist } from "../../library/smart";
import { exportPlaylist } from "../../library/m3u-io";
import { usePlaylistStore } from "../../store/usePlaylistStore";
import { usePlayerStore } from "../../store/usePlayerStore";
import { useAppTheme } from "../../theme/app-theme";

/** Playlist details: play, reorder, remove tracks, rename, delete, export (REQ 47–48, 50, 53). */
export default function PlaylistScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const t = useT();
    const theme = useAppTheme();
    const playlist = usePlaylistStore((s) => s.playlists.find((p) => p.id === id));
    const library = usePlayerStore((s) => s.libraryTracks);
    const [renameOpen, setRenameOpen] = useState(false);
    const [name, setName] = useState(playlist?.name ?? "");

    const tracks = useMemo(() => {
        if (!playlist) return [];
        if (playlist.isSmart && playlist.rules) {
            // Smart playlists are evaluated live, so they follow library changes automatically.
            return evaluateSmartPlaylist(library, playlist.rules, {
                sortBy: playlist.sortBy,
                sortDir: playlist.sortDir,
                limit: playlist.limitCount,
            });
        }
        const byId = new Map(library.map((x) => [x.assetId, x]));
        return playlist.trackIds.map((tid) => byId.get(tid)).filter((x) => !!x);
    }, [playlist, library]);

    if (!playlist)
        return (
            <AppScreen>
                <EmptyState icon="playlist-remove" text={t("playlist.empty")} />
            </AppScreen>
        );

    const store = usePlaylistStore.getState();
    const confirmDelete = () =>
        Alert.alert(t("common.delete"), t("playlist.deleteConfirm", { name: playlist.name }), [
            { text: t("common.cancel"), style: "cancel" },
            {
                text: t("common.delete"),
                style: "destructive",
                onPress: () => {
                    store.remove(playlist.id);
                    router.back();
                },
            },
        ]);

    return (
        <AppScreen>
            <FlatList
                data={tracks}
                keyExtractor={(x) => x.assetId}
                ListHeaderComponent={
                    <View style={{ padding: 16, gap: 10 }}>
                        <PageHeader
                            title={playlist.name}
                            subtitle={t("common.tracks", { n: tracks.length })}
                        />
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                            <AppButton
                                compact
                                icon="play"
                                label={t("home.playAll")}
                                disabled={!tracks.length}
                                onPress={() => playQueue(tracks, 0)}
                            />
                            <AppButton
                                compact
                                variant="secondary"
                                icon="shuffle-variant"
                                label={t("home.shuffle")}
                                disabled={!tracks.length}
                                onPress={() => playQueue(tracks, 0, true)}
                            />
                            {playlist.isSmart && (
                                <AppButton
                                    compact
                                    variant="secondary"
                                    icon="auto-fix"
                                    label={t("playlist.editRules")}
                                    onPress={() =>
                                        router.push({
                                            pathname: "/playlist/smart",
                                            params: { id: playlist.id },
                                        })
                                    }
                                />
                            )}
                            <AppButton
                                compact
                                variant="secondary"
                                icon="pencil"
                                label={t("common.rename")}
                                onPress={() => {
                                    setName(playlist.name);
                                    setRenameOpen(true);
                                }}
                            />
                            <AppButton
                                compact
                                variant="secondary"
                                icon="export-variant"
                                label={t("playlist.export")}
                                disabled={!tracks.length}
                                onPress={() => void exportPlaylist(playlist, tracks)}
                            />
                            <AppButton
                                compact
                                variant="danger"
                                icon="delete-outline"
                                label={t("common.delete")}
                                onPress={confirmDelete}
                            />
                        </View>
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
                        trailingActionSlot={
                            playlist.isSmart ? undefined : (
                                <View style={{ flexDirection: "row" }}>
                                    <IconButton
                                        icon="arrow-up"
                                        size={20}
                                        label="Up"
                                        color={theme.textMuted}
                                        onPress={() => store.move(playlist.id, index, index - 1)}
                                    />
                                    <IconButton
                                        icon="arrow-down"
                                        size={20}
                                        label="Down"
                                        color={theme.textMuted}
                                        onPress={() => store.move(playlist.id, index, index + 1)}
                                    />
                                    <IconButton
                                        icon="close"
                                        size={20}
                                        label={t("common.remove")}
                                        color={theme.textMuted}
                                        onPress={() => store.removeTrack(playlist.id, item.assetId)}
                                    />
                                </View>
                            )
                        }
                    />
                )}
                ListEmptyComponent={<EmptyState icon="playlist-music" text={t("playlist.empty")} />}
                contentContainerStyle={{ paddingBottom: MINI_PLAYER_SPACE }}
            />

            <Sheet
                visible={renameOpen}
                onClose={() => setRenameOpen(false)}
                title={t("common.rename")}
            >
                <View style={{ gap: 12 }}>
                    <Field
                        label={t("playlist.name")}
                        value={name}
                        onChangeText={setName}
                        autoFocus
                    />
                    <AppButton
                        label={t("common.save")}
                        disabled={!name.trim()}
                        onPress={() => {
                            store.update(playlist.id, { name: name.trim() });
                            setRenameOpen(false);
                        }}
                    />
                </View>
            </Sheet>
        </AppScreen>
    );
}
