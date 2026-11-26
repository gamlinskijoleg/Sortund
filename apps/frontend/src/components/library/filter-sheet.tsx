import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { SortDir, SortKey } from "../../data/types";
import { useT, useValueLabel } from "../../i18n";
import {
    activeFilterCount,
    emptyFilters,
    type Facet,
    type Facets,
    type LibraryFilters,
} from "../../library/filters";
import { useAppTheme } from "../../theme/app-theme";
import { AppButton, Chip, Sheet } from "../ui/primitives";

export const SORT_KEYS: SortKey[] = ["title", "artist", "year", "addedAt", "bpm"];

function Group({
    title,
    hint,
    children,
    right,
}: {
    title: string;
    hint?: string;
    children: React.ReactNode;
    right?: React.ReactNode;
}) {
    const theme = useAppTheme();
    return (
        <View style={styles.group}>
            <View style={styles.groupHead}>
                <Text style={[styles.groupTitle, { color: theme.text }]}>{title}</Text>
                {right ??
                    (hint ? (
                        <Text style={{ color: theme.textSubtle, fontSize: 12 }}>{hint}</Text>
                    ) : null)}
            </View>
            {children}
        </View>
    );
}

function ChipGroup({
    title,
    facets,
    selected,
    onChange,
    translate,
}: {
    title: string;
    facets: Facet[];
    selected: string[];
    onChange: (values: string[]) => void;
    translate?: (v: string) => string;
}) {
    const t = useT();
    if (facets.length === 0) return null;
    return (
        <Group
            title={title}
            hint={
                selected.length ? t("filters.selected", { n: selected.length }) : t("filters.any")
            }
        >
            <View style={styles.wrap}>
                {facets.map((f) => {
                    const active = selected.includes(f.value);
                    return (
                        <Chip
                            key={f.value}
                            label={translate ? translate(f.value) : f.value}
                            selected={active}
                            onPress={() =>
                                onChange(
                                    active
                                        ? selected.filter((s) => s !== f.value)
                                        : [...selected, f.value]
                                )
                            }
                        />
                    );
                })}
            </View>
        </Group>
    );
}

function RangeInputs({
    title,
    from,
    to,
    placeholder,
    onChange,
}: {
    title: string;
    from?: number;
    to?: number;
    placeholder: { min?: number; max?: number };
    onChange: (from?: number, to?: number) => void;
}) {
    const t = useT();
    const theme = useAppTheme();
    const parse = (v: string) =>
        v.trim() === "" || Number.isNaN(Number(v)) ? undefined : Number(v);
    const input = (
        value: number | undefined,
        ph: number | undefined,
        label: string,
        set: (v: string) => void
    ) => (
        <TextInput
            accessibilityLabel={`${title}, ${label}`}
            keyboardType="number-pad"
            placeholder={ph ? String(ph) : label}
            placeholderTextColor={theme.textPlaceholder}
            value={value === undefined ? "" : String(value)}
            onChangeText={set}
            style={[
                styles.rangeInput,
                { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border },
            ]}
        />
    );
    return (
        <Group title={title}>
            <View style={styles.range}>
                {input(from, placeholder.min, t("filters.from"), (v) => onChange(parse(v), to))}
                <Text style={{ color: theme.textSubtle, fontSize: 14 }}>{t("filters.to")}</Text>
                {input(to, placeholder.max, t("filters.to"), (v) => onChange(from, parse(v)))}
            </View>
        </Group>
    );
}

