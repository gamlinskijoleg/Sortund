import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "../app-screen";
import { PageHeader } from "../shared/page-header";
import { AppButton, Chip, ConfidenceBar, Notice, Section } from "../ui/primitives";
import { AddToPlaylistSheet } from "./add-to-playlist-sheet";
import { usePlayerStore } from "../../store/usePlayerStore";
import { useAuthStore } from "../../store/useAuthStore";
import { analyzeTracks, useAnalysisStore } from "../../analysis/manager";
import { toggleFavourite } from "../../data/library";
import { writeTagsToFile } from "../../library/tag-writer";
import { formatDuration, trackYear } from "../../library/track-utils";
import type { TagCategory } from "../../data/types";
import { useT, useValueLabel, type TranslationKey } from "../../i18n";
import { useAppTheme } from "../../theme/app-theme";
import { playQueue } from "../music/music-home-screen";
import { MINI_PLAYER_SPACE } from "../music/mini-player";

const CATEGORY_TITLES: Partial<Record<TagCategory, TranslationKey>> = {
    genre: "track.genre",
    mood: "track.mood",
    instrument: "track.instruments",
    vocal: "track.vocal",
    language: "track.language",
    theme: "track.themes",
};

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
    const theme = useAppTheme();
    if (value === undefined || value === null || value === "") return null;
    return (
        <View style={[styles.infoRow, { borderBottomColor: theme.border }]}>
            <Text style={{ color: theme.textMuted, fontSize: 14 }}>{label}</Text>
            <Text
                style={{
                    color: theme.text,
                    fontSize: 14,
                    fontWeight: "600",
                    flexShrink: 1,
                    textAlign: "right",
                }}
            >
                {value}
            </Text>
        </View>
    );
}

