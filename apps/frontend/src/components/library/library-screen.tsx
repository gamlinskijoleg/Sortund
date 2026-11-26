import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "../app-screen";
import {
    AppButton,
    EmptyState,
    Field,
    IconButton,
    Mosaic,
    PopoverMenu,
    ProfileButton,
    ScreenTitle,
    Sheet,
    type IconName,
} from "../ui/primitives";
import { MINI_PLAYER_SPACE } from "../music/mini-player";
import { useT } from "../../i18n";
import { evaluateSmartPlaylist } from "../../library/smart";
import { importPlaylist } from "../../library/m3u-io";
import { useAuthStore } from "../../store/useAuthStore";
import { usePlaylistStore } from "../../store/usePlaylistStore";
import { usePlayerStore } from "../../store/usePlayerStore";
import { useAppTheme } from "../../theme/app-theme";

function Tile({
    icon,
    title,
    subtitle,
    inverted,
    onPress,
}: {
    icon: IconName;
    title: string;
    subtitle: string;
    inverted?: boolean;
    onPress: () => void;
}) {
    const theme = useAppTheme();
    const fg = inverted ? theme.inverseText : theme.text;
    return (
        <Pressable
            accessibilityRole="button"
            onPress={onPress}
            style={({ pressed }) => [
                styles.tile,
                {
                    backgroundColor: inverted ? theme.accent : theme.surface,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                },
            ]}
        >
            <MaterialCommunityIcons name={icon} size={26} color={fg} />
            <View>
                <Text style={[styles.tileTitle, { color: fg }]}>{title}</Text>
                <Text
                    style={{
                        color: inverted ? theme.inverseTextMuted : theme.textMuted,
                        fontSize: 13,
                    }}
                >
                    {subtitle}
                </Text>
            </View>
        </Pressable>
    );
}

