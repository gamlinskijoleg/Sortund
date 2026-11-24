import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { AppScreen } from "../app-screen";
import { useMusicLibrary } from "../../data/music";
import type { MusicTrack, SortDir, SortKey } from "../../data/types";
import { useT, useValueLabel } from "../../i18n";
import {
    activeFilterCount,
    applyFilters,
    collectFacets,
    emptyFilters,
    matchesQuery,
    sortTracks,
    type LibraryFilters,
} from "../../library/filters";
import { usePlayerStore } from "../../store/usePlayerStore";
import { useDebouncedValue } from "../../hooks/use-debounced-value";
import { useAppTheme } from "../../theme/app-theme";
import { TRACK_ROW_HEIGHT, TrackListItem } from "../shared/track-list-item";
import { FilterSheet } from "../library/filter-sheet";
import { AppButton, Chip, EmptyState, IconButton, Sheet } from "../ui/primitives";
import { MINI_PLAYER_SPACE } from "./mini-player";

const SORT_KEYS: SortKey[] = ["title", "artist", "year", "addedAt", "bpm"];

export function playQueue(tracks: MusicTrack[], index: number, shuffle = false) {
    if (tracks.length === 0) return;
    const store = usePlayerStore.getState();
    if (store.shuffle !== shuffle) store.toggleShuffle();
    store.setQueue(tracks, shuffle ? Math.floor(Math.random() * tracks.length) : index);
}

