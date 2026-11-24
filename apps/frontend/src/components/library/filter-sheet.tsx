import React, { useState } from "react";
import { Text, View } from "react-native";
import { useT, useValueLabel } from "../../i18n";
import {
    activeFilterCount,
    emptyFilters,
    type Facet,
    type Facets,
    type LibraryFilters,
} from "../../library/filters";
import { useAppTheme } from "../../theme/app-theme";
import { AppButton, Chip, Field, Section, Sheet } from "../ui/primitives";

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
    if (facets.length === 0) return null;
    return (
        <Section title={title}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {facets.map((f) => {
                    const active = selected.includes(f.value);
                    return (
                        <Chip
                            key={f.value}
                            label={`${translate ? translate(f.value) : f.value} · ${f.count}`}
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
        </Section>
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
    const parse = (v: string) =>
        v.trim() === "" || Number.isNaN(Number(v)) ? undefined : Number(v);
    return (
        <Section title={title}>
            <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                    <Field
                        label={t("filters.from")}
                        keyboardType="number-pad"
                        placeholder={placeholder.min ? String(placeholder.min) : ""}
                        value={from === undefined ? "" : String(from)}
                        onChangeText={(v) => onChange(parse(v), to)}
                    />
                </View>
                <View style={{ flex: 1 }}>
                    <Field
                        label={t("filters.to")}
                        keyboardType="number-pad"
                        placeholder={placeholder.max ? String(placeholder.max) : ""}
                        value={to === undefined ? "" : String(to)}
                        onChangeText={(v) => onChange(from, parse(v))}
                    />
                </View>
            </View>
        </Section>
    );
}

/** Filter panel (REQ 36): several filters can be combined. */
export function FilterSheet({
    visible,
    facets,
    value,
    onApply,
    onClose,
    countFor,
}: {
    visible: boolean;
    facets: Facets;
    value: LibraryFilters;
    onApply: (filters: LibraryFilters) => void;
    onClose: () => void;
    countFor: (filters: LibraryFilters) => number;
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
                        label={t("filters.clear")}
                        variant="secondary"
                        disabled={activeFilterCount(draft) === 0}
                        onPress={() => setDraft(emptyFilters)}
                        style={{ flex: 1 }}
                    />
                    <AppButton
                        label={t("filters.show", { n: countFor(draft) })}
                        onPress={() => onApply(draft)}
                        style={{ flex: 2 }}
                    />
                </View>
            }
        >
            {!hasFacets && (
                <Text style={{ color: theme.textMuted, marginBottom: 16 }}>
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
