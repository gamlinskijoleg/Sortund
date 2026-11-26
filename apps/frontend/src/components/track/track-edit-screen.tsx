import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { AppScreen } from "../app-screen";
import { AppButton, Chip, Field, ListRow, Section, Sheet, Toggle } from "../ui/primitives";
import { saveTrackEdits } from "../../data/library";
import { writeTagsToFile } from "../../library/tag-writer";
import { trackYear } from "../../library/track-utils";
import { usePlayerStore } from "../../store/usePlayerStore";
import { useT, useValueLabel } from "../../i18n";
import { useAppTheme } from "../../theme/app-theme";

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

function Select({
    label,
    value,
    placeholder,
    onPress,
}: {
    label: string;
    value: string;
    placeholder: string;
    onPress: () => void;
}) {
    const theme = useAppTheme();
    return (
        <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ color: theme.textSubtle, fontSize: 13 }}>{label}</Text>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${label}: ${value || placeholder}`}
                onPress={onPress}
                style={({ pressed }) => [
                    styles.select,
                    {
                        backgroundColor: pressed ? theme.surfaceStrong : theme.surface,
                        borderColor: theme.border,
                    },
                ]}
            >
                <Text
                    style={{
                        color: value ? theme.text : theme.textPlaceholder,
                        fontSize: 16,
                        flex: 1,
                    }}
                    numberOfLines={1}
                >
                    {value || placeholder}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={20} color={theme.textSubtle} />
            </Pressable>
        </View>
    );
}

function OptionSheet({
    visible,
    title,
    options,
    value,
    onPick,
    onClose,
    allowCustom,
}: {
    visible: boolean;
    title: string;
    options: { value: string; label: string }[];
    value: string;
    onPick: (v: string) => void;
    onClose: () => void;
    allowCustom?: boolean;
}) {
    const t = useT();
    const theme = useAppTheme();
    const [custom, setCustom] = useState("");
    const pick = (v: string) => {
        onPick(v);
        onClose();
    };
    return (
        <Sheet visible={visible} onClose={onClose} title={title}>
            <View style={{ borderRadius: 16, overflow: "hidden", backgroundColor: theme.surface }}>
                <ListRow
                    first
                    title={t("edit.notSet")}
                    onPress={() => pick("")}
                    right={
                        !value ? (
                            <MaterialCommunityIcons name="check" size={20} color={theme.text} />
                        ) : undefined
                    }
                />
                {options.map((o) => (
                    <ListRow
                        key={o.value}
                        title={o.label}
                        onPress={() => pick(o.value)}
                        right={
                            value === o.value ? (
                                <MaterialCommunityIcons name="check" size={20} color={theme.text} />
                            ) : undefined
                        }
                    />
                ))}
            </View>
            {allowCustom && (
                <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
                    <View style={{ flex: 1 }}>
                        <Field
                            value={custom}
                            onChangeText={setCustom}
                            placeholder={t("edit.customValue")}
                            autoCapitalize="none"
                            onSubmitEditing={() => custom.trim() && pick(custom.trim())}
                        />
                    </View>
                    <AppButton
                        label={t("common.done")}
                        variant="secondary"
                        disabled={!custom.trim()}
                        onPress={() => pick(custom.trim())}
                    />
                </View>
            )}
        </Sheet>
    );
}

/** Manual editing of metadata and tags (REQ 39–42). */
export default function TrackEditScreen() {
    const { assetId } = useLocalSearchParams<{ assetId: string }>();
    const t = useT();
    const label = useValueLabel();
    const theme = useAppTheme();
    const track = usePlayerStore((s) => s.allTracks.find((x) => x.assetId === assetId));

    const [title, setTitle] = useState(track?.title ?? "");
    const [artist, setArtist] = useState(track?.artist ?? "");
    const [album, setAlbum] = useState(track?.album ?? "");
    const [year, setYear] = useState(track ? String(trackYear(track) ?? "") : "");
    const [genre, setGenre] = useState(track?.genre ?? "");
    const [mood, setMood] = useState(track?.mood ?? "");
    const [userTags, setUserTags] = useState<string[]>(track?.userTags ?? []);
    const [removedTags, setRemovedTags] = useState<string[]>(track?.removedTags ?? []);
    const [showRemoved, setShowRemoved] = useState(false);
    const [newTag, setNewTag] = useState("");
    const [writeFile, setWriteFile] = useState(false);
    const [saving, setSaving] = useState(false);
    const [picker, setPicker] = useState<"genre" | "mood" | null>(null);

    if (!track)
        return (
            <AppScreen>
                <View />
            </AppScreen>
        );

    const aiTags = [...new Set((track.tagDetails ?? []).map((x) => x.label))];
    const isRemoved = (tag: string) =>
        removedTags.some((r) => r.toLowerCase() === tag.toLowerCase());
    const activeAi = aiTags.filter((x) => !isRemoved(x));
    const removedAi = aiTags.filter(isRemoved);

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
        await saveTrackEdits(track.assetId, {
            title: title || track.title,
            artist: artist || track.artist,
            album,
            year: yearNumber,
            genre,
            mood,
            userTags,
            removedTags,
        });
        if (writeFile) {
            const updated =
                usePlayerStore.getState().allTracks.find((x) => x.assetId === track.assetId) ??
                track;
            try {
                const outcome = await writeTagsToFile(updated);
                if (outcome.kind === "copy")
                    Alert.alert(t("common.done"), t("track.writeTagsCopy"));
                else if (outcome.kind !== "written")
                    Alert.alert(t("common.error"), t("track.writeTagsMp3Only"));
            } catch (error) {
                Alert.alert(
                    t("common.error"),
                    t("track.writeTagsFailed", { error: String(error) })
                );
            }
        }
        setSaving(false);
        router.back();
    };

    const genreOptions = [
        ...new Set([...GENRES, ...(genre && !GENRES.includes(genre) ? [genre] : [])]),
    ].map((g) => ({ value: g, label: label(g) }));

    return (
        <AppScreen>
            <View style={styles.bar}>
                <Pressable
                    accessibilityRole="button"
                    onPress={() => router.back()}
                    hitSlop={8}
                    style={styles.barBtn}
                >
                    <Text style={{ color: theme.textMuted, fontSize: 16 }}>
                        {t("common.cancel")}
                    </Text>
                </Pressable>
                <Text
                    accessibilityRole="header"
                    style={{ color: theme.text, fontSize: 17, fontWeight: "600" }}
                >
                    {t("edit.header")}
                </Text>
                <Pressable
                    accessibilityRole="button"
                    onPress={() => void save()}
                    disabled={saving}
                    hitSlop={8}
                    style={styles.barBtn}
                >
                    {saving ? (
                        <ActivityIndicator color={theme.text} />
                    ) : (
                        <Text style={{ color: theme.text, fontSize: 16, fontWeight: "700" }}>
                            {t("common.done")}
                        </Text>
                    )}
                </Pressable>
            </View>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ padding: 16, paddingBottom: 200, gap: 14 }}
                    keyboardShouldPersistTaps="handled"
                >
                    <Field label={t("edit.title")} value={title} onChangeText={setTitle} />
                    <Field label={t("edit.artist")} value={artist} onChangeText={setArtist} />
                    <View style={styles.row}>
                        <View style={{ flex: 1 }}>
                            <Field label={t("edit.album")} value={album} onChangeText={setAlbum} />
                        </View>
                        <View style={{ width: 110 }}>
                            <Field
                                label={t("edit.year")}
                                value={year}
                                onChangeText={setYear}
                                keyboardType="number-pad"
                                maxLength={4}
                            />
                        </View>
                    </View>
                    <View style={styles.row}>
                        <Select
                            label={t("edit.genre")}
                            value={genre ? label(genre) : ""}
                            placeholder={t("edit.notSet")}
                            onPress={() => setPicker("genre")}
                        />
                        <Select
                            label={t("edit.mood")}
                            value={mood ? label(mood) : ""}
                            placeholder={t("edit.notSet")}
                            onPress={() => setPicker("mood")}
                        />
                    </View>

                    <Section title={t("track.tags")} style={{ marginTop: 14, marginBottom: 0 }}>
                        <View style={styles.wrap}>
                            {userTags.map((tag) => (
                                <Chip
                                    key={`u${tag}`}
                                    label={tag}
                                    selected
                                    onRemove={() => setUserTags(userTags.filter((x) => x !== tag))}
                                />
                            ))}
                            {activeAi.map((tag) => (
                                <Chip
                                    key={`a${tag}`}
                                    label={label(tag)}
                                    onRemove={() => setRemovedTags([...removedTags, tag])}
                                />
                            ))}
                            {showRemoved &&
                                removedAi.map((tag) => (
                                    <Chip
                                        key={`r${tag}`}
                                        label={label(tag)}
                                        icon="plus"
                                        tone="muted"
                                        onPress={() =>
                                            setRemovedTags(
                                                removedTags.filter(
                                                    (r) => r.toLowerCase() !== tag.toLowerCase()
                                                )
                                            )
                                        }
                                    />
                                ))}
                        </View>
                        {removedAi.length > 0 && (
                            <Pressable
                                accessibilityRole="button"
                                onPress={() => setShowRemoved(!showRemoved)}
                                hitSlop={8}
                            >
                                <Text style={{ color: theme.textMuted, fontSize: 13 }}>
                                    {showRemoved
                                        ? t("edit.hideRemoved")
                                        : t("edit.showRemoved", { n: removedAi.length })}
                                </Text>
                            </Pressable>
                        )}
                        <View style={styles.row}>
                            <TextInput
                                value={newTag}
                                onChangeText={setNewTag}
                                placeholder={t("edit.tagPlaceholder")}
                                placeholderTextColor={theme.textPlaceholder}
                                onSubmitEditing={addTag}
                                returnKeyType="done"
                                accessibilityLabel={t("edit.tagPlaceholder")}
                                style={[
                                    styles.tagInput,
                                    {
                                        backgroundColor: theme.surface,
                                        color: theme.text,
                                        borderColor: theme.border,
                                    },
                                ]}
                            />
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={t("common.add")}
                                disabled={!newTag.trim()}
                                onPress={addTag}
                                style={[
                                    styles.addBtn,
                                    {
                                        backgroundColor: theme.accent,
                                        opacity: newTag.trim() ? 1 : 0.4,
                                    },
                                ]}
                            >
                                <MaterialCommunityIcons
                                    name="plus"
                                    size={22}
                                    color={theme.inverseText}
                                />
                            </Pressable>
                        </View>
                    </Section>

                    <View style={styles.fileRow}>
                        <Text style={{ color: theme.text, fontSize: 15, flex: 1 }}>
                            {t("edit.writeToFile")}
                        </Text>
                        <Toggle value={writeFile} onChange={setWriteFile} />
                    </View>

                    <AppButton
                        label={t("common.save")}
                        loading={saving}
                        onPress={() => void save()}
                        style={{ marginTop: 8 }}
                    />
                </ScrollView>
            </KeyboardAvoidingView>

            <OptionSheet
                visible={picker === "genre"}
                title={t("edit.genre")}
                options={genreOptions}
                value={genre}
                onPick={setGenre}
                onClose={() => setPicker(null)}
                allowCustom
            />
            <OptionSheet
                visible={picker === "mood"}
                title={t("edit.mood")}
                options={MOODS.map((m) => ({ value: m, label: label(m) }))}
                value={mood}
                onPick={setMood}
                onClose={() => setPicker(null)}
            />
        </AppScreen>
    );
}

const styles = StyleSheet.create({
    bar: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        height: 52,
        paddingHorizontal: 6,
    },
    barBtn: {
        minWidth: 80,
        height: 44,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 10,
    },
    row: { flexDirection: "row", gap: 12, alignItems: "flex-end" },
    select: {
        height: 48,
        borderRadius: 12,
        borderWidth: 1,
        paddingLeft: 14,
        paddingRight: 10,
        flexDirection: "row",
        alignItems: "center",
    },
    wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    tagInput: {
        flex: 1,
        height: 48,
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 14,
        fontSize: 16,
    },
    addBtn: {
        width: 48,
        height: 48,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    fileRow: { flexDirection: "row", alignItems: "center", minHeight: 52, marginTop: 6 },
});
