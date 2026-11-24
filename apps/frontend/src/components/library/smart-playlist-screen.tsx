import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "../app-screen";
import { PageHeader } from "../shared/page-header";
import { AppButton, Chip, Field, IconButton, Section, Segmented } from "../ui/primitives";
import type {
    SmartCondition,
    SmartField,
    SmartOp,
    SmartRules,
    SortDir,
    SortKey,
} from "../../data/types";
import { useT, useValueLabel, type TranslationKey } from "../../i18n";
import { collectFacets } from "../../library/filters";
import { emptyRules, evaluateSmartPlaylist } from "../../library/smart";
import { usePlaylistStore } from "../../store/usePlaylistStore";
import { usePlayerStore } from "../../store/usePlayerStore";
import { useAppTheme } from "../../theme/app-theme";

const FIELDS: SmartField[] = [
    "genre",
    "mood",
    "language",
    "theme",
    "year",
    "bpm",
    "key",
    "tag",
    "artist",
    "favourite",
];
const NUMERIC: SmartField[] = ["year", "bpm"];
const SORT_KEYS: SortKey[] = ["title", "artist", "year", "addedAt", "bpm"];

function opsFor(field: SmartField): SmartOp[] {
    if (NUMERIC.includes(field)) return ["is", "gte", "lte", "between"];
    if (field === "favourite") return ["is"];
    return ["is", "isNot", "contains"];
}

function ConditionEditor({
    condition,
    suggestions,
    onChange,
    onRemove,
}: {
    condition: SmartCondition;
    suggestions: string[];
    onChange: (c: SmartCondition) => void;
    onRemove: () => void;
}) {
    const t = useT();
    const label = useValueLabel();
    const theme = useAppTheme();
    const numeric = NUMERIC.includes(condition.field);

    return (
        <View style={[styles.condition, { borderColor: theme.border }]}>
            <View style={styles.wrap}>
                {FIELDS.map((f) => (
                    <Chip
                        key={f}
                        label={t(`smart.field.${f}` as TranslationKey)}
                        selected={condition.field === f}
                        onPress={() =>
                            onChange({
                                field: f,
                                op: opsFor(f)[0]!,
                                value: f === "favourite" ? true : NUMERIC.includes(f) ? 0 : "",
                            })
                        }
                    />
                ))}
            </View>
            <View style={styles.wrap}>
                {opsFor(condition.field).map((op) => (
                    <Chip
                        key={op}
                        label={t(`smart.op.${op}` as TranslationKey)}
                        selected={condition.op === op}
                        onPress={() => onChange({ ...condition, op })}
                    />
                ))}
            </View>

            {condition.field === "favourite" ? (
                <Segmented
                    value={condition.value === true ? "yes" : "no"}
                    onChange={(v) => onChange({ ...condition, value: v === "yes" })}
                    options={[
                        { value: "yes", label: t("smart.yes") },
                        { value: "no", label: t("smart.no") },
                    ]}
                />
            ) : numeric ? (
                <View style={{ flexDirection: "row", gap: 8 }}>
                    <View style={{ flex: 1 }}>
                        <Field
                            keyboardType="number-pad"
                            value={condition.value ? String(condition.value) : ""}
                            onChangeText={(v) => onChange({ ...condition, value: Number(v) || 0 })}
                            placeholder={t("smart.value")}
                        />
                    </View>
                    {condition.op === "between" && (
                        <View style={{ flex: 1 }}>
                            <Field
                                keyboardType="number-pad"
                                value={condition.value2 ? String(condition.value2) : ""}
                                onChangeText={(v) =>
                                    onChange({ ...condition, value2: Number(v) || 0 })
                                }
                                placeholder={t("smart.value")}
                            />
                        </View>
                    )}
                </View>
            ) : (
                <>
                    <Field
                        value={String(condition.value)}
                        onChangeText={(v) => onChange({ ...condition, value: v })}
                        placeholder={t("smart.value")}
                        autoCapitalize="none"
                    />
                    {suggestions.length > 0 && (
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ gap: 6 }}
                        >
                            {suggestions.slice(0, 20).map((s) => (
                                <Chip
                                    key={s}
                                    label={label(s)}
                                    selected={condition.value === s}
                                    onPress={() => onChange({ ...condition, value: s })}
                                />
                            ))}
                        </ScrollView>
                    )}
                </>
            )}
            <View style={{ alignItems: "flex-end" }}>
                <IconButton
                    icon="delete-outline"
                    label={t("common.remove")}
                    onPress={onRemove}
                    color={theme.danger}
                />
            </View>
        </View>
    );
}

