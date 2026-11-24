import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "../app-screen";
import { AppButton, Field, Section, Sheet } from "../ui/primitives";
import { MINI_PLAYER_SPACE } from "../music/mini-player";
import { useT } from "../../i18n";
import { evaluateSmartPlaylist } from "../../library/smart";
import { importPlaylist } from "../../library/m3u-io";
import { usePlaylistStore } from "../../store/usePlaylistStore";
import { usePlayerStore } from "../../store/usePlayerStore";
import { useAppTheme } from "../../theme/app-theme";

function Tile({
    icon,
    title,
    subtitle,
    color,
    onPress,
}: {
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    title: string;
    subtitle: string;
    color: string;
    onPress: () => void;
}) {
    return (
        <Pressable
            accessibilityRole="button"
            onPress={onPress}
            style={({ pressed }) => [
                styles.tile,
                { backgroundColor: color, opacity: pressed ? 0.85 : 1 },
            ]}
        >
            <MaterialCommunityIcons name={icon} size={24} color="#fff" />
            <Text style={styles.tileTitle}>{title}</Text>
            <Text style={styles.tileSub}>{subtitle}</Text>
        </Pressable>
    );
}

/** Favourites, recently played and playlists (REQ 47–54). */
export default function LibraryScreen() {
    const t = useT();
    const theme = useAppTheme();
    const tracks = usePlayerStore((s) => s.libraryTracks);
    const playlists = usePlaylistStore((s) => s.playlists);
    const [createOpen, setCreateOpen] = useState(false);
    const [name, setName] = useState("");

    const favourites = useMemo(() => tracks.filter((x) => x.isFavourite).length, [tracks]);

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
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: MINI_PLAYER_SPACE }}>
                <Text style={[styles.h1, { color: theme.text }]}>{t("library.title")}</Text>

                <View style={{ flexDirection: "row", gap: 10, marginBottom: 24 }}>
                    <Tile
                        icon="heart"
                        color="#a53a67"
                        title={t("library.favourites")}
                        subtitle={t("common.tracks", { n: favourites })}
                        onPress={() => router.push("/library/favourites")}
                    />
                    <Tile
                        icon="history"
                        color="#5b4db3"
                        title={t("library.recent")}
                        subtitle=""
                        onPress={() => router.push("/library/recent")}
                    />
                </View>

                <Section
                    title={t("library.playlists")}
                    action={
                        <AppButton
                            compact
                            variant="ghost"
                            icon="file-import-outline"
                            label={t("library.importM3U")}
                            onPress={() => void onImport()}
                        />
                    }
                >
                    <View style={{ flexDirection: "row", gap: 8 }}>
                        <AppButton
                            compact
                            icon="playlist-plus"
                            label={t("library.newPlaylist")}
                            onPress={() => setCreateOpen(true)}
                            style={{ flex: 1 }}
                        />
                        <AppButton
                            compact
                            variant="secondary"
                            icon="auto-fix"
                            label={t("library.newSmartPlaylist")}
                            onPress={() => router.push("/playlist/smart")}
                            style={{ flex: 1 }}
                        />
                    </View>

                    {playlists.length === 0 && (
                        <Text style={{ color: theme.textMuted, paddingVertical: 12 }}>
                            {t("library.noPlaylists")}
                        </Text>
                    )}

                    {playlists.map((p) => {
                        const count =
                            p.isSmart && p.rules
                                ? evaluateSmartPlaylist(tracks, p.rules, { limit: p.limitCount })
                                      .length
                                : p.trackIds.length;
                        return (
                            <Pressable
                                key={p.id}
                                accessibilityRole="button"
                                onPress={() =>
                                    router.push({
                                        pathname: "/playlist/[id]",
                                        params: { id: p.id },
                                    })
                                }
                                style={[styles.row, { borderBottomColor: theme.border }]}
                            >
                                <View
                                    style={[
                                        styles.icon,
                                        {
                                            backgroundColor: p.isSmart
                                                ? theme.accentStrong
                                                : theme.accent,
                                        },
                                    ]}
                                >
                                    <MaterialCommunityIcons
                                        name={p.isSmart ? "auto-fix" : "playlist-music"}
                                        size={20}
                                        color="#fff"
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text
                                        style={{
                                            color: theme.text,
                                            fontSize: 16,
                                            fontWeight: "600",
                                        }}
                                        numberOfLines={1}
                                    >
                                        {p.name}
                                    </Text>
                                    <Text style={{ color: theme.textSubtle, fontSize: 12 }}>
                                        {p.isSmart ? `${t("library.smart")} · ` : ""}
                                        {t("common.tracks", { n: count })}
                                    </Text>
                                </View>
                                <MaterialCommunityIcons
                                    name="chevron-right"
                                    size={22}
                                    color={theme.textSubtle}
                                />
                            </Pressable>
                        );
                    })}
                </Section>
            </ScrollView>

            <Sheet
                visible={createOpen}
                onClose={() => setCreateOpen(false)}
                title={t("library.newPlaylist")}
            >
                <View style={{ gap: 12 }}>
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
    h1: { fontSize: 26, fontWeight: "800", marginBottom: 16 },
    tile: {
        flex: 1,
        borderRadius: 18,
        padding: 14,
        gap: 6,
        minHeight: 110,
        justifyContent: "flex-end",
    },
    tileTitle: { color: "#fff", fontWeight: "700", fontSize: 16 },
    tileSub: { color: "rgba(255,255,255,0.85)", fontSize: 12 },
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    icon: {
        width: 42,
        height: 42,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
    },
});
