import { useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { AppScreen } from "../app-screen";
import {
    Card,
    ConfidenceBar,
    Cover,
    ProfileButton,
    ScreenTitle,
    Segmented,
} from "../ui/primitives";
import { MINI_PLAYER_SPACE } from "../music/mini-player";
import { getListenAggregates, type ListenAggregate } from "../../data/db";
import { useListeningTime, useT, useValueLabel, type TranslationKey } from "../../i18n";
import {
    libraryDistribution,
    periodStart,
    pickDecade,
    summarizeListening,
    type Bucket,
} from "../../library/stats";
import { useAuthStore } from "../../store/useAuthStore";
import { usePlayerStore } from "../../store/usePlayerStore";
import { useAppTheme } from "../../theme/app-theme";

type Period = "week" | "month" | "all";
type Dist = "genres" | "moods" | "languages" | "decades";

function Bars({ data, format }: { data: Bucket[]; format?: (v: number) => string }) {
    const theme = useAppTheme();
    const label = useValueLabel();
    const max = Math.max(1, ...data.map((d) => d.value));
    return (
        <View style={{ gap: 4 }}>
            {data.map((d) => (
                <View key={d.label} style={styles.barRow}>
                    <Text style={{ color: theme.text, width: 104, fontSize: 14 }} numberOfLines={1}>
                        {label(d.label)}
                    </Text>
                    <View style={{ flex: 1 }}>
                        <ConfidenceBar value={d.value / max} height={10} />
                    </View>
                    <Text style={[styles.barValue, { color: theme.textSubtle }]} numberOfLines={1}>
                        {format ? format(d.value) : d.value}
                    </Text>
                </View>
            ))}
        </View>
    );
}

function H2({ children }: { children: string }) {
    const theme = useAppTheme();
    return <Text style={[styles.h2, { color: theme.text }]}>{children}</Text>;
}

/** Listening and library statistics shown as charts and rankings (REQ 61–63). */
export default function StatsScreen() {
    const t = useT();
    const theme = useAppTheme();
    const formatListeningTime = useListeningTime();
    const tracks = usePlayerStore((s) => s.libraryTracks);
    const allTracks = usePlayerStore((s) => s.allTracks);
    const email = useAuthStore((s) => s.user?.email);
    const [period, setPeriod] = useState<Period>("week");
    const [dist, setDist] = useState<Dist>("genres");
    const [aggregates, setAggregates] = useState<ListenAggregate[]>([]);

    useFocusEffect(
        useCallback(() => {
            setAggregates(getListenAggregates(periodStart(period)));
        }, [period])
    );

    const summary = useMemo(
        () => summarizeListening(aggregates, allTracks),
        [aggregates, allTracks]
    );
    const unknown = t("stats.notAnalyzed");
    const library = useMemo(
        () => ({
            genres: libraryDistribution(tracks, (x) => x.genre, unknown),
            moods: libraryDistribution(tracks, (x) => x.mood, unknown),
            languages: libraryDistribution(tracks, (x) => x.language, unknown),
            decades: libraryDistribution(tracks, pickDecade, unknown),
        }),
        [tracks, unknown]
    );
    const artistArt = useMemo(() => {
        const map = new Map<string, string | undefined>();
        for (const x of tracks) if (!map.get(x.artist) && x.artwork) map.set(x.artist, x.artwork);
        return map;
    }, [tracks]);

    const DIST_LABELS: Record<Dist, TranslationKey> = {
        genres: "stats.libraryGenres",
        moods: "stats.libraryMoods",
        languages: "stats.libraryLanguages",
        decades: "stats.libraryDecades",
    };

    return (
        <AppScreen edges={["top"]}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: MINI_PLAYER_SPACE }}
            >
                <ScreenTitle title={t("stats.title")} right={<ProfileButton email={email} />} />
                <View style={{ marginTop: 10 }}>
                    <Segmented<Period>
                        value={period}
                        onChange={setPeriod}
                        options={[
                            { value: "week", label: t("stats.week") },
                            { value: "month", label: t("stats.month") },
                            { value: "all", label: t("stats.all") },
                        ]}
                    />
                </View>

                <Animated.View
                    key={period}
                    entering={FadeIn.duration(300)}
                    style={{ marginTop: 24 }}
                >
                    <Text style={{ color: theme.textSubtle, fontSize: 13 }}>
                        {t("stats.listeningTime")}
                    </Text>
                    <Text style={[styles.big, { color: theme.text }]}>
                        {formatListeningTime(summary.totalMs)}
                    </Text>
                    <Text style={{ color: theme.textSubtle, fontSize: 13, marginTop: 4 }}>
                        {t("stats.plays", { n: summary.plays })}
                    </Text>
                </Animated.View>

                {summary.plays === 0 ? (
                    <Text style={{ color: theme.textMuted, marginTop: 20 }}>
                        {t("stats.noListens")}
                    </Text>
                ) : (
                    <>
                        <H2>{t("stats.topTracks")}</H2>
                        {summary.topTracks.map((x, i) => (
                            <View key={x.track.assetId} style={styles.rank}>
                                <Text style={[styles.rankN, { color: theme.textSubtle }]}>
                                    {i + 1}
                                </Text>
                                <Cover uri={x.track.artwork} size={44} />
                                <View style={{ flex: 1 }}>
                                    <Text
                                        style={{
                                            color: theme.text,
                                            fontSize: 15,
                                            fontWeight: "500",
                                        }}
                                        numberOfLines={1}
                                    >
                                        {x.track.title}
                                    </Text>
                                    <Text
                                        style={{
                                            color: theme.textSubtle,
                                            fontSize: 13,
                                            marginTop: 2,
                                        }}
                                        numberOfLines={1}
                                    >
                                        {x.track.artist}
                                    </Text>
                                </View>
                                <Text
                                    style={{
                                        color: theme.textSubtle,
                                        fontSize: 13,
                                        fontVariant: ["tabular-nums"],
                                    }}
                                >
                                    {x.plays}
                                </Text>
                            </View>
                        ))}

                        <H2>{t("stats.topArtists")}</H2>
                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            showsHorizontalScrollIndicator={false}
                            horizontal
                            contentContainerStyle={{ gap: 16 }}
                        >
                            {summary.topArtists.map((a) => (
                                <View key={a.label} style={{ width: 80, alignItems: "center" }}>
                                    <Cover uri={artistArt.get(a.label)} size={80} radius={40} />
                                    <Text
                                        style={{
                                            color: theme.text,
                                            fontSize: 13,
                                            fontWeight: "500",
                                            marginTop: 8,
                                        }}
                                        numberOfLines={1}
                                    >
                                        {a.label}
                                    </Text>
                                    <Text style={{ color: theme.textSubtle, fontSize: 12 }}>
                                        {formatListeningTime(a.value)}
                                    </Text>
                                </View>
                            ))}
                        </ScrollView>

                        {summary.topGenres.length > 0 && (
                            <>
                                <H2>{t("stats.topGenres")}</H2>
                                <Card style={{ padding: 16 }}>
                                    <Bars data={summary.topGenres} format={formatListeningTime} />
                                </Card>
                            </>
                        )}
                    </>
                )}

                <H2>{t("stats.library")}</H2>
                <Card style={{ padding: 16, gap: 14 }}>
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        showsHorizontalScrollIndicator={false}
                        horizontal
                        contentContainerStyle={{ gap: 6 }}
                    >
                        {(Object.keys(DIST_LABELS) as Dist[]).map((d) => (
                            <Text
                                key={d}
                                accessibilityRole="tab"
                                accessibilityState={{ selected: d === dist }}
                                onPress={() => setDist(d)}
                                style={[
                                    styles.distTab,
                                    {
                                        backgroundColor:
                                            d === dist ? theme.accent : theme.surfaceStrong,
                                        color: d === dist ? theme.inverseText : theme.textMuted,
                                    },
                                ]}
                            >
                                {t(DIST_LABELS[d])}
                            </Text>
                        ))}
                    </ScrollView>
                    <Animated.View key={dist} entering={FadeIn.duration(250)}>
                        <Bars data={library[dist]} />
                    </Animated.View>
                </Card>
            </ScrollView>
        </AppScreen>
    );
}

const styles = StyleSheet.create({
    big: { fontSize: 46, fontWeight: "800", letterSpacing: -1.5, marginTop: 2 },
    h2: { fontSize: 20, fontWeight: "700", marginTop: 30, marginBottom: 12 },
    rank: { flexDirection: "row", alignItems: "center", gap: 12, height: 60 },
    rankN: { width: 18, fontSize: 15, fontWeight: "700", textAlign: "center" },
    barRow: { flexDirection: "row", alignItems: "center", gap: 10, height: 30 },
    barValue: { width: 64, textAlign: "right", fontSize: 12, fontVariant: ["tabular-nums"] },
    distTab: {
        height: 32,
        lineHeight: 32,
        paddingHorizontal: 12,
        borderRadius: 16,
        overflow: "hidden",
        fontSize: 13,
        fontWeight: "600",
    },
});