/** Favourites, recently played and playlists (REQ 47–54). */
export default function LibraryScreen() {
    const t = useT();
    const theme = useAppTheme();
    const tracks = usePlayerStore((s) => s.libraryTracks);
    const allTracks = usePlayerStore((s) => s.allTracks);
    const playlists = usePlaylistStore((s) => s.playlists);
    const email = useAuthStore((s) => s.user?.email);
    const duplicateGroups = usePlayerStore((s) => s.duplicateGroups.length);
    const [menuOpen, setMenuOpen] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [name, setName] = useState("");

    const favourites = useMemo(() => tracks.filter((x) => x.isFavourite).length, [tracks]);
    const byId = useMemo(() => new Map(allTracks.map((x) => [x.assetId, x])), [allTracks]);

    const onImport = async () => {
        try {
            const result = await importPlaylist(tracks);
            if (!result) return;
            Alert.alert(
                result.playlist.name,
                t("playlist.imported", { n: result.matched, m: result.missing })
            );
        } catch {
            Alert.alert(t("common.error"), t("playlist.importFailed"));
        }
    };

    return (
        <AppScreen edges={["top"]}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: MINI_PLAYER_SPACE }}
            >
                <ScreenTitle
                    title={t("library.title")}
                    right={
                        <>
                            <IconButton
                                icon="plus"
                                size={26}
                                label={t("library.create")}
                                onPress={() => setMenuOpen(true)}
                            />
                            <ProfileButton email={email} />
                        </>
                    }
                />

                <View style={styles.tiles}>
                    <Tile
                        icon="heart"
                        inverted
                        title={t("library.favourites")}
                        subtitle={t("common.tracks", { n: favourites })}
                        onPress={() => router.push("/library/favourites")}
                    />
                    <Tile
                        icon="history"
                        title={t("library.recent")}
                        subtitle={t("library.recentSub")}
                        onPress={() => router.push("/library/recent")}
                    />
                </View>

                {duplicateGroups > 0 && (
                    <Pressable
                        accessibilityRole="button"
                        onPress={() => router.push("/library/duplicates")}
                        style={({ pressed }) => [
                            styles.dupRow,
                            { backgroundColor: pressed ? theme.surfaceStrong : theme.surface },
                        ]}
                    >
                        <MaterialCommunityIcons
                            name="content-duplicate"
                            size={22}
                            color={theme.text}
                        />
                        <View style={{ flex: 1 }}>
                            <Text style={{ color: theme.text, fontSize: 15, fontWeight: "600" }}>
                                {t("duplicates.title")}
                            </Text>
                            <Text style={{ color: theme.textSubtle, fontSize: 13, marginTop: 2 }}>
                                {t("duplicates.groups", { n: duplicateGroups })}
                            </Text>
                        </View>
                        <MaterialCommunityIcons
                            name="chevron-right"
                            size={20}
                            color={theme.textSubtle}
                        />
                    </Pressable>
                )}

                <Text style={[styles.h2, { color: theme.text }]}>{t("library.playlists")}</Text>

                {playlists.length === 0 && (
                    <EmptyState
                        icon="playlist-music"
                        text={t("library.noPlaylists")}
                        action={
                            <AppButton
                                compact
                                icon="plus"
                                label={t("library.newPlaylist")}
                                onPress={() => setCreateOpen(true)}
                            />
                        }
                    />
                )}

                {playlists.map((p) => {
                    const items =
                        p.isSmart && p.rules
                            ? evaluateSmartPlaylist(tracks, p.rules, { limit: p.limitCount })
                            : p.trackIds.map((id) => byId.get(id)).filter((x) => !!x);
                    return (
                        <Pressable
                            key={p.id}
                            accessibilityRole="button"
                            onPress={() =>
                                router.push({ pathname: "/playlist/[id]", params: { id: p.id } })
                            }
                            style={({ pressed }) => [
                                styles.row,
                                pressed && { backgroundColor: theme.surface },
                            ]}
                        >
                            <Mosaic uris={items.slice(0, 4).map((x) => x.artwork)} size={52} />
                            <View style={{ flex: 1 }}>
                                <Text
                                    style={{ color: theme.text, fontSize: 15, fontWeight: "500" }}
                                    numberOfLines={1}
                                >
                                    {p.name}
                                </Text>
                                <View style={styles.sub}>
                                    {p.isSmart && (
                                        <MaterialCommunityIcons
                                            name="creation"
                                            size={13}
                                            color={theme.textSubtle}
                                            accessibilityLabel={t("library.smart")}
                                        />
                                    )}
                                    <Text style={{ color: theme.textSubtle, fontSize: 13 }}>
                                        {t("common.tracks", { n: items.length })}
                                    </Text>
                                </View>
                            </View>
                            <MaterialCommunityIcons
                                name="chevron-right"
                                size={20}
                                color={theme.textSubtle}
                            />
                        </Pressable>
                    );
                })}
            </ScrollView>

            <PopoverMenu
                visible={menuOpen}
                onClose={() => setMenuOpen(false)}
                items={[
                    {
                        icon: "playlist-plus",
                        label: t("library.newPlaylist"),
                        onPress: () => setCreateOpen(true),
                    },
                    {
                        icon: "creation",
                        label: t("library.newSmartPlaylist"),
                        onPress: () => router.push("/playlist/smart"),
                    },
                    {
                        icon: "file-import-outline",
                        label: t("library.importM3U"),
                        onPress: () => void onImport(),
                    },
                ]}
            />

            <Sheet
                visible={createOpen}
                onClose={() => setCreateOpen(false)}
                title={t("library.newPlaylist")}
            >
                <View style={{ gap: 14 }}>
                    <Field
                        label={t("playlist.name")}
                        value={name}
                        onChangeText={setName}
                        autoFocus
                    />
                    <AppButton
                        label={t("common.create")}
                        disabled={!name.trim()}
                        onPress={() => {
                            const p = usePlaylistStore.getState().create(name);
                            setName("");
                            setCreateOpen(false);
                            router.push({ pathname: "/playlist/[id]", params: { id: p.id } });
                        }}
                    />
                </View>
            </Sheet>
        </AppScreen>
    );
}

const styles = StyleSheet.create({
    tiles: { flexDirection: "row", gap: 10, marginTop: 14 },
    dupRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        marginTop: 10,
        minHeight: 60,
        paddingHorizontal: 14,
        borderRadius: 16,
    },
    tile: { flex: 1, height: 116, borderRadius: 16, padding: 14, justifyContent: "space-between" },
    tileTitle: { fontWeight: "700", fontSize: 16 },
    h2: { fontSize: 20, fontWeight: "700", marginTop: 28, marginBottom: 6 },
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 8,
        paddingHorizontal: 8,
        marginHorizontal: -8,
        borderRadius: 12,
    },
    sub: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 },
});
