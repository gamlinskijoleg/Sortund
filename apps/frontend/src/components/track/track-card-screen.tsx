import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { AppScreen } from "../app-screen";
import {
    AppButton,
    Card,
    Chip,
    ConfidenceBar,
    Cover,
    EmptyState,
    ListRow,
    Section,
    TopBar,
    type IconName,
} from "../ui/primitives";
import { AddToPlaylistSheet } from "./add-to-playlist-sheet";
import { usePlayerStore } from "../../store/usePlayerStore";
import { useAuthStore } from "../../store/useAuthStore";
import { analyzeTracks } from "../../analysis/manager";
import { toggleFavourite } from "../../data/library";
import { writeTagsToFile } from "../../library/tag-writer";
import { formatDuration, trackYear } from "../../library/track-utils";
import { folderOf } from "../../library/duplicates";
import type { MusicTrack, TagCategory } from "../../data/types";
import { useT, useValueLabel, type TranslationKey } from "../../i18n";
import { useAppTheme } from "../../theme/app-theme";
import { playQueue } from "../music/music-home-screen";
import { MINI_PLAYER_SPACE } from "../music/mini-player";

const CATEGORY_TITLES: Partial<Record<TagCategory, TranslationKey>> = {
    genre: "track.genre",
    style: "track.style",
    mood: "track.mood",
    vocal: "track.vocal",
    instrument: "track.instruments",
    language: "track.language",
    theme: "track.themes",
};
const CATEGORY_ORDER: TagCategory[] = [
    "genre",
    "style",
    "mood",
    "vocal",
    "instrument",
    "language",
    "theme",
];