/** Creates or edits a smart playlist defined by conditions (REQ 51–54). */
export default function SmartPlaylistScreen() {
    const { id } = useLocalSearchParams<{ id?: string }>();
    const t = useT();
    const theme = useAppTheme();
    const library = usePlayerStore((s) => s.libraryTracks);
    const existing = usePlaylistStore((s) =>
        id ? s.playlists.find((p) => p.id === id) : undefined
    );

    const [name, setName] = useState(existing?.name ?? "");
    const [rules, setRules] = useState<SmartRules>(existing?.rules ?? emptyRules());
    const [sortBy, setSortBy] = useState<SortKey>(existing?.sortBy ?? "title");
    const [sortDir, setSortDir] = useState<SortDir>(existing?.sortDir ?? "asc");
    const [limit, setLimit] = useState(existing?.limitCount ? String(existing.limitCount) : "");

    const facets = useMemo(() => collectFacets(library), [library]);
    const suggestionsFor = (field: SmartField): string[] => {
        switch (field) {
            case "genre":
                return facets.genres.map((f) => f.value);
            case "mood":
                return facets.moods.map((f) => f.value);
            case "language":
                return facets.languages.map((f) => f.value);
            case "theme":
                return facets.themes.map((f) => f.value);
            case "key":
                return facets.keys.map((f) => f.value);
            case "tag":
                return [...new Set(library.flatMap((x) => x.tags ?? []))];
            case "artist":
                return [...new Set(library.map((x) => x.artist))];
            default:
                return [];
        }
    };

    const limitCount = limit.trim() ? Math.max(1, Number(limit) || 0) : undefined;
    const preview = useMemo(
        () => evaluateSmartPlaylist(library, rules, { sortBy, sortDir, limit: limitCount }).length,
        [library, rules, sortBy, sortDir, limitCount]
    );

    const updateCondition = (g: number, c: number, next: SmartCondition | null) => {
        const groups = rules.groups.map((group, gi) => {
            if (gi !== g) return group;
            const conditions =
                next === null
                    ? group.conditions.filter((_, ci) => ci !== c)
                    : group.conditions.map((x, ci) => (ci === c ? next : x));
            return { ...group, conditions };
        });
        setRules({ ...rules, groups: groups.filter((group) => group.conditions.length > 0) });
    };

    const save = () => {
        const store = usePlaylistStore.getState();
        const options = { sortBy, sortDir, limitCount };
        if (existing) store.update(existing.id, { name: name.trim(), rules, ...options });
        else {
            const created = store.createSmart(name, rules, options);
            router.replace({ pathname: "/playlist/[id]", params: { id: created.id } });
            return;
        }
        router.back();
    };

    return (
        <AppScreen>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <ScrollView
                    contentContainerStyle={{ padding: 16, paddingBottom: 80, gap: 12 }}
                    keyboardShouldPersistTaps="handled"
                >
                    <PageHeader title={t("smart.header")} />
                    <Field label={t("playlist.name")} value={name} onChangeText={setName} />

                    <Section title={t("smart.match")}>
                        <Segmented
                            value={rules.match}
                            onChange={(match) => setRules({ ...rules, match })}
                            options={[
                                { value: "all", label: t("smart.all") },
                                { value: "any", label: t("smart.any") },
                            ]}
                        />
                    </Section>

                    {rules.groups.map((group, gi) => (
                        <View key={gi} style={[styles.group, { backgroundColor: theme.surface }]}>
                            <Text style={{ color: theme.textMuted, fontWeight: "600" }}>
                                {t("smart.groupMatch")}
                            </Text>
                            <Segmented
                                value={group.match}
                                onChange={(match) =>
                                    setRules({
                                        ...rules,
                                        groups: rules.groups.map((x, i) =>
                                            i === gi ? { ...x, match } : x
                                        ),
                                    })
                                }
                                options={[
                                    { value: "all", label: t("smart.all") },
                                    { value: "any", label: t("smart.any") },
                                ]}
                            />
                            {group.conditions.map((c, ci) => (
                                <ConditionEditor
                                    key={ci}
                                    condition={c}
                                    suggestions={suggestionsFor(c.field)}
                                    onChange={(next) => updateCondition(gi, ci, next)}
                                    onRemove={() => updateCondition(gi, ci, null)}
                                />
                            ))}
                            <AppButton
                                compact
                                variant="ghost"
                                icon="plus"
                                label={t("smart.addCondition")}
                                onPress={() =>
                                    setRules({
                                        ...rules,
                                        groups: rules.groups.map((x, i) =>
                                            i === gi
                                                ? {
                                                      ...x,
                                                      conditions: [
                                                          ...x.conditions,
                                                          { field: "genre", op: "is", value: "" },
                                                      ],
                                                  }
                                                : x
                                        ),
                                    })
                                }
                            />
                        </View>
                    ))}
                    <AppButton
                        variant="secondary"
                        icon="plus-box-multiple-outline"
                        label={t("smart.addGroup")}
                        onPress={() =>
                            setRules({
                                ...rules,
                                groups: [
                                    ...rules.groups,
                                    {
                                        match: "all",
                                        conditions: [{ field: "mood", op: "is", value: "" }],
                                    },
                                ],
                            })
                        }
                    />

                    <Section title={t("smart.sort")}>
                        <View style={styles.wrap}>
                            {SORT_KEYS.map((k) => (
                                <Chip
                                    key={k}
                                    label={t(`sort.${k}`)}
                                    selected={sortBy === k}
                                    onPress={() => setSortBy(k)}
                                />
                            ))}
                        </View>
                        <Segmented
                            value={sortDir}
                            onChange={setSortDir}
                            options={[
                                { value: "asc", label: t("sort.asc") },
                                { value: "desc", label: t("sort.desc") },
                            ]}
                        />
                    </Section>
                    <Field
                        label={t("smart.limit")}
                        keyboardType="number-pad"
                        value={limit}
                        onChangeText={setLimit}
                    />

                    <Text style={{ color: theme.textMuted, textAlign: "center" }}>
                        {t("smart.preview", { n: preview })}
                    </Text>
                    <AppButton
                        icon="check"
                        label={t("common.save")}
                        disabled={!name.trim() || rules.groups.length === 0}
                        onPress={save}
                    />
                </ScrollView>
            </KeyboardAvoidingView>
        </AppScreen>
    );
}

const styles = StyleSheet.create({
    wrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    group: { borderRadius: 16, padding: 12, gap: 10 },
    condition: { borderWidth: 1, borderRadius: 12, padding: 10, gap: 8 },
});