/** Filters (REQ 36) and sorting (REQ 37) in one sheet; several filters can be combined. */
export function FilterSheet({
    visible,
    facets,
    value,
    onApply,
    onClose,
    countFor,
    sortKey,
    sortDir,
    onSortChange,
}: {
    visible: boolean;
    facets: Facets;
    value: LibraryFilters;
    onApply: (filters: LibraryFilters) => void;
    onClose: () => void;
    countFor: (filters: LibraryFilters) => number;
    sortKey: SortKey;
    sortDir: SortDir;
    onSortChange: (key: SortKey, dir: SortDir) => void;
}) {
    const t = useT();
    const label = useValueLabel();
    const theme = useAppTheme();
    // The parent remounts the sheet (key) on every opening, so the draft starts from `value`.
    const [draft, setDraft] = useState<LibraryFilters>(value);

    const hasFacets =
        facets.genres.length +
            facets.moods.length +
            facets.languages.length +
            facets.themes.length >
        0;

    return (
        <Sheet
            visible={visible}
            onClose={onClose}
            title={t("filters.title")}
            footer={
                <View style={{ flexDirection: "row", gap: 10 }}>
                    <AppButton
                        label={t("common.reset")}
                        variant="secondary"
                        disabled={activeFilterCount(draft) === 0}
                        onPress={() => setDraft(emptyFilters)}
                    />
                    <AppButton
                        label={t("filters.show", { n: countFor(draft) })}
                        onPress={() => onApply(draft)}
                        style={{ flex: 1 }}
                    />
                </View>
            }
        >
            <Group
                title={t("home.sort")}
                right={
                    <Pressable
                        accessibilityRole="button"
                        onPress={() => onSortChange(sortKey, sortDir === "asc" ? "desc" : "asc")}
                        hitSlop={10}
                    >
                        <Text style={{ color: theme.textMuted, fontSize: 13, fontWeight: "600" }}>
                            {t(sortDir === "asc" ? "sort.asc" : "sort.desc")}
                        </Text>
                    </Pressable>
                }
            >
                <View style={styles.wrap}>
                    {SORT_KEYS.map((key) => (
                        <Chip
                            key={key}
                            label={t(`sort.${key}`)}
                            selected={key === sortKey}
                            onPress={() =>
                                onSortChange(
                                    key,
                                    key === sortKey ? sortDir : key === "addedAt" ? "desc" : "asc"
                                )
                            }
                        />
                    ))}
                </View>
            </Group>

            {!hasFacets && (
                <Text style={{ color: theme.textMuted, marginTop: 18, paddingHorizontal: 4 }}>
                    {t("filters.none")}
                </Text>
            )}
            <ChipGroup
                title={t("filters.genre")}
                facets={facets.genres}
                selected={draft.genres}
                onChange={(genres) => setDraft({ ...draft, genres })}
            />
            <ChipGroup
                title={t("filters.mood")}
                facets={facets.moods}
                selected={draft.moods}
                translate={label}
                onChange={(moods) => setDraft({ ...draft, moods })}
            />
            <ChipGroup
                title={t("filters.language")}
                facets={facets.languages}
                selected={draft.languages}
                translate={label}
                onChange={(languages) => setDraft({ ...draft, languages })}
            />
            <ChipGroup
                title={t("filters.theme")}
                facets={facets.themes}
                selected={draft.themes}
                translate={label}
                onChange={(themes) => setDraft({ ...draft, themes })}
            />
            <ChipGroup
                title={t("filters.key")}
                facets={facets.keys}
                selected={draft.keys}
                onChange={(keys) => setDraft({ ...draft, keys })}
            />
            <RangeInputs
                title={t("filters.year")}
                from={draft.yearFrom}
                to={draft.yearTo}
                placeholder={facets.years}
                onChange={(yearFrom, yearTo) => setDraft({ ...draft, yearFrom, yearTo })}
            />
            <RangeInputs
                title={t("filters.bpm")}
                from={draft.bpmFrom}
                to={draft.bpmTo}
                placeholder={facets.bpm}
                onChange={(bpmFrom, bpmTo) => setDraft({ ...draft, bpmFrom, bpmTo })}
            />
        </Sheet>
    );
}

const styles = StyleSheet.create({
    group: { paddingTop: 18, paddingHorizontal: 4 },
    groupHead: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 10,
    },
    groupTitle: { fontSize: 15, fontWeight: "600" },
    wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    range: { flexDirection: "row", alignItems: "center", gap: 10 },
    rangeInput: {
        flex: 1,
        height: 44,
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 12,
        fontSize: 15,
    },
});