function Action({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
    const theme = useAppTheme();
    return (
        <Pressable accessibilityRole="button" onPress={onPress} style={styles.action}>
            {({ pressed }) => (
                <>
                    <View
                        style={[
                            styles.actionCircle,
                            {
                                backgroundColor: pressed ? theme.surfaceStrong : theme.surface,
                                transform: [{ scale: pressed ? 0.92 : 1 }],
                            },
                        ]}
                    >
                        <MaterialCommunityIcons name={icon} size={22} color={theme.text} />
                    </View>
                    <Text style={{ color: theme.textMuted, fontSize: 12 }} numberOfLines={1}>
                        {label}
                    </Text>
                </>
            )}
        </Pressable>
    );
}

/** Not analysed / in progress / failed: what the user can do about it. */
function AnalysisState({ track }: { track: MusicTrack }) {
    const t = useT();
    const theme = useAppTheme();
    const signedIn = useAuthStore((s) => s.status === "signedIn");
    const status = track.analysisStatus ?? (track.isAnalyzed ? "done" : "none");
    if (status === "done") return null;

    const busy = status === "queued" || status === "processing";
    const text =
        status === "failed"
            ? (track.analysisError ?? t("ai.status.failed"))
            : busy
              ? t(status === "queued" ? "ai.status.queued" : "ai.status.processing")
              : t("track.notAnalyzed");

    return (
        <Card style={{ padding: 16, gap: 14, marginBottom: 26 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                {busy ? (
                    <ActivityIndicator color={theme.text} />
                ) : (
                    <MaterialCommunityIcons
                        name={status === "failed" ? "alert-outline" : "creation-outline"}
                        size={22}
                        color={theme.text}
                    />
                )}
                <Text style={{ color: theme.text, fontSize: 15, flex: 1 }}>{text}</Text>
            </View>
            {!busy &&
                (signedIn ? (
                    <AppButton
                        compact
                        icon={status === "failed" ? "refresh" : "creation"}
                        label={t(status === "failed" ? "common.retry" : "track.analyze")}
                        onPress={() => void analyzeTracks([track])}
                    />
                ) : (
                    <AppButton
                        compact
                        variant="secondary"
                        label={t("ai.login")}
                        onPress={() => router.push("/auth/login")}
                    />
                ))}
        </Card>
    );
}

/** Track card with all detected metadata and tags (REQ 38). */
export default function TrackCardScreen() {
    const { assetId } = useLocalSearchParams<{ assetId: string }>();
    const t = useT();
    const label = useValueLabel();
    const theme = useAppTheme();
    const track = usePlayerStore((s) => s.allTracks.find((x) => x.assetId === assetId));
    const library = usePlayerStore((s) => s.libraryTracks);
    const signedIn = useAuthStore((s) => s.status === "signedIn");
    const copies = usePlayerStore(
        (s) =>
            s.duplicateGroups.find((g) => g.copies.some((c) => c.assetId === assetId))?.copies
                .length ?? 0
    );
    const [playlistOpen, setPlaylistOpen] = useState(false);
    const [writing, setWriting] = useState(false);
    const [lyricsOpen, setLyricsOpen] = useState(false);

    if (!track) {
        return (
            <AppScreen>
                <View style={{ paddingHorizontal: 8 }}>
                    <TopBar />
                </View>
                <EmptyState icon="music-note-off" text={t("track.notFound")} />
            </AppScreen>
        );
    }

    const removed = new Set((track.removedTags ?? []).map((x) => x.toLowerCase()));
    const grouped = new Map<TagCategory, NonNullable<MusicTrack["tagDetails"]>>();
    for (const tag of track.tagDetails ?? []) {
        if (removed.has(tag.label.toLowerCase()) || !CATEGORY_TITLES[tag.category]) continue;
        grouped.set(tag.category, [...(grouped.get(tag.category) ?? []), tag]);
    }
    const groups = CATEGORY_ORDER.filter((c) => grouped.has(c));
    const year = trackYear(track);
    const subline = [track.album, year].filter(Boolean).join(", ");
    const edit = () =>
        router.push({ pathname: "/track/edit/[assetId]", params: { assetId: track.assetId } });

    const writeTags = async () => {
        setWriting(true);
        try {
            const outcome = await writeTagsToFile(track);
            if (outcome.kind === "written") Alert.alert(t("common.done"), t("track.writeTagsDone"));
            else if (outcome.kind === "copy")
                Alert.alert(t("common.done"), t("track.writeTagsCopy"));
            else Alert.alert(t("common.error"), t("track.writeTagsMp3Only"));
        } catch (error) {
            Alert.alert(t("common.error"), t("track.writeTagsFailed", { error: String(error) }));
        } finally {
            setWriting(false);
        }
    };

    const details: [string, string | undefined][] = [
        [t("track.album"), track.album],
        [t("track.year"), year ? String(year) : undefined],
        // Shown here only when the AI section does not already list them (e.g. tags from the file).
        [t("track.genre"), grouped.has("genre") ? undefined : track.genre],
        [t("track.mood"), grouped.has("mood") ? undefined : label(track.mood) || undefined],
        [
            t("track.language"),
            grouped.has("language") ? undefined : label(track.language) || undefined,
        ],
        [t("track.bpm"), track.bpm ? `${Math.round(track.bpm)} BPM` : undefined],
        [t("track.key"), track.musicalKey],
        [t("track.duration"), track.duration ? formatDuration(track.duration) : undefined],
        [t("track.source"), track.analysis_source],
        [t("track.folder"), folderOf(track.sourceUri)],
    ];

    return (
        <AppScreen>
            <View style={{ paddingHorizontal: 8 }}>
                <TopBar
                    right={
                        <Pressable
                            accessibilityRole="button"
                            onPress={edit}
                            hitSlop={8}
                            style={styles.textBtn}
                        >
                            <Text style={{ color: theme.text, fontSize: 16, fontWeight: "600" }}>
                                {t("track.edit")}
                            </Text>
                        </Pressable>
                    }
                />
            </View>
            <ScrollView
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: MINI_PLAYER_SPACE }}
            >
                <View style={styles.hero}>
                    <Cover uri={track.artwork} size={200} radius={12} style={styles.heroCover} />
                    <Text style={[styles.title, { color: theme.text }]}>{track.title}</Text>
                    <Text style={{ color: theme.textMuted, fontSize: 16, marginTop: 4 }}>
                        {track.artist}
                    </Text>
                    {!!subline && (
                        <Text style={{ color: theme.textSubtle, fontSize: 13, marginTop: 2 }}>
                            {subline}
                        </Text>
                    )}
                </View>

                <AppButton
                    icon="play"
                    label={t("track.play")}
                    onPress={() => {
                        const index = library.findIndex((x) => x.assetId === track.assetId);
                        // A hidden duplicate is not in the library list, so it plays on its own.
                        if (index < 0) playQueue([track], 0);
                        else playQueue(library, index);
                        router.push({ pathname: "/listen", params: { assetId: track.assetId } });
                    }}
                />
                <View style={styles.actions}>
                    <Action
                        icon={track.isFavourite ? "heart" : "heart-outline"}
                        label={t(track.isFavourite ? "track.inFavourites" : "track.toFavourites")}
                        onPress={() => toggleFavourite(track.assetId)}
                    />
                    <Action
                        icon="playlist-plus"
                        label={t("track.toPlaylist")}
                        onPress={() => setPlaylistOpen(true)}
                    />
                    <Action
                        icon="waveform"
                        label={t("track.similarShort")}
                        onPress={() =>
                            router.push({
                                pathname: "/similar/[assetId]",
                                params: { assetId: track.assetId },
                            })
                        }
                    />
                </View>

                <AnalysisState track={track} />

                {groups.length > 0 && (
                    <Section
                        title={t("track.aiDetected")}
                        action={
                            signedIn ? (
                                // REQ 34: re-analysis on request (after a model update or to
                                // refresh lyrics and metadata); it bypasses the server cache.
                                <Pressable
                                    accessibilityRole="button"
                                    onPress={() => void analyzeTracks([track], { force: true })}
                                    hitSlop={10}
                                    style={styles.inlineBtn}
                                >
                                    <MaterialCommunityIcons
                                        name="refresh"
                                        size={16}
                                        color={theme.text}
                                    />
                                    <Text
                                        style={{
                                            color: theme.text,
                                            fontWeight: "600",
                                            fontSize: 14,
                                        }}
                                    >
                                        {t("track.refreshAnalysis")}
                                    </Text>
                                </Pressable>
                            ) : undefined
                        }
                    >
                        <Card style={{ paddingHorizontal: 16 }}>
                            {groups.map((category, i) => (
                                <View
                                    key={category}
                                    style={[
                                        styles.tagGroup,
                                        i > 0 && {
                                            borderTopWidth: StyleSheet.hairlineWidth,
                                            borderTopColor: theme.border,
                                        },
                                    ]}
                                >
                                    <Text
                                        style={{
                                            color: theme.textSubtle,
                                            fontSize: 13,
                                            marginBottom: 8,
                                        }}
                                    >
                                        {t(CATEGORY_TITLES[category]!)}
                                    </Text>
                                    {grouped.get(category)!.map((tag) => (
                                        <View key={tag.label} style={styles.tagRow}>
                                            <Text
                                                style={{ color: theme.text, fontSize: 15, flex: 1 }}
                                                numberOfLines={1}
                                            >
                                                {label(tag.label)}
                                            </Text>
                                            <View style={{ width: 110 }}>
                                                <ConfidenceBar value={tag.confidence} />
                                            </View>
                                            <Text
                                                style={[
                                                    styles.percent,
                                                    { color: theme.textSubtle },
                                                ]}
                                            >
                                                {Math.round(tag.confidence * 100)}%
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            ))}
                        </Card>
                    </Section>
                )}

                <Section title={t("track.details")}>
                    <Card>
                        {details
                            .filter(([, v]) => !!v)
                            .map(([k, v], i) => (
                                <ListRow key={k} first={i === 0} title={k} value={v} />
                            ))}
                        {copies > 1 && (
                            <ListRow
                                title={t("duplicates.title")}
                                value={t("duplicates.copies", { n: copies })}
                                chevron
                                onPress={() => router.push("/library/duplicates")}
                            />
                        )}
                    </Card>
                </Section>

                <Section title={t("edit.userTags")}>
                    <View style={styles.wrap}>
                        {(track.userTags ?? []).map((tag) => (
                            <Chip key={tag} label={tag} />
                        ))}
                        <Chip label={t("common.add")} icon="plus" tone="muted" onPress={edit} />
                    </View>
                </Section>

                {!!track.lyrics && (
                    <Section title={t("track.lyrics")}>
                        <Card style={{ padding: 16, gap: 12 }}>
                            {track.lyricsSource === "whisper" && (
                                <Text style={{ color: theme.textSubtle, fontSize: 12 }}>
                                    {t("track.lyricsFragment")}
                                </Text>
                            )}
                            <Text
                                style={{ color: theme.textMuted, lineHeight: 22, fontSize: 15 }}
                                numberOfLines={lyricsOpen ? undefined : 6}
                            >
                                {track.lyrics}
                            </Text>
                            {track.lyrics.split("\n").length > 6 && (
                                <Pressable
                                    accessibilityRole="button"
                                    onPress={() => setLyricsOpen(!lyricsOpen)}
                                    hitSlop={8}
                                >
                                    <Text style={{ color: theme.text, fontWeight: "600" }}>
                                        {t(lyricsOpen ? "track.lyricsLess" : "track.lyricsMore")}
                                    </Text>
                                </Pressable>
                            )}
                        </Card>
                    </Section>
                )}

                <Card>
                    <ListRow
                        first
                        icon="tag-outline"
                        title={t("track.writeTags")}
                        onPress={() => void writeTags()}
                        right={writing ? <ActivityIndicator color={theme.text} /> : undefined}
                        disabled={writing}
                    />
                    <ListRow icon="pencil-outline" title={t("track.fix")} onPress={edit} chevron />
                </Card>
            </ScrollView>

            <AddToPlaylistSheet
                visible={playlistOpen}
                assetIds={[track.assetId]}
                onClose={() => setPlaylistOpen(false)}
                onAdded={(name) =>
                    Alert.alert(t("common.done"), t("track.addedToPlaylist", { name }))
                }
            />
        </AppScreen>
    );
}

const styles = StyleSheet.create({
    textBtn: { height: 44, justifyContent: "center", paddingHorizontal: 10 },
    hero: { alignItems: "center", paddingTop: 4, paddingBottom: 22 },
    heroCover: {
        elevation: 14,
        shadowColor: "#000",
        shadowOpacity: 0.45,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 14 },
        marginBottom: 20,
    },
    title: { fontSize: 24, fontWeight: "700", textAlign: "center", letterSpacing: -0.4 },
    actions: {
        flexDirection: "row",
        justifyContent: "space-around",
        marginTop: 18,
        marginBottom: 26,
    },
    action: { alignItems: "center", gap: 6, minWidth: 88 },
    actionCircle: {
        width: 50,
        height: 50,
        borderRadius: 25,
        alignItems: "center",
        justifyContent: "center",
    },
    inlineBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
    tagGroup: { paddingVertical: 12 },
    tagRow: { flexDirection: "row", alignItems: "center", gap: 10, height: 28 },
    percent: { width: 38, textAlign: "right", fontSize: 12, fontVariant: ["tabular-nums"] },
    wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
