import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "../app-screen";
import { TrackListItem } from "../shared/track-list-item";
import { AppButton, Cover, EmptyState, Notice, TopBar } from "../ui/primitives";
import { MINI_PLAYER_SPACE } from "../music/mini-player";
import { openTrack, playQueue } from "../music/music-home-screen";
import { analysisApi } from "../../api/endpoints";
import { useT } from "../../i18n";
import { useAuthStore } from "../../store/useAuthStore";
import { usePlayerStore } from "../../store/usePlayerStore";
import { useAppTheme } from "../../theme/app-theme";
import type { MusicTrack } from "../../data/types";

/** Tracks from the user's library that sound similar to the selected one (REQ 56–57). */
export default function SimilarScreen() {
    const { assetId } = useLocalSearchParams<{ assetId: string }>();
    const t = useT();
    const theme = useAppTheme();
    const library = usePlayerStore((s) => s.libraryTracks);
    const allTracks = usePlayerStore((s) => s.allTracks);
    const signedIn = useAuthStore((s) => s.status === "signedIn");
    const source = allTracks.find((x) => x.assetId === assetId);
    const [results, setResults] = useState<{ track: MusicTrack; score: number }[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    const sourceFingerprint = source?.fingerprint;
    const candidates = useMemo(
        () =>
            library.filter(
                (x) => x.fingerprint && x.assetId !== assetId && x.fingerprint !== sourceFingerprint
            ),
        [library, assetId, sourceFingerprint]
    );

    useEffect(() => {
        if (!source?.fingerprint || !signedIn) return;
        let active = true;
        const byFingerprint = new Map<string, MusicTrack>();
        for (const c of candidates)
            if (!byFingerprint.has(c.fingerprint!)) byFingerprint.set(c.fingerprint!, c);
        analysisApi
            .similar(source.fingerprint, [...byFingerprint.keys()], 30)
            .then((list) => {
                if (!active) return;
                setResults(
                    list
                        .map((r) => ({ track: byFingerprint.get(r.fingerprint)!, score: r.score }))
                        .filter((r) => !!r.track)
                );
            })
            .catch((e: unknown) => active && setError(e instanceof Error ? e.message : String(e)));
        return () => {
            active = false;
        };
    }, [source?.fingerprint, signedIn, candidates]);

    const queue = results?.map((r) => r.track) ?? [];
    let body: React.ReactNode = null;
    if (!signedIn)
        body = (
            <EmptyState
                icon="account-lock-outline"
                text={t("similar.loginRequired")}
                action={
                    <AppButton
                        compact
                        label={t("ai.login")}
                        onPress={() => router.push("/auth/login")}
                    />
                }
            />
        );
    else if (!source?.fingerprint)
        body = <EmptyState icon="waveform" text={t("similar.notAnalyzed")} />;
    else if (error) body = <Notice tone="error" text={error} />;
    else if (!results) body = <ActivityIndicator color={theme.text} style={{ marginTop: 40 }} />;
    else if (results.length === 0) body = <EmptyState icon="waveform" text={t("similar.empty")} />;

    const header = (
        <View style={{ paddingHorizontal: 16, gap: 16, paddingBottom: 8 }}>
            {source && (
                <View style={styles.source}>
                    <Cover uri={source.artwork} size={64} radius={8} />
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.kicker, { color: theme.textSubtle }]}>
                            {t("similar.soundsLike")}
                        </Text>
                        <Text
                            accessibilityRole="header"
                            style={[styles.title, { color: theme.text }]}
                            numberOfLines={1}
                        >
                            {source.title}
                        </Text>
                        <Text style={{ color: theme.textMuted, fontSize: 14 }} numberOfLines={1}>
                            {source.artist}
                        </Text>
                    </View>
                </View>
            )}
            {queue.length > 0 && (
                <>
                    <AppButton
                        icon="play"
                        label={t("similar.play")}
                        onPress={() => {
                            // REQ 57: one action builds a queue from the similar tracks
                            playQueue(source ? [source, ...queue] : queue, 0);
                            router.push("/listen");
                        }}
                    />
                    <Text style={{ color: theme.textSubtle, fontSize: 13 }}>
                        {t("similar.count", { n: queue.length })}
                    </Text>
                </>
            )}
            {body}
        </View>
    );

    return (
        <AppScreen>
            <View style={{ paddingHorizontal: 8 }}>
                <TopBar />
            </View>
            <FlatList
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
                data={body ? [] : (results ?? [])}
                keyExtractor={(r) => r.track.assetId}
                ListHeaderComponent={header}
                renderItem={({ item, index }) => (
                    <TrackListItem
                        track={item.track}
                        onPress={() => playQueue(queue, index)}
                        onLongPress={() => openTrack(item.track.assetId)}
                        trailingActionSlot={
                            <View
                                accessibilityLabel={t("similar.score", {
                                    n: Math.round(item.score * 100),
                                })}
                                style={[styles.score, { borderColor: theme.surfaceStrong }]}
                            >
                                <Text
                                    style={{
                                        color: theme.text,
                                        fontSize: 12,
                                        fontWeight: "600",
                                        fontVariant: ["tabular-nums"],
                                    }}
                                >
                                    {Math.round(item.score * 100)}%
                                </Text>
                            </View>
                        }
                    />
                )}
                contentContainerStyle={{ paddingBottom: MINI_PLAYER_SPACE }}
            />
        </AppScreen>
    );
}

const styles = StyleSheet.create({
    source: { flexDirection: "row", alignItems: "center", gap: 14 },
    kicker: { fontSize: 12, letterSpacing: 0.6, textTransform: "uppercase" },
    title: { fontSize: 22, fontWeight: "700", letterSpacing: -0.3, marginTop: 2 },
    score: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 2,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 8,
    },
});
