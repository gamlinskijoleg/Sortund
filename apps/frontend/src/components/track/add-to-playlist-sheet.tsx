import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useT } from "../../i18n";
import { usePlaylistStore } from "../../store/usePlaylistStore";
import { usePlayerStore } from "../../store/usePlayerStore";
import { useAppTheme } from "../../theme/app-theme";
import { Mosaic, Sheet } from "../ui/primitives";

export function AddToPlaylistSheet({
    visible,
    assetIds,
    onClose,
    onAdded,
}: {
    visible: boolean;
    assetIds: string[];
    onClose: () => void;
    onAdded?: (name: string) => void;
}) {
    const t = useT();
    const theme = useAppTheme();
    const allPlaylists = usePlaylistStore((s) => s.playlists);
    const library = usePlayerStore((s) => s.allTracks);
    const playlists = useMemo(() => allPlaylists.filter((p) => !p.isSmart), [allPlaylists]);
    const artwork = useMemo(() => new Map(library.map((x) => [x.assetId, x.artwork])), [library]);
    const [name, setName] = useState("");

    const add = (id: string, playlistName: string) => {
        usePlaylistStore.getState().addTracks(id, assetIds);
        onAdded?.(playlistName);
        onClose();
    };
    const create = () => {
        if (!name.trim()) return;
        const created = usePlaylistStore.getState().create(name, assetIds);
        setName("");
        onAdded?.(created.name);
        onClose();
    };

    return (
        <Sheet visible={visible} onClose={onClose} title={t("playlist.choose")}>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
                <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder={t("library.newPlaylist")}
                    placeholderTextColor={theme.textPlaceholder}
                    accessibilityLabel={t("playlist.name")}
                    onSubmitEditing={create}
                    returnKeyType="done"
                    style={{
                        flex: 1,
                        height: 48,
                        borderRadius: 12,
                        paddingHorizontal: 14,
                        fontSize: 16,
                        backgroundColor: theme.surface,
                        color: theme.text,
                    }}
                />
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("common.create")}
                    disabled={!name.trim()}
                    onPress={create}
                    style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: theme.accent,
                        opacity: name.trim() ? 1 : 0.4,
                    }}
                >
                    <MaterialCommunityIcons name="plus" size={22} color={theme.inverseText} />
                </Pressable>
            </View>
            {playlists.map((p) => (
                <Pressable
                    key={p.id}
                    accessibilityRole="button"
                    onPress={() => add(p.id, p.name)}
                    style={({ pressed }) => ({
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                        paddingVertical: 8,
                        paddingHorizontal: 4,
                        borderRadius: 12,
                        backgroundColor: pressed ? theme.surface : "transparent",
                    })}
                >
                    <Mosaic uris={p.trackIds.slice(0, 4).map((id) => artwork.get(id))} size={48} />
                    <View style={{ flex: 1 }}>
                        <Text
                            style={{ color: theme.text, fontSize: 15, fontWeight: "500" }}
                            numberOfLines={1}
                        >
                            {p.name}
                        </Text>
                        <Text style={{ color: theme.textSubtle, fontSize: 13, marginTop: 2 }}>
                            {t("common.tracks", { n: p.trackIds.length })}
                        </Text>
                    </View>
                </Pressable>
            ))}
        </Sheet>
    );
}
