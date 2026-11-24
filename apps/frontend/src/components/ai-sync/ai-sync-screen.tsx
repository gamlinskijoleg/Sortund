import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "../app-screen";
import { TRACK_ROW_HEIGHT, TrackListItem } from "../shared/track-list-item";
import { AppButton, ConfidenceBar, EmptyState, Notice, Segmented } from "../ui/primitives";
import { MINI_PLAYER_SPACE } from "../music/mini-player";
import { analyzeTracks, retryFailed, useAnalysisStore } from "../../analysis/manager";
import type { AnalysisStatus, MusicTrack } from "../../data/types";
import { useT, type TranslationKey } from "../../i18n";
import { useAuthStore } from "../../store/useAuthStore";
import { usePlayerStore } from "../../store/usePlayerStore";
import { useAppTheme } from "../../theme/app-theme";

type FilterKey = "all" | "none" | "pending" | "failed" | "done";

const STATUS_ICON: Record<AnalysisStatus, keyof typeof MaterialCommunityIcons.glyphMap> = {
    none: "cloud-upload-outline",
    queued: "clock-outline",
    processing: "progress-clock",
    done: "check-circle",
    failed: "alert-circle",
};

function StatusBadge({ status }: { status: AnalysisStatus }) {
    const theme = useAppTheme();
    const t = useT();
    const color =
        status === "done"
            ? theme.success
            : status === "failed"
              ? theme.danger
              : status === "none"
                ? theme.textSubtle
                : theme.warning;
    return (
        <View style={styles.badge} accessibilityLabel={t(`ai.status.${status}` as TranslationKey)}>
            {status === "processing" ? (
                <ActivityIndicator size="small" color={color} />
            ) : (
                <MaterialCommunityIcons name={STATUS_ICON[status]} size={22} color={color} />
            )}
            <Text style={{ color, fontSize: 11 }} numberOfLines={1}>
                {t(`ai.status.${status}` as TranslationKey)}
            </Text>
        </View>
    );
}

