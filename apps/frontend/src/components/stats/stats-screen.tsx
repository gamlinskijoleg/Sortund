import { useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "../app-screen";
import { Section, Segmented } from "../ui/primitives";
import { MINI_PLAYER_SPACE } from "../music/mini-player";
import { getListenAggregates, type ListenAggregate } from "../../data/db";
import { useT, useValueLabel } from "../../i18n";
import {
    libraryDistribution,
    periodStart,
    pickDecade,
    summarizeListening,
    type Bucket,
} from "../../library/stats";
import { formatListeningTime } from "../../library/track-utils";
import { usePlayerStore } from "../../store/usePlayerStore";
import { useAppTheme } from "../../theme/app-theme";

type Period = "week" | "month" | "all";

function Bars({ data, format }: { data: Bucket[]; format?: (v: number) => string }) {
    const theme = useAppTheme();
    const label = useValueLabel();
    const max = Math.max(1, ...data.map((d) => d.value));
    return (
        <View style={{ gap: 8 }}>
            {data.map((d) => (
                <View key={d.label} style={styles.barRow}>
                    <Text style={{ color: theme.text, width: 110 }} numberOfLines={1}>
                        {label(d.label)}
                    </Text>
                    <View style={[styles.track, { backgroundColor: theme.surface }]}>
                        <View
                            style={[
                                styles.fill,
                                {
                                    width: `${(d.value / max) * 100}%`,
                                    backgroundColor: theme.accent,
                                },
                            ]}
                        />
                    </View>
                    <Text
                        style={{
                            color: theme.textMuted,
                            width: 64,
                            textAlign: "right",
                            fontSize: 12,
                        }}
                    >
                        {format ? format(d.value) : d.value}
                    </Text>
                </View>
            ))}
        </View>
    );
}

/** Listening and library statistics shown as charts and rankings (REQ 61–63). */
export default function StatsScreen() {
    const t = useT();
    const theme = useAppTheme();
    const tracks = usePlayerStore((s) => s.libraryTracks);
    const [period, setPeriod] = useState<Period>("week");
    const [aggregates, setAggregates] = useState<ListenAggregate[]>([]);

    useFocusEffect(
        useCallback(() => {
            setAggregates(getListenAggregates(periodStart(period)));
        }, [period])
    );

    const summary = useMemo(() => summarizeListening(aggregates, tracks), [aggregates, tracks]);
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

    return (
        <AppScreen edges={["top"]}>
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: MINI_PLAYER_SPACE }}>
                <Text style={[styles.h1, { color: theme.text }]}>{t("stats.title")}</Text>

                <Segmented<Period>
                    value={period}
                    onChange={setPeriod}
                    options={[
                        { value: "week", label: t("stats.week") },
                        { value: "month", label: t("stats.month") },
                        { value: "all", label: t("stats.all") },
                    ]}
                />

                <View style={styles.kpis}>
                    <View style={[styles.kpi, { backgroundColor: theme.surface }]}>
                        <Text style={{ color: theme.textMuted, fontSize: 12 }}>
                            {t("stats.listeningTime")}
                        </Text>
                        <Text style={[styles.kpiValue, { color: theme.text }]}>
                            {formatListeningTime(summary.totalMs)}
                        </Text>
                    </View>
                    <View style={[styles.kpi, { backgroundColor: theme.surface }]}>
                        <Text style={{ color: theme.textMuted, fontSize: 12 }}>
                            {t("stats.listens")}
                        </Text>
                        <Text style={[styles.kpiValue, { color: theme.text }]}>
                            {summary.plays}
                        </Text>
                    </View>
                </View>

                {summary.plays === 0 ? (
                    <Text style={{ color: theme.textMuted, marginBottom: 24 }}>
                        {t("stats.noListens")}
                    </Text>
                ) : (
                    <>
                        <Section title={t("stats.topTracks")}>
                            {summary.topTracks.map((x, i) => (
                                <View key={x.track.assetId} style={styles.topRow}>
                                    <Text
                                        style={{
                                            color: theme.accent,
                                            fontWeight: "800",
                                            width: 22,
                                        }}
                                    >
                                        {i + 1}
                                    </Text>
                                    <View style={{ flex: 1 }}>
                                        <Text
                                            style={{ color: theme.text, fontWeight: "600" }}
                                            numberOfLines={1}
                                        >
                                            {x.track.title}
                                        </Text>
                                        <Text
                                            style={{ color: theme.textMuted, fontSize: 12 }}
                                            numberOfLines={1}
                                        >
                                            {x.track.artist}
                                        </Text>
                                    </View>
                                    <Text style={{ color: theme.textMuted, fontSize: 12 }}>
                                        {t("stats.plays", { n: x.plays })}
                                    </Text>
                                </View>
                            ))}
                        </Section>
                        <Section title={t("stats.topArtists")}>
                            <Bars data={summary.topArtists} format={formatListeningTime} />
                        </Section>
                        {summary.topGenres.length > 0 && (
                            <Section title={t("stats.topGenres")}>
                                <Bars data={summary.topGenres} format={formatListeningTime} />
                            </Section>
                        )}
                    </>
                )}

                <Text style={[styles.h2, { color: theme.text }]}>{t("stats.library")}</Text>
                <Section title={t("stats.libraryGenres")}>
                    <Bars data={library.genres} />
                </Section>
                <Section title={t("stats.libraryMoods")}>
                    <Bars data={library.moods} />
                </Section>
                <Section title={t("stats.libraryLanguages")}>
                    <Bars data={library.languages} />
                </Section>
                <Section title={t("stats.libraryDecades")}>
                    <Bars data={library.decades} />
                </Section>
            </ScrollView>
        </AppScreen>
    );
}

const styles = StyleSheet.create({
    h1: { fontSize: 26, fontWeight: "800", marginBottom: 16 },
    h2: { fontSize: 20, fontWeight: "800", marginVertical: 12 },
    kpis: { flexDirection: "row", gap: 10, marginVertical: 16 },
    kpi: { flex: 1, borderRadius: 14, padding: 14, gap: 4 },
    kpiValue: { fontSize: 22, fontWeight: "800" },
    barRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    track: { flex: 1, height: 10, borderRadius: 5, overflow: "hidden" },
    fill: { height: 10, borderRadius: 5 },
    topRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
});
