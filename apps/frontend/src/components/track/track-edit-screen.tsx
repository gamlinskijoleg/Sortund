import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { AppScreen } from "../app-screen";
import { PageHeader } from "../shared/page-header";
import { AppButton, Chip, Field, Section } from "../ui/primitives";
import { saveTrackEdits } from "../../data/library";
import { trackYear } from "../../library/track-utils";
import { usePlayerStore } from "../../store/usePlayerStore";
import { useT, useValueLabel } from "../../i18n";

const MOODS = ["energetic", "happy", "calm", "sad", "romantic", "aggressive", "dark"];
const GENRES = [
    "blues",
    "classical",
    "country",
    "disco",
    "hiphop",
    "jazz",
    "metal",
    "pop",
    "reggae",
    "rock",
];

/** Manual editing of metadata and tags (REQ 39–41). */
export default function TrackEditScreen() {
    const { assetId } = useLocalSearchParams<{ assetId: string }>();
    const t = useT();
    const label = useValueLabel();
    const track = usePlayerStore((s) => s.libraryTracks.find((x) => x.assetId === assetId));

    const [title, setTitle] = useState(track?.title ?? "");
    const [artist, setArtist] = useState(track?.artist ?? "");
    const [album, setAlbum] = useState(track?.album ?? "");
    const [year, setYear] = useState(track ? String(trackYear(track) ?? "") : "");
    const [genre, setGenre] = useState(track?.genre ?? "");
    const [mood, setMood] = useState(track?.mood ?? "");
    const [userTags, setUserTags] = useState<string[]>(track?.userTags ?? []);
    const [removedTags, setRemovedTags] = useState<string[]>(track?.removedTags ?? []);
    const [newTag, setNewTag] = useState("");
    const [saving, setSaving] = useState(false);

    if (!track)
        return (
            <AppScreen>
                <View />
            </AppScreen>
        );

    const aiTags = (track.tagDetails ?? []).map((x) => x.label);
    const isRemoved = (tag: string) =>
        removedTags.some((r) => r.toLowerCase() === tag.toLowerCase());

    const addTag = () => {
        const tag = newTag.trim();
        if (tag && !userTags.some((x) => x.toLowerCase() === tag.toLowerCase()))
            setUserTags([...userTags, tag]);
        setNewTag("");
    };

    const save = async () => {
        const yearNumber = year.trim() ? Number(year) : undefined;
        if (
            yearNumber !== undefined &&
            (!Number.isInteger(yearNumber) || yearNumber < 1000 || yearNumber > 2100)
        ) {
            Alert.alert(t("common.error"), t("edit.invalidYear"));
            return;
        }
        setSaving(true);
        const sent = await saveTrackEdits(track.assetId, {
            title: title || track.title,
            artist: artist || track.artist,
            album,
            year: yearNumber,
            genre,
            mood,
            userTags,
            removedTags,
        });
        setSaving(false);
        if (sent) Alert.alert(t("edit.saved"), t("edit.correctionSent"));
        router.back();
    };

    return (
        <AppScreen>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <ScrollView
                    contentContainerStyle={{ padding: 16, paddingBottom: 60, gap: 14 }}
                    keyboardShouldPersistTaps="handled"
                >
                    <PageHeader title={t("edit.header")} />
                    <Field label={t("edit.title")} value={title} onChangeText={setTitle} />
                    <Field label={t("edit.artist")} value={artist} onChangeText={setArtist} />
                    <Field label={t("edit.album")} value={album} onChangeText={setAlbum} />
                    <Field
                        label={t("edit.year")}
                        value={year}
                        onChangeText={setYear}
                        keyboardType="number-pad"
                        maxLength={4}
                    />

                    <Field
                        label={t("edit.genre")}
                        value={genre}
                        onChangeText={setGenre}
                        autoCapitalize="none"
                    />
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                        {GENRES.map((g) => (
                            <Chip
                                key={g}
                                label={g}
                                selected={genre === g}
                                onPress={() => setGenre(g)}
                            />
                        ))}
                    </View>

                    <Section title={t("edit.mood")}>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                            {MOODS.map((m) => (
                                <Chip
                                    key={m}
                                    label={label(m)}
                                    selected={mood === m}
                                    onPress={() => setMood(mood === m ? "" : m)}
                                />
                            ))}
                        </View>
                    </Section>

                    {aiTags.length > 0 && (
                        <Section title={t("edit.aiTags")}>
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                                {aiTags.map((tag) => (
                                    <Chip
                                        key={tag}
                                        label={
                                            isRemoved(tag) ? `${label(tag)} ↺` : `${label(tag)}  ✕`
                                        }
                                        tone={isRemoved(tag) ? "muted" : "default"}
                                        onPress={() =>
                                            setRemovedTags(
                                                isRemoved(tag)
                                                    ? removedTags.filter(
                                                          (r) =>
                                                              r.toLowerCase() !== tag.toLowerCase()
                                                      )
                                                    : [...removedTags, tag]
                                            )
                                        }
                                    />
                                ))}
                            </View>
                        </Section>
                    )}

                    <Section title={t("edit.userTags")}>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                            {userTags.map((tag) => (
                                <Chip
                                    key={tag}
                                    label={`${tag}  ✕`}
                                    selected
                                    onPress={() => setUserTags(userTags.filter((x) => x !== tag))}
                                />
                            ))}
                        </View>
                        <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
                            <View style={{ flex: 1 }}>
                                <Field
                                    value={newTag}
                                    onChangeText={setNewTag}
                                    placeholder={t("edit.tagPlaceholder")}
                                    onSubmitEditing={addTag}
                                    returnKeyType="done"
                                />
                            </View>
                            <AppButton
                                label={t("common.add")}
                                variant="secondary"
                                onPress={addTag}
                                disabled={!newTag.trim()}
                            />
                        </View>
                    </Section>

                    <AppButton
                        label={t("common.save")}
                        icon="check"
                        loading={saving}
                        onPress={() => void save()}
                    />
                </ScrollView>
            </KeyboardAvoidingView>
        </AppScreen>
    );
}