/** Sending tracks for analysis and following their status (REQ 13–20). */
export default function AiAnalyzeScreen() {
    const t = useT();
    const theme = useAppTheme();
    const tracks = usePlayerStore((s) => s.libraryTracks);
    const signedIn = useAuthStore((s) => s.status === "signedIn");
    const usage = useAnalysisStore((s) => s.usage);
    const uploading = useAnalysisStore((s) => s.uploading);
    const lastError = useAnalysisStore((s) => s.lastError);
    const activeModel = useAnalysisStore((s) => s.activeModelVersion);

    const [filter, setFilter] = useState<FilterKey>("all");
    const [selecting, setSelecting] = useState(false);
    const [selected, setSelected] = useState<Set<string>>(new Set());

    useFocusEffect(
        useCallback(() => {
            void useAnalysisStore.getState().refreshUsage();
        }, [])
    );

    const status = (x: MusicTrack): AnalysisStatus =>
        x.analysisStatus ?? (x.isAnalyzed ? "done" : "none");
    const groups = useMemo(() => {
        const notAnalyzed = tracks.filter((x) => status(x) === "none");
        const failed = tracks.filter((x) => status(x) === "failed");
        const pending = tracks.filter((x) => ["queued", "processing"].includes(status(x)));
        const outdated = tracks.filter(
            (x) =>
                status(x) === "done" &&
                activeModel &&
                x.modelVersion &&
                x.modelVersion !== activeModel
        );
        return { notAnalyzed, failed, pending, outdated };
    }, [tracks, activeModel]);

    const visible = useMemo(() => {
        return tracks.filter((x) => {
            const s = status(x);
            if (filter === "none") return s === "none";
            if (filter === "pending") return s === "queued" || s === "processing";
            if (filter === "failed") return s === "failed";
            if (filter === "done") return s === "done";
            return true;
        });
    }, [tracks, filter]);

    const toggle = (assetId: string) => {
        const next = new Set(selected);
        if (next.has(assetId)) next.delete(assetId);
        else next.add(assetId);
        setSelected(next);
    };

    const runSelected = () => {
        const list = tracks.filter(
            (x) => selected.has(x.assetId) && !["queued", "processing"].includes(status(x))
        );
        setSelecting(false);
        setSelected(new Set());
        void analyzeTracks(list);
    };

    if (!signedIn) {
        return (
            <AppScreen edges={["top"]}>
                <EmptyState
                    icon="creation"
                    text={t("ai.loginRequired")}
                    action={
                        <AppButton
                            label={t("ai.login")}
                            icon="login"
                            onPress={() => router.push("/auth/login")}
                        />
                    }
                />
            </AppScreen>
        );
    }

    const header = (
        <View style={{ padding: 16, gap: 12 }}>
            <Text style={[styles.h1, { color: theme.text }]}>{t("ai.title")}</Text>

            {usage && (
                <View style={[styles.usage, { backgroundColor: theme.surface }]}>
                    <Text style={{ color: theme.text, fontWeight: "600" }}>
                        {t("ai.usage", { used: usage.used, limit: usage.limit })}
                    </Text>
                    <ConfidenceBar value={usage.limit ? usage.used / usage.limit : 1} />
                    {(usage.pending > 0 || uploading > 0) && (
                        <Text style={{ color: theme.textMuted, fontSize: 13 }}>
                            {t("ai.pending", { n: Math.max(usage.pending, groups.pending.length) })}
                        </Text>
                    )}
                </View>
            )}

            {lastError?.code === "limit" && usage && (
                <Notice
                    tone="warning"
                    text={t("ai.limitReached", { used: usage.used, limit: usage.limit })}
                />
            )}
            {lastError?.code === "network" && <Notice tone="error" text={t("auth.network")} />}

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <AppButton
                    compact
                    icon="creation"
                    label={t("ai.analyzeAll", { n: groups.notAnalyzed.length })}
                    disabled={groups.notAnalyzed.length === 0}
                    onPress={() => void analyzeTracks(groups.notAnalyzed)}
                />
                {groups.failed.length > 0 && (
                    <AppButton
                        compact
                        variant="secondary"
                        icon="refresh"
                        label={t("ai.retryFailed", { n: groups.failed.length })}
                        onPress={() => void retryFailed(groups.failed)}
                    />
                )}
                {groups.outdated.length > 0 && (
                    <AppButton
                        compact
                        variant="secondary"
                        icon="update"
                        label={t("ai.reanalyzeOutdated", { n: groups.outdated.length })}
                        onPress={() => void analyzeTracks(groups.outdated, { force: true })}
                    />
                )}
                <AppButton
                    compact
                    variant={selecting ? "primary" : "ghost"}
                    icon="checkbox-multiple-marked-outline"
                    label={selecting ? t("ai.selected", { n: selected.size }) : t("ai.select")}
                    onPress={() => {
                        setSelecting(!selecting);
                        setSelected(new Set());
                    }}
                />
            </View>

            <Segmented<FilterKey>
                value={filter}
                onChange={setFilter}
                options={[
                    { value: "all", label: t("ai.filter.all") },
                    { value: "none", label: t("ai.filter.none") },
                    { value: "pending", label: t("ai.filter.pending") },
                    { value: "failed", label: t("ai.filter.failed") },
                    { value: "done", label: t("ai.filter.done") },
                ]}
            />
        </View>
    );

    return (
        <AppScreen edges={["top"]}>
            <FlatList
                data={visible}
                keyExtractor={(x) => x.assetId}
                ListHeaderComponent={header}
                renderItem={({ item }) => (
                    <TrackListItem
                        track={item}
                        selected={selecting && selected.has(item.assetId)}
                        subtitle={
                            item.analysisStatus === "failed" && item.analysisError
                                ? item.analysisError
                                : undefined
                        }
                        onPress={() =>
                            selecting
                                ? toggle(item.assetId)
                                : router.push({
                                      pathname: "/track/[assetId]",
                                      params: { assetId: item.assetId },
                                  })
                        }
                        onLongPress={() => {
                            setSelecting(true);
                            toggle(item.assetId);
                        }}
                        trailingActionSlot={<StatusBadge status={status(item)} />}
                    />
                )}
                getItemLayout={(_, index) => ({
                    length: TRACK_ROW_HEIGHT,
                    offset: TRACK_ROW_HEIGHT * index,
                    index,
                })}
                ListEmptyComponent={<EmptyState icon="playlist-check" text={t("home.noResults")} />}
                contentContainerStyle={{ paddingBottom: MINI_PLAYER_SPACE + 60 }}
                removeClippedSubviews
                windowSize={7}
            />
            {selecting && selected.size > 0 && (
                <View style={[styles.fab, { bottom: MINI_PLAYER_SPACE - 20 }]}>
                    <AppButton
                        icon="creation"
                        label={`${t("ai.analyzeSelected")} (${selected.size})`}
                        onPress={runSelected}
                    />
                </View>
            )}
        </AppScreen>
    );
}

const styles = StyleSheet.create({
    h1: { fontSize: 26, fontWeight: "800" },
    usage: { borderRadius: 14, padding: 14, gap: 8 },
    badge: { alignItems: "center", width: 84, gap: 2 },
    fab: { position: "absolute", left: 16, right: 16 },
});
