import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { AppScreen } from "../app-screen";
import { TrackListItem } from "../shared/track-list-item";
import {
    AppButton,
    EmptyState,
    Field,
    IconButton,
    Mosaic,
    PopoverMenu,
    Sheet,
    TopBar,
    type MenuItem,
} from "../ui/primitives";
import { MINI_PLAYER_SPACE } from "../music/mini-player";
import { openTrack, playQueue } from "../music/music-home-screen";
import { useListeningTime, useT } from "../../i18n";
import { evaluateSmartPlaylist } from "../../library/smart";
import { exportPlaylist } from "../../library/m3u-io";
import type { MusicTrack } from "../../data/types";
import { usePlaylistStore } from "../../store/usePlaylistStore";
import { usePlayerStore } from "../../store/usePlayerStore";
import { useAppTheme } from "../../theme/app-theme";

/** Cover, name, track count / total time and the two play buttons. */
export function CollectionHeader({
    kicker,
    title,
    tracks,
}: {
    kicker: string;
    title: string;
    tracks: MusicTrack[];
}) {
    const t = useT();
    const theme = useAppTheme();
    const formatListeningTime = useListeningTime();
    const totalMs = tracks.reduce((sum, x) => sum + (x.duration || 0), 0);
    return (
        <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
            <View style={styles.hero}>
                <View style={styles.heroCover}>
                    <Mosaic
                        uris={tracks.slice(0, 4).map((x) => x.artwork)}
                        size={132}
                        radius={12}
                    />
                </View>
                <View style={{ flex: 1, paddingBottom: 4 }}>
                    <Text style={[styles.kicker, { color: theme.textSubtle }]}>{kicker}</Text>
                    <Text
                        accessibilityRole="header"
                        style={[styles.title, { color: theme.text }]}
                        numberOfLines={3}
                    >
                        {title}
                    </Text>
                    <View style={styles.stats}>
                        <View style={styles.stat}>
                            <MaterialCommunityIcons
                                name="music-note"
                                size={14}
                                color={theme.textMuted}
                            />
                            <Text style={{ color: theme.textMuted, fontSize: 13 }}>
                                {t("common.tracks", { n: tracks.length })}
                            </Text>
                        </View>
                        {totalMs > 0 && (
                            <View style={styles.stat}>
                                <MaterialCommunityIcons
                                    name="clock-outline"
                                    size={14}
                                    color={theme.textMuted}
                                />
                                <Text style={{ color: theme.textMuted, fontSize: 13 }}>
                                    {formatListeningTime(totalMs)}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
            </View>
            <View style={styles.buttons}>
                <AppButton
                    compact
                    icon="play"
                    label={t("home.playAll")}
                    disabled={!tracks.length}
                    onPress={() => playQueue(tracks, 0)}
                    style={{ flex: 1 }}
                />
                <AppButton
                    compact
                    variant="secondary"
                    icon="shuffle-variant"
                    label={t("home.shuffle")}
                    disabled={!tracks.length}
                    onPress={() => playQueue(tracks, 0, true)}
                    style={{ flex: 1 }}
                />
            </View>
        </View>
    );
}

/** Playlist details: play, reorder, remove tracks, rename, delete, export (REQ 47–48, 50, 53). */
export default function PlaylistScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const t = useT();
    const theme = useAppTheme();
    const playlist = usePlaylistStore((s) => s.playlists.find((p) => p.id === id));
    const library = usePlayerStore((s) => s.libraryTracks);
    const allTracks = usePlayerStore((s) => s.allTracks);
    const [renameOpen, setRenameOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [editing, setEditing] = useState(false);
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
        const byId = new Map(allTracks.map((x) => [x.assetId, x]));
        return playlist.trackIds.map((tid) => byId.get(tid)).filter((x) => !!x);
    }, [playlist, library, allTracks]);

    if (!playlist)
        return (
            <AppScreen>
                <View style={{ paddingHorizontal: 8 }}>
                    <TopBar />
                </View>
                <EmptyState icon="playlist-remove" text={t("playlist.notFound")} />
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

    const menu: MenuItem[] = [
        {
            icon: "pencil-outline",
            label: t("common.rename"),
            onPress: () => {
                setName(playlist.name);
                setRenameOpen(true);
            },
        },
        ...(playlist.isSmart
            ? [
                  {
                      icon: "creation" as const,
                      label: t("playlist.editRules"),
                      onPress: () =>
                          router.push({ pathname: "/playlist/smart", params: { id: playlist.id } }),
                  },
              ]
            : []),
        ...(tracks.length
            ? [
                  {
                      icon: "export-variant" as const,
                      label: t("playlist.export"),
                      onPress: () => void exportPlaylist(playlist, tracks),
                  },
              ]
            : []),
        { icon: "delete-outline", label: t("playlist.delete"), onPress: confirmDelete },
    ];

    return (
        <AppScreen>
            <View style={{ paddingHorizontal: 8 }}>
                <TopBar
                    right={
                        <>
                            {!playlist.isSmart && tracks.length > 0 && (
                                <Pressable
                                    accessibilityRole="button"
                                    onPress={() => setEditing(!editing)}
                                    style={[
                                        styles.editBtn,
                                        { backgroundColor: editing ? theme.accent : "transparent" },
                                    ]}
                                >
                                    <Text
                                        style={{
                                            color: editing ? theme.inverseText : theme.text,
                                            fontWeight: "600",
                                            fontSize: 15,
                                        }}
                                    >
                                        {t(editing ? "common.done" : "playlist.edit")}
                                    </Text>
                                </Pressable>
                            )}
                            <IconButton
                                icon="dots-horizontal"
                                label={t("track.more")}
                                onPress={() => setMenuOpen(true)}
                            />
                        </>
                    }
                />
            </View>
            <FlatList
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
                data={tracks}
                keyExtractor={(x) => x.assetId}
                ListHeaderComponent={
                    <>
                        <CollectionHeader
                            kicker={t(
                                playlist.isSmart ? "library.smartPlaylist" : "library.playlist"
                            )}
                            title={playlist.name}
                            tracks={tracks}
                        />
                        {editing && (
                            <Text
                                style={{
                                    color: theme.textSubtle,
                                    fontSize: 12,
                                    paddingHorizontal: 16,
                                    paddingBottom: 4,
                                }}
                            >
                                {t("playlist.reorderHint")}
                            </Text>
                        )}
                    </>
                }
                renderItem={({ item, index }) => (
                    <TrackListItem
                        track={item}
                        showDuration={!editing}
                        onPress={() => (editing ? undefined : playQueue(tracks, index))}
                        onLongPress={() => openTrack(item.assetId)}
                        leadingSlot={
                            editing ? (
                                <Animated.View entering={FadeIn} exiting={FadeOut}>
                                    <IconButton
                                        icon="minus-circle-outline"
                                        size={22}
                                        label={t("common.remove")}
                                        onPress={() => store.removeTrack(playlist.id, item.assetId)}
                                        style={{ width: 32, marginLeft: -8 }}
                                    />
                                </Animated.View>
                            ) : undefined
                        }
                        trailingActionSlot={
                            editing ? (
                                <Animated.View
                                    entering={FadeIn}
                                    exiting={FadeOut}
                                    style={{ flexDirection: "row" }}
                                >
                                    <IconButton
                                        icon="chevron-up"
                                        size={22}
                                        label={t("playlist.moveUp")}
                                        disabled={index === 0}
                                        color={theme.textMuted}
                                        onPress={() => store.move(playlist.id, index, index - 1)}
                                    />
                                    <IconButton
                                        icon="chevron-down"
                                        size={22}
                                        label={t("playlist.moveDown")}
                                        disabled={index === tracks.length - 1}
                                        color={theme.textMuted}
                                        onPress={() => store.move(playlist.id, index, index + 1)}
                                    />
                                </Animated.View>
                            ) : undefined
                        }
                    />
                )}
                ListEmptyComponent={<EmptyState icon="playlist-music" text={t("playlist.empty")} />}
                contentContainerStyle={{ paddingBottom: MINI_PLAYER_SPACE }}
            />

            <PopoverMenu visible={menuOpen} onClose={() => setMenuOpen(false)} items={menu} />

            <Sheet
                visible={renameOpen}
                onClose={() => setRenameOpen(false)}
                title={t("common.rename")}
            >
                <View style={{ gap: 14 }}>
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

const styles = StyleSheet.create({
    hero: { flexDirection: "row", alignItems: "flex-end", gap: 16 },
    heroCover: {
        elevation: 12,
        shadowColor: "#000",
        shadowOpacity: 0.4,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 10 },
        borderRadius: 12,
    },
    kicker: { fontSize: 12, letterSpacing: 0.6, textTransform: "uppercase" },
    title: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5, marginTop: 4 },
    stats: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 8 },
    stat: { flexDirection: "row", alignItems: "center", gap: 5 },
    buttons: { flexDirection: "row", gap: 8, marginTop: 18 },
    editBtn: { height: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: "center" },
});
