import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
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
import { useAuthStore } from "../../store/useAuthStore";
import { usePlayerStore } from "../../store/usePlayerStore";
import { useDebouncedValue } from "../../hooks/use-debounced-value";
import { useAppTheme } from "../../theme/app-theme";
import { TRACK_ROW_HEIGHT, TrackListItem } from "../shared/track-list-item";
import { FilterSheet } from "../library/filter-sheet";
import {
    AppButton,
    Chip,
    CountBadge,
    EmptyState,
    IconButton,
    ProfileButton,
    ScreenTitle,
} from "../ui/primitives";
import { MINI_PLAYER_SPACE } from "./mini-player";

export function playQueue(tracks: MusicTrack[], index: number, shuffle = false) {
    if (tracks.length === 0) return;
    const store = usePlayerStore.getState();
    if (store.shuffle !== shuffle) store.toggleShuffle();
    store.setQueue(tracks, shuffle ? Math.floor(Math.random() * tracks.length) : index);
}

export function openTrack(assetId: string) {
    router.push({ pathname: "/track/[assetId]", params: { assetId } });
}

/** Library browser: search, filters and sorting run locally and work offline (REQ 35–37). */
export default function MusicHomeScreen() {
    useMusicLibrary();
    const theme = useAppTheme();
    const t = useT();
    const label = useValueLabel();
    const tracks = usePlayerStore((s) => s.libraryTracks);
    const isLoading = usePlayerStore((s) => s.isLibraryLoading);
    const email = useAuthStore((s) => s.user?.email);

    const [query, setQuery] = useState("");
    const [debouncedQuery] = useDebouncedValue(query, 200);
    const [filters, setFilters] = useState<LibraryFilters>(emptyFilters);
    const [sortKey, setSortKey] = useState<SortKey>("title");
    const [sortDir, setSortDir] = useState<SortDir>("asc");
    const [filtersOpen, setFiltersOpen] = useState(false);

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

    const without = <K extends keyof LibraryFilters>(key: K, value: string) =>
        setFilters({
            ...filters,
            [key]: (filters[key] as string[]).filter((x) => x !== value),
        });
    const range = (from?: number, to?: number, suffix = "") =>
        from != null && to != null
            ? `${from} ${t("filters.to")} ${to}${suffix}`
            : from != null
              ? `${t("filters.from")} ${from}${suffix}`
              : `${t("filters.to")} ${to}${suffix}`;

    const activeChips: { key: string; text: string; remove: () => void }[] = [
        ...filters.genres.map((g) => ({
            key: `g${g}`,
            text: g,
            remove: () => without("genres", g),
        })),
        ...filters.moods.map((m) => ({
            key: `m${m}`,
            text: label(m),
            remove: () => without("moods", m),
        })),
        ...filters.languages.map((l) => ({
            key: `l${l}`,
            text: label(l),
            remove: () => without("languages", l),
        })),
        ...filters.themes.map((th) => ({
            key: `t${th}`,
            text: label(th),
            remove: () => without("themes", th),
        })),
        ...filters.keys.map((k) => ({ key: `k${k}`, text: k, remove: () => without("keys", k) })),
        ...(filters.yearFrom != null || filters.yearTo != null
            ? [
                  {
                      key: "year",
                      text: range(filters.yearFrom, filters.yearTo),
                      remove: () =>
                          setFilters({ ...filters, yearFrom: undefined, yearTo: undefined }),
                  },
              ]
            : []),
        ...(filters.bpmFrom != null || filters.bpmTo != null
            ? [
                  {
                      key: "bpm",
                      text: range(filters.bpmFrom, filters.bpmTo, " BPM"),
                      remove: () =>
                          setFilters({ ...filters, bpmFrom: undefined, bpmTo: undefined }),
                  },
              ]
            : []),
    ];

    const header = (
        <View style={{ paddingHorizontal: 16, gap: 14, paddingBottom: 8 }}>
            <ScreenTitle title={t("nav.music")} right={<ProfileButton email={email} />} />

            <View style={[styles.search, { backgroundColor: theme.surface }]}>
                <MaterialCommunityIcons name="magnify" size={20} color={theme.textSubtle} />
                <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder={t("home.searchPlaceholder")}
                    placeholderTextColor={theme.textPlaceholder}
                    style={[styles.searchInput, { color: theme.text }]}
                    returnKeyType="search"
                    accessibilityLabel={t("home.search")}
                />
                {!!query && (
                    <IconButton
                        icon="close-circle"
                        size={18}
                        label={t("common.clear")}
                        onPress={() => setQuery("")}
                        color={theme.textSubtle}
                        style={{ width: 36, height: 36 }}
                    />
                )}
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
                horizontal
                style={{ marginHorizontal: -16 }}
                contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
            >
                <Pressable
                    accessibilityRole="button"
                    onPress={() => setFiltersOpen(true)}
                    style={({ pressed }) => [
                        styles.filterChip,
                        { backgroundColor: filterCount ? theme.accent : theme.surfaceStrong },
                        pressed && { transform: [{ scale: 0.96 }] },
                    ]}
                >
                    <MaterialCommunityIcons
                        name="tune-variant"
                        size={16}
                        color={filterCount ? theme.inverseText : theme.text}
                    />
                    <Text
                        style={{
                            color: filterCount ? theme.inverseText : theme.text,
                            fontWeight: "600",
                            fontSize: 14,
                        }}
                    >
                        {t("home.filters")}
                    </Text>
                    {filterCount > 0 && <CountBadge n={filterCount} inverse />}
                </Pressable>
                {activeChips.map((c) => (
                    <Chip key={c.key} label={c.text} onRemove={c.remove} />
                ))}
                <Chip
                    label={t(`sort.${sortKey}`)}
                    icon={sortDir === "asc" ? "sort-ascending" : "sort-descending"}
                    tone="muted"
                    onPress={() => setFiltersOpen(true)}
                />
            </ScrollView>

            <View style={styles.actions}>
                <AppButton
                    compact
                    variant="secondary"
                    icon="shuffle-variant"
                    label={t("home.shuffle")}
                    disabled={!visible.length}
                    onPress={() => playQueue(visible, 0, true)}
                    style={{ flex: 1 }}
                />
                <AppButton
                    compact
                    icon="play"
                    label={t("home.playAll")}
                    disabled={!visible.length}
                    onPress={() => playQueue(visible, 0)}
                    style={{ flex: 1 }}
                />
            </View>
        </View>
    );

    return (
        <AppScreen edges={["top"]}>
            <FlatList
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
                data={visible}
                keyExtractor={(item) => item.assetId}
                ListHeaderComponent={header}
                renderItem={({ item, index }) => (
                    <TrackListItem
                        track={item}
                        onPress={() => {
                            playQueue(visible, index);
                            router.push({ pathname: "/listen", params: { assetId: item.assetId } });
                        }}
                        onLongPress={() => openTrack(item.assetId)}
                        onMore={() => openTrack(item.assetId)}
                    />
                )}
                getItemLayout={(_, index) => ({
                    length: TRACK_ROW_HEIGHT,
                    offset: TRACK_ROW_HEIGHT * index,
                    index,
                })}
                ListEmptyComponent={
                    isLoading ? (
                        <View style={{ padding: 48, alignItems: "center", gap: 14 }}>
                            <ActivityIndicator color={theme.text} />
                            <Text style={{ color: theme.textMuted }}>{t("home.loading")}</Text>
                        </View>
                    ) : (
                        <EmptyState
                            icon={tracks.length ? "magnify" : "music-off"}
                            text={tracks.length ? t("home.noResults") : t("home.empty")}
                        />
                    )
                }
                contentContainerStyle={{ paddingBottom: MINI_PLAYER_SPACE }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
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
                sortKey={sortKey}
                sortDir={sortDir}
                onSortChange={(key, dir) => {
                    setSortKey(key);
                    setSortDir(dir);
                }}
            />
        </AppScreen>
    );
}

const styles = StyleSheet.create({
    search: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 12,
        paddingLeft: 14,
        paddingRight: 4,
        height: 46,
        gap: 10,
    },
    searchInput: { flex: 1, fontSize: 15, height: 46 },
    filterChip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        height: 34,
        borderRadius: 17,
        paddingHorizontal: 13,
    },
    actions: { flexDirection: "row", gap: 8 },
});