/** Library browser: search, filters and sorting run locally and work offline (REQ 35–37). */
export default function MusicHomeScreen() {
    useMusicLibrary();
    const theme = useAppTheme();
    const t = useT();
    const label = useValueLabel();
    const tracks = usePlayerStore((s) => s.libraryTracks);
    const isLoading = usePlayerStore((s) => s.isLibraryLoading);

    const [query, setQuery] = useState("");
    const [debouncedQuery] = useDebouncedValue(query, 200);
    const [filters, setFilters] = useState<LibraryFilters>(emptyFilters);
    const [sortKey, setSortKey] = useState<SortKey>("title");
    const [sortDir, setSortDir] = useState<SortDir>("asc");
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [sortOpen, setSortOpen] = useState(false);

    const facets = useMemo(() => collectFacets(tracks), [tracks]);
    const searched = useMemo(
        () =>
            debouncedQuery.trim() ? tracks.filter((x) => matchesQuery(x, debouncedQuery)) : tracks,
        [tracks, debouncedQuery]
    );
    const visible = useMemo(
        () => sortTracks(applyFilters(searched, filters), sortKey, sortDir),
        [searched, filters, sortKey, sortDir]
    );
    const filterCount = activeFilterCount(filters);

    const activeChips: { key: string; text: string; remove: () => void }[] = [
        ...filters.genres.map((g) => ({
            key: `g${g}`,
            text: g,
            remove: () => setFilters({ ...filters, genres: filters.genres.filter((x) => x !== g) }),
        })),
        ...filters.moods.map((m) => ({
            key: `m${m}`,
            text: label(m),
            remove: () => setFilters({ ...filters, moods: filters.moods.filter((x) => x !== m) }),
        })),
        ...filters.languages.map((l) => ({
            key: `l${l}`,
            text: label(l),
            remove: () =>
                setFilters({ ...filters, languages: filters.languages.filter((x) => x !== l) }),
        })),
        ...filters.themes.map((th) => ({
            key: `t${th}`,
            text: label(th),
            remove: () =>
                setFilters({ ...filters, themes: filters.themes.filter((x) => x !== th) }),
        })),
        ...filters.keys.map((k) => ({
            key: `k${k}`,
            text: k,
            remove: () => setFilters({ ...filters, keys: filters.keys.filter((x) => x !== k) }),
        })),
        ...(filters.yearFrom != null || filters.yearTo != null
            ? [
                  {
                      key: "year",
                      text: `${filters.yearFrom ?? "…"}–${filters.yearTo ?? "…"}`,
                      remove: () =>
                          setFilters({ ...filters, yearFrom: undefined, yearTo: undefined }),
                  },
              ]
            : []),
        ...(filters.bpmFrom != null || filters.bpmTo != null
            ? [
                  {
                      key: "bpm",
                      text: `${filters.bpmFrom ?? "…"}–${filters.bpmTo ?? "…"} BPM`,
                      remove: () =>
                          setFilters({ ...filters, bpmFrom: undefined, bpmTo: undefined }),
                  },
              ]
            : []),
    ];

    const header = (
        <View style={{ gap: 12, paddingBottom: 8 }}>
            <View style={[styles.search, { backgroundColor: theme.surface }]}>
                <MaterialCommunityIcons name="magnify" size={20} color={theme.textMuted} />
                <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder={t("home.searchPlaceholder")}
                    placeholderTextColor={theme.textPlaceholder}
                    style={[styles.searchInput, { color: theme.text }]}
                    returnKeyType="search"
                    accessibilityLabel={t("home.searchPlaceholder")}
                />
                {!!query && (
                    <IconButton
                        icon="close-circle"
                        size={18}
                        label="Clear"
                        onPress={() => setQuery("")}
                        color={theme.textSubtle}
                    />
                )}
            </View>

            <View style={styles.toolbar}>
                <AppButton
                    compact
                    variant="secondary"
                    icon="tune-variant"
                    label={
                        filterCount ? `${t("home.filters")} · ${filterCount}` : t("home.filters")
                    }
                    onPress={() => setFiltersOpen(true)}
                />
                <AppButton
                    compact
                    variant="secondary"
                    icon={sortDir === "asc" ? "sort-ascending" : "sort-descending"}
                    label={t(`sort.${sortKey}`)}
                    onPress={() => setSortOpen(true)}
                />
                <View style={{ flex: 1 }} />
                <IconButton
                    icon="shuffle-variant"
                    label={t("home.shuffle")}
                    onPress={() => playQueue(visible, 0, true)}
                />
                <IconButton
                    icon="play-circle"
                    size={30}
                    label={t("home.playAll")}
                    color={theme.accent}
                    onPress={() => playQueue(visible, 0)}
                />
            </View>

            {activeChips.length > 0 && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {activeChips.map((c) => (
                        <Chip key={c.key} label={`${c.text}  ✕`} selected onPress={c.remove} />
                    ))}
                </View>
            )}
            <Text style={{ color: theme.textSubtle, fontSize: 12 }}>
                {t("common.tracks", { n: visible.length })}
            </Text>
        </View>
    );

    return (
        <AppScreen edges={["top"]}>
            <FlatList
                data={visible}
                keyExtractor={(item) => item.assetId}
                ListHeaderComponent={
                    <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>{header}</View>
                }
                renderItem={({ item, index }) => (
                    <TrackListItem
                        track={item}
                        onPress={() => {
                            playQueue(visible, index);
                            router.push({ pathname: "/listen", params: { assetId: item.assetId } });
                        }}
                        onLongPress={() =>
                            router.push({
                                pathname: "/track/[assetId]",
                                params: { assetId: item.assetId },
                            })
                        }
                        trailingActionSlot={
                            <IconButton
                                icon="dots-vertical"
                                label={item.title}
                                color={theme.textSubtle}
                                onPress={() =>
                                    router.push({
                                        pathname: "/track/[assetId]",
                                        params: { assetId: item.assetId },
                                    })
                                }
                            />
                        }
                    />
                )}
                getItemLayout={(_, index) => ({
                    length: TRACK_ROW_HEIGHT,
                    offset: TRACK_ROW_HEIGHT * index,
                    index,
                })}
                ListEmptyComponent={
                    isLoading ? (
                        <View style={{ padding: 40, alignItems: "center", gap: 12 }}>
                            <ActivityIndicator color={theme.accent} />
                            <Text style={{ color: theme.textMuted }}>{t("home.loading")}</Text>
                        </View>
                    ) : (
                        <EmptyState
                            icon="music-off"
                            text={tracks.length ? t("home.noResults") : t("home.empty")}
                        />
                    )
                }
                contentContainerStyle={{ paddingBottom: MINI_PLAYER_SPACE }}
                keyboardShouldPersistTaps="handled"
                removeClippedSubviews
                maxToRenderPerBatch={12}
                windowSize={7}
            />

            <FilterSheet
                key={filtersOpen ? "open" : "closed"}
                visible={filtersOpen}
                facets={facets}
                value={filters}
                onClose={() => setFiltersOpen(false)}
                onApply={(f) => {
                    setFilters(f);
                    setFiltersOpen(false);
                }}
                countFor={(f) => applyFilters(searched, f).length}
            />

            <Sheet visible={sortOpen} onClose={() => setSortOpen(false)} title={t("home.sort")}>
                {SORT_KEYS.map((key) => (
                    <Pressable
                        key={key}
                        accessibilityRole="button"
                        onPress={() => {
                            if (key === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
                            else {
                                setSortKey(key);
                                setSortDir(key === "addedAt" ? "desc" : "asc");
                            }
                            setSortOpen(false);
                        }}
                        style={[styles.sortRow, { borderBottomColor: theme.border }]}
                    >
                        <Text
                            style={{
                                color: theme.text,
                                fontSize: 16,
                                flex: 1,
                                fontWeight: key === sortKey ? "700" : "400",
                            }}
                        >
                            {t(`sort.${key}`)}
                        </Text>
                        {key === sortKey && (
                            <Text style={{ color: theme.accent }}>
                                {t(sortDir === "asc" ? "sort.asc" : "sort.desc")}
                            </Text>
                        )}
                    </Pressable>
                ))}
            </Sheet>
        </AppScreen>
    );
}

const styles = StyleSheet.create({
    search: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 14,
        paddingHorizontal: 12,
        height: 46,
        gap: 8,
    },
    searchInput: { flex: 1, fontSize: 15, height: 46 },
    toolbar: { flexDirection: "row", alignItems: "center", gap: 8 },
    sortRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
});
