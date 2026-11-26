import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { AppScreen } from "../app-screen";
import { TRACK_ROW_HEIGHT, TrackListItem } from "../shared/track-list-item";
import {
    AppButton,
    ConfidenceBar,
    EmptyState,
    Notice,
    ProfileButton,
    ScreenTitle,
} from "../ui/primitives";
import { MINI_PLAYER_SPACE, useBottomOverlayOffset } from "../music/mini-player";
import { openTrack } from "../music/music-home-screen";
import { analyzeTracks, retryFailed, useAnalysisStore } from "../../analysis/manager";
import type { AnalysisStatus, MusicTrack } from "../../data/types";
import { useT, type TranslationKey } from "../../i18n";
import { useAuthStore } from "../../store/useAuthStore";
import { usePlayerStore } from "../../store/usePlayerStore";
import { useAppTheme } from "../../theme/app-theme";

type FilterKey = "all" | "none" | "pending" | "failed" | "done";

const STATUS_ICON: Record<AnalysisStatus, keyof typeof MaterialCommunityIcons.glyphMap> = {
    none: "circle-outline",
    queued: "clock-outline",
    processing: "loading",
    done: "check",
    failed: "alert-outline",
};

function StatusLabel({ status }: { status: AnalysisStatus }) {
    const theme = useAppTheme();
    const t = useT();
    const muted = status === "done" || status === "none";
    const color = muted ? theme.textSubtle : theme.text;
    return (
        <View style={styles.status}>
            {status === "processing" ? (
                <ActivityIndicator size={13} color={color} />
            ) : (
                <MaterialCommunityIcons name={STATUS_ICON[status]} size={14} color={color} />
            )}
            <Text style={{ color, fontSize: 12, fontWeight: "500" }} numberOfLines={1}>
                {t(`ai.status.${status}` as TranslationKey)}
            </Text>
        </View>
    );
}

function Check({ on }: { on: boolean }) {
    const theme = useAppTheme();
    return (
        <View
            style={[
                styles.check,
                {
                    borderColor: on ? theme.accent : theme.textSubtle,
                    backgroundColor: on ? theme.accent : "transparent",
                },
            ]}
        >
            {on && <MaterialCommunityIcons name="check" size={14} color={theme.inverseText} />}
        </View>
    );
}

