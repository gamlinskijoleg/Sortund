import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Text, View } from "react-native";
import { AppScreen } from "../app-screen";
import { PageHeader } from "../shared/page-header";
import { TrackListItem } from "../shared/track-list-item";
import { AppButton, EmptyState, Notice } from "../ui/primitives";
import { MINI_PLAYER_SPACE } from "../music/mini-player";
import { playQueue } from "../music/music-home-screen";
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
    const signedIn = useAuthStore((s) => s.status === "signedIn");
    const source = library.find((x) => x.assetId === assetId);
    const [results, setResults] = useState<{ track: MusicTrack; score: number }[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    const candidates = useMemo(
        () => library.filter((x) => x.fingerprint && x.assetId !== assetId),
        [library, assetId]
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
    if (!signedIn) body = <EmptyState icon="account-lock" text={t("similar.loginRequired")} />;
    else if (!source?.fingerprint)
        body = <EmptyState icon="vector-link" text={t("similar.notAnalyzed")} />;
    else if (error) body = <Notice tone="error" text={error} />;
    else if (!results) body = <ActivityIndicator color={theme.accent} style={{ marginTop: 40 }} />;
    else if (results.length === 0)
        body = <EmptyState icon="vector-link" text={t("similar.empty")} />;

    return (
        <AppScreen>
            <FlatList
                data={body ? [] : (results ?? [])}
                keyExtractor={(r) => r.track.assetId}
                ListHeaderComponent={
                    <View style={{ padding: 16, gap: 10 }}>
                        <PageHeader
                            title={t("similar.title")}
                            subtitle={source ? `${source.artist} — ${source.title}` : undefined}
                        />
                        {queue.length > 0 && (
                            <AppButton
                                icon="play"
                                label={t("similar.play")}
                                onPress={() => {
                                    playQueue(source ? [source, ...queue] : queue, 0);
                                    router.push("/listen");
                                }}
                            />
                        )}
                        {body}
                    </View>
                }
                renderItem={({ item, index }) => (
                    <TrackListItem
                        track={item.track}
                        onPress={() => playQueue(queue, index)}
                        onLongPress={() =>
                            router.push({
                                pathname: "/track/[assetId]",
                                params: { assetId: item.track.assetId },
                            })
                        }
                        trailingActionSlot={
                            <Text
                                style={{
                                    color: theme.accent,
                                    fontWeight: "700",
                                    width: 48,
                                    textAlign: "right",
                                }}
                            >
                                {Math.round(item.score * 100)}%
                            </Text>
                        }
                    />
                )}
                contentContainerStyle={{ paddingBottom: MINI_PLAYER_SPACE }}
            />
        </AppScreen>
    );
}