/** Track card with all detected metadata and tags (REQ 38). */
export default function TrackCardScreen() {
    const { assetId } = useLocalSearchParams<{ assetId: string }>();
    const t = useT();
    const label = useValueLabel();
    const theme = useAppTheme();
    const track = usePlayerStore((s) => s.libraryTracks.find((x) => x.assetId === assetId));
    const library = usePlayerStore((s) => s.libraryTracks);
    const signedIn = useAuthStore((s) => s.status === "signedIn");
    const activeModel = useAnalysisStore((s) => s.activeModelVersion);
    const [playlistOpen, setPlaylistOpen] = useState(false);
    const [writing, setWriting] = useState(false);

    if (!track) {
        return (
            <AppScreen>
                <View style={{ padding: 16 }}>
                    <PageHeader title={t("track.notFound")} />
                </View>
            </AppScreen>
        );
    }

    const outdated =
        track.isAnalyzed && activeModel && track.modelVersion && track.modelVersion !== activeModel;
    const tagDetails = track.tagDetails ?? [];
    const removed = new Set((track.removedTags ?? []).map((x) => x.toLowerCase()));
    const grouped = new Map<TagCategory, typeof tagDetails>();
    for (const tag of tagDetails) {
        if (removed.has(tag.label.toLowerCase())) continue;
        grouped.set(tag.category, [...(grouped.get(tag.category) ?? []), tag]);
    }

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

    return (
        <AppScreen>
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: MINI_PLAYER_SPACE }}>
                <PageHeader
                    trailingAction={
                        <AppButton
                            compact
                            variant="secondary"
                            icon="pencil"
                            label={t("track.edit")}
                            onPress={() =>
                                router.push({
                                    pathname: "/track/edit/[assetId]",
                                    params: { assetId: track.assetId },
                                })
                            }
                        />
                    }
                />

                <View style={{ alignItems: "center", gap: 12, marginBottom: 20 }}>
                    <View style={[styles.cover, { backgroundColor: track.color }]}>
                        {track.artwork ? (
                            <Image
                                source={{ uri: track.artwork }}
                                style={StyleSheet.absoluteFill}
                                contentFit="cover"
                            />
                        ) : (
                            <MaterialCommunityIcons name="music-note" size={56} color="#fff" />
                        )}
                    </View>
                    <Text style={[styles.title, { color: theme.text }]}>{track.title}</Text>
                    <Text style={{ color: theme.textMuted, fontSize: 16 }}>{track.artist}</Text>
                </View>

                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
                    <AppButton
                        compact
                        icon="play"
                        label={t("track.play")}
                        onPress={() => {
                            const index = library.findIndex((x) => x.assetId === track.assetId);
                            playQueue(library, Math.max(0, index));
                            router.push({
                                pathname: "/listen",
                                params: { assetId: track.assetId },
                            });
                        }}
                    />
                    <AppButton
                        compact
                        variant="secondary"
                        icon={track.isFavourite ? "heart" : "heart-outline"}
                        label={t(track.isFavourite ? "track.unfavourite" : "track.favourite")}
                        onPress={() => toggleFavourite(track.assetId)}
                    />
                    <AppButton
                        compact
                        variant="secondary"
                        icon="playlist-plus"
                        label={t("track.addToPlaylist")}
                        onPress={() => setPlaylistOpen(true)}
                    />
                    <AppButton
                        compact
                        variant="secondary"
                        icon="vector-link"
                        label={t("track.similar")}
                        onPress={() =>
                            router.push({
                                pathname: "/similar/[assetId]",
                                params: { assetId: track.assetId },
                            })
                        }
                    />
                    <AppButton
                        compact
                        variant="secondary"
                        icon="content-save-edit"
                        label={t("track.writeTags")}
                        loading={writing}
                        onPress={() => void writeTags()}
                    />
                </View>

                {!track.isAnalyzed && (
                    <View style={{ gap: 10, marginBottom: 20 }}>
                        <Notice
                            text={track.analysisError ?? t("track.notAnalyzed")}
                            tone={track.analysisStatus === "failed" ? "error" : "info"}
                        />
                        {signedIn &&
                            (track.analysisStatus === "none" ||
                                track.analysisStatus === "failed") && (
                                <AppButton
                                    icon="creation"
                                    label={t("track.analyze")}
                                    onPress={() => void analyzeTracks([track])}
                                />
                            )}
                    </View>
                )}
                {outdated && (
                    <View style={{ gap: 10, marginBottom: 20 }}>
                        <Notice
                            text={t("track.modelOutdated", {
                                old: track.modelVersion!,
                                current: activeModel,
                            })}
                        />
                        {/* REQ 34: re-analysis after a model update */}
                        <AppButton
                            variant="secondary"
                            icon="refresh"
                            label={t("track.reanalyze")}
                            onPress={() => void analyzeTracks([track], { force: true })}
                        />
                    </View>
                )}

                <Section>
                    <View>
                        <InfoRow label={t("track.album")} value={track.album} />
                        <InfoRow label={t("track.year")} value={trackYear(track)} />
                        <InfoRow label={t("track.genre")} value={track.genre} />
                        <InfoRow label={t("track.mood")} value={label(track.mood)} />
                        <InfoRow label={t("track.language")} value={label(track.language)} />
                        <InfoRow label={t("track.vocal")} value={label(track.vocal)} />
                        <InfoRow
                            label={t("track.bpm")}
                            value={track.bpm ? `${Math.round(track.bpm)} BPM` : undefined}
                        />
                        <InfoRow label={t("track.key")} value={track.musicalKey} />
                        <InfoRow
                            label={t("track.duration")}
                            value={track.duration ? formatDuration(track.duration) : undefined}
                        />
                        <InfoRow label={t("track.source")} value={track.analysis_source} />
                    </View>
                </Section>

                {grouped.size > 0 && (
                    <Section title={t("track.tags")}>
                        {[...grouped.entries()].map(([category, tags]) => (
                            <View key={category} style={{ gap: 6, marginBottom: 8 }}>
                                {CATEGORY_TITLES[category] && (
                                    <Text
                                        style={{
                                            color: theme.textMuted,
                                            fontSize: 12,
                                            fontWeight: "700",
                                            textTransform: "uppercase",
                                        }}
                                    >
                                        {t(CATEGORY_TITLES[category])}
                                    </Text>
                                )}
                                {tags.map((tag) => (
                                    <View
                                        key={tag.label}
                                        style={{
                                            flexDirection: "row",
                                            alignItems: "center",
                                            gap: 10,
                                        }}
                                    >
                                        <Text
                                            style={{ color: theme.text, width: 140 }}
                                            numberOfLines={1}
                                        >
                                            {label(tag.label)}
                                        </Text>
                                        <ConfidenceBar value={tag.confidence} />
                                        <Text
                                            style={{
                                                color: theme.textSubtle,
                                                width: 42,
                                                textAlign: "right",
                                                fontSize: 12,
                                            }}
                                        >
                                            {Math.round(tag.confidence * 100)}%
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        ))}
                    </Section>
                )}

                {(track.userTags?.length ?? 0) > 0 && (
                    <Section title={t("edit.userTags")}>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                            {track.userTags!.map((tag) => (
                                <Chip key={tag} label={tag} icon="tag" />
                            ))}
                        </View>
                    </Section>
                )}

                {track.lyrics && (
                    <Section title={t("track.lyrics")}>
                        <Text style={{ color: theme.textMuted, lineHeight: 21 }}>
                            {track.lyrics}
                        </Text>
                    </Section>
                )}
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
    cover: {
        width: 180,
        height: 180,
        borderRadius: 24,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
    },
    title: { fontSize: 22, fontWeight: "800", textAlign: "center" },
    infoRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        gap: 16,
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
});