/** Sending tracks for analysis and following their status (REQ 13–20, 34). */
export default function AiAnalyzeScreen() {
    const t = useT();
    const theme = useAppTheme();
    const overlayBottom = useBottomOverlayOffset();
    const tracks = usePlayerStore((s) => s.libraryTracks);
    const signedIn = useAuthStore((s) => s.status === "signedIn");
    const email = useAuthStore((s) => s.user?.email);
    const usage = useAnalysisStore((s) => s.usage);
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
        const done = tracks.filter((x) => status(x) === "done");
        const outdated = done.filter(
            (x) => activeModel && x.modelVersion && x.modelVersion !== activeModel
        );
        return { notAnalyzed, failed, pending, done, outdated };
    }, [tracks, activeModel]);

    const visible = useMemo(
        () =>
            filter === "all"
                ? tracks
                : filter === "none"
                  ? groups.notAnalyzed
                  : filter === "pending"
                    ? groups.pending
                    : filter === "failed"
                      ? groups.failed
                      : groups.done,
        [tracks, groups, filter]
    );

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
                <View style={{ paddingHorizontal: 16 }}>
                    <ScreenTitle title={t("ai.title")} right={<ProfileButton email={email} />} />
                </View>
                <EmptyState
                    icon="creation"
                    text={t("ai.loginRequired")}
                    action={
                        <AppButton
                            compact
                            label={t("ai.login")}
                            onPress={() => router.push("/auth/login")}
                        />
                    }
                />
            </AppScreen>
        );
    }

    const tabs: { key: FilterKey; label: string; n: number }[] = [
        { key: "all", label: t("ai.filter.all"), n: tracks.length },
        { key: "none", label: t("ai.filter.none"), n: groups.notAnalyzed.length },
        { key: "pending", label: t("ai.filter.pending"), n: groups.pending.length },
        { key: "failed", label: t("ai.filter.failed"), n: groups.failed.length },
        { key: "done", label: t("ai.filter.done"), n: groups.done.length },
    ];

    const header = (
        <View style={{ paddingHorizontal: 16, gap: 12, paddingBottom: 6 }}>
            <ScreenTitle
                title={t("ai.title")}
                right={
                    <Pressable
                        accessibilityRole="button"
                        onPress={() => {
                            setSelecting(!selecting);
                            setSelected(new Set());
                        }}
                        style={[
                            styles.selectBtn,
                            { backgroundColor: selecting ? theme.surfaceStrong : "transparent" },
                        ]}
                    >
                        <Text style={{ color: theme.text, fontWeight: "600", fontSize: 15 }}>
                            {t(selecting ? "common.cancel" : "ai.select")}
                        </Text>
                    </Pressable>
                }
            />

            {usage && (
                <View style={[styles.usage, { backgroundColor: theme.surface }]}>
                    <View style={styles.usageHead}>
                        <Text style={{ color: theme.textMuted, fontSize: 14 }}>
                            {t("ai.limitTitle")}
                        </Text>
                        <Text style={{ color: theme.textSubtle, fontSize: 14 }}>
                            <Text style={{ color: theme.text, fontSize: 18, fontWeight: "700" }}>
                                {usage.used}
                            </Text>
                            {` ${t("ai.of")} ${usage.limit}`}
                        </Text>
                    </View>
                    <ConfidenceBar value={usage.limit ? usage.used / usage.limit : 1} height={6} />
                    <Text style={{ color: theme.textSubtle, fontSize: 12 }}>
                        {t("ai.left", { n: Math.max(0, usage.limit - usage.used) })}
                    </Text>
                </View>
            )}

            {lastError?.code === "limit" && usage && (
                <Notice
                    tone="warning"
                    text={t("ai.limitReached", { used: usage.used, limit: usage.limit })}
                />
            )}
            {lastError?.code === "network" && <Notice tone="error" text={t("auth.network")} />}

            <View style={{ flexDirection: "row", gap: 8 }}>
                <AppButton
                    compact
                    icon="creation"
                    label={t("ai.analyzeNew", { n: groups.notAnalyzed.length })}
                    disabled={groups.notAnalyzed.length === 0}
                    onPress={() => void analyzeTracks(groups.notAnalyzed)}
                    style={{ flex: 1 }}
                />
                {groups.failed.length > 0 && (
                    <AppButton
                        compact
                        variant="secondary"
                        icon="refresh"
                        label={t("ai.retry", { n: groups.failed.length })}
                        onPress={() => void retryFailed(groups.failed)}
                    />
                )}
            </View>
            {groups.outdated.length > 0 && (
                // REQ 34: re-analysis after a model update
                <AppButton
                    compact
                    variant="ghost"
                    label={t("ai.refreshOld", { n: groups.outdated.length })}
                    onPress={() => void analyzeTracks(groups.outdated, { force: true })}
                />
            )}

            <ScrollView
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
                horizontal
                style={{ marginHorizontal: -16, marginTop: 4 }}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}
            >
                {tabs.map((tab) => {
                    const on = tab.key === filter;
                    return (
                        <Pressable
                            key={tab.key}
                            accessibilityRole="tab"
                            accessibilityState={{ selected: on }}
                            onPress={() => setFilter(tab.key)}
                            style={[
                                styles.tab,
                                { backgroundColor: on ? theme.accent : theme.surface },
                            ]}
                        >
                            <Text
                                style={{
                                    color: on ? theme.inverseText : theme.textMuted,
                                    fontWeight: "600",
                                    fontSize: 13,
                                }}
                            >
                                {tab.label}
                            </Text>
                            <Text
                                style={{
                                    color: on ? theme.inverseTextMuted : theme.textSubtle,
                                    fontWeight: "600",
                                    fontSize: 13,
                                }}
                            >
                                {tab.n}
                            </Text>
                        </Pressable>
                    );
                })}
            </ScrollView>
        </View>
    );

    return (
        <AppScreen edges={["top"]}>
            <FlatList
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
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
                        leadingSlot={
                            selecting ? <Check on={selected.has(item.assetId)} /> : undefined
                        }
                        onPress={() => (selecting ? toggle(item.assetId) : openTrack(item.assetId))}
                        onLongPress={() => {
                            setSelecting(true);
                            toggle(item.assetId);
                        }}
                        trailingActionSlot={<StatusLabel status={status(item)} />}
                    />
                )}
                getItemLayout={(_, index) => ({
                    length: TRACK_ROW_HEIGHT,
                    offset: TRACK_ROW_HEIGHT * index,
                    index,
                })}
                ListEmptyComponent={<EmptyState icon="playlist-check" text={t("ai.emptyFilter")} />}
                contentContainerStyle={{ paddingBottom: MINI_PLAYER_SPACE + 70 }}
                removeClippedSubviews
                windowSize={7}
            />
            {selecting && selected.size > 0 && (
                <Animated.View
                    entering={FadeInDown.duration(200)}
                    exiting={FadeOutDown.duration(150)}
                    style={[
                        styles.selBar,
                        { bottom: overlayBottom, backgroundColor: theme.accent },
                    ]}
                >
                    <Text
                        style={{
                            color: theme.inverseText,
                            fontSize: 15,
                            fontWeight: "600",
                            flex: 1,
                        }}
                    >
                        {t("ai.selected", { n: selected.size })}
                    </Text>
                    <Pressable
                        accessibilityRole="button"
                        onPress={runSelected}
                        style={[styles.selBtn, { backgroundColor: theme.inverseText }]}
                    >
                        <Text style={{ color: theme.text, fontWeight: "700", fontSize: 14 }}>
                            {t("ai.analyze")}
                        </Text>
                    </Pressable>
                </Animated.View>
            )}
        </AppScreen>
    );
}

const styles = StyleSheet.create({
    selectBtn: { height: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: "center" },
    usage: { borderRadius: 16, padding: 16, gap: 10 },
    usageHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
    status: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 8,
        minWidth: 96,
        justifyContent: "flex-end",
    },
    check: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        alignItems: "center",
        justifyContent: "center",
    },
    tab: {
        height: 34,
        paddingHorizontal: 13,
        borderRadius: 17,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    selBar: {
        position: "absolute",
        left: 8,
        right: 8,
        height: 60,
        borderRadius: 14,
        flexDirection: "row",
        alignItems: "center",
        paddingLeft: 16,
        paddingRight: 8,
        elevation: 12,
    },
    selBtn: { height: 44, paddingHorizontal: 18, borderRadius: 22, justifyContent: "center" },
});
