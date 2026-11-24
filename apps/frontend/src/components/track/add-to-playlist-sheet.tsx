import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useT } from "../../i18n";
import { usePlaylistStore } from "../../store/usePlaylistStore";
import { useAppTheme } from "../../theme/app-theme";
import { AppButton, Field, Sheet } from "../ui/primitives";

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
    const playlists = usePlaylistStore((s) => s.playlists.filter((p) => !p.isSmart));
    const [name, setName] = useState("");

    const add = (id: string, playlistName: string) => {
        usePlaylistStore.getState().addTracks(id, assetIds);
        onAdded?.(playlistName);
        onClose();
    };

    return (
        <Sheet visible={visible} onClose={onClose} title={t("playlist.choose")}>
            {playlists.map((p) => (
                <Pressable
                    key={p.id}
                    accessibilityRole="button"
                    onPress={() => add(p.id, p.name)}
                    style={{
                        paddingVertical: 14,
                        borderBottomWidth: 1,
                        borderBottomColor: theme.border,
                    }}
                >
                    <Text style={{ color: theme.text, fontSize: 16 }}>{p.name}</Text>
                    <Text style={{ color: theme.textSubtle, fontSize: 12 }}>
                        {t("common.tracks", { n: p.trackIds.length })}
                    </Text>
                </Pressable>
            ))}
            <View style={{ gap: 10, marginTop: 16 }}>
                <Field
                    label={t("library.newPlaylist")}
                    value={name}
                    onChangeText={setName}
                    placeholder={t("playlist.name")}
                />
                <AppButton
                    label={t("common.create")}
                    icon="playlist-plus"
                    disabled={!name.trim()}
                    onPress={() => {
                        const created = usePlaylistStore.getState().create(name, assetIds);
                        setName("");
                        onAdded?.(created.name);
                        onClose();
                    }}
                />
            </View>
        </Sheet>
    );
}
