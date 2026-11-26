import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { AppScreen } from "../app-screen";
import {
    AppButton,
    Card,
    Chip,
    Field,
    ListRow,
    SectionLabel,
    Segmented,
    Sheet,
} from "../ui/primitives";
import { SORT_KEYS } from "./filter-sheet";
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

function opsFor(field: SmartField): SmartOp[] {
    if (NUMERIC.includes(field)) return ["is", "gte", "lte", "between"];
    if (field === "favourite") return ["is"];
    return ["is", "isNot", "contains"];
}

function useConditionText() {
    const t = useT();
    const label = useValueLabel();
    return (c: SmartCondition) => {
        if (c.field === "favourite") return t(c.value === true ? "smart.yes" : "smart.no");
        const value = NUMERIC.includes(c.field) ? String(c.value || "") : label(String(c.value));
        if (!value) return t("smart.noValue");
        if (c.op === "between") return t("smart.between", { a: value, b: c.value2 ?? "" });
        return `${t(`smart.op.${c.op}` as TranslationKey)} ${value}`;
    };
}

/** Editor for one condition, opened from its row. */
function ConditionSheet({
    condition,
    suggestions,
    onSave,
    onRemove,
    onClose,
}: {
    condition: SmartCondition | null;
    suggestions: (field: SmartField) => string[];
    onSave: (c: SmartCondition) => void;
    onRemove: () => void;
    onClose: () => void;
}) {
    const t = useT();
    const label = useValueLabel();
    const [draft, setDraft] = useState<SmartCondition | null>(condition);
    if (!condition || !draft) return null;
    const numeric = NUMERIC.includes(draft.field);
    const options = suggestions(draft.field);

    return (
        <Sheet
            visible
            onClose={onClose}
            title={t(`smart.field.${draft.field}` as TranslationKey)}
            footer={
                <View style={{ flexDirection: "row", gap: 10 }}>
                    <AppButton
                        variant="secondary"
                        icon="delete-outline"
                        label={t("common.delete")}
                        onPress={onRemove}
                    />
                    <AppButton
                        label={t("common.done")}
                        onPress={() => onSave(draft)}
                        style={{ flex: 1 }}
                    />
                </View>
            }
        >
            <View style={{ gap: 18, paddingHorizontal: 4 }}>
                <View style={{ gap: 10 }}>
                    <SectionLabel>{t("smart.what")}</SectionLabel>
                    <View style={styles.wrap}>
                        {FIELDS.map((f) => (
                            <Chip
                                key={f}
                                label={t(`smart.field.${f}` as TranslationKey)}
                                selected={draft.field === f}
                                onPress={() =>
                                    f !== draft.field &&
                                    setDraft({
                                        field: f,
                                        op: opsFor(f)[0]!,
                                        value:
                                            f === "favourite" ? true : NUMERIC.includes(f) ? 0 : "",
                                    })
                                }
                            />
                        ))}
                    </View>
                </View>
                {opsFor(draft.field).length > 1 && (
                    <View style={styles.wrap}>
                        {opsFor(draft.field).map((op) => (
                            <Chip
                                key={op}
                                label={t(`smart.op.${op}` as TranslationKey)}
                                selected={draft.op === op}
                                tone="muted"
                                onPress={() => setDraft({ ...draft, op })}
                            />
                        ))}
                    </View>
                )}

                {draft.field === "favourite" ? (
                    <Segmented
                        value={draft.value === true ? "yes" : "no"}
                        onChange={(v) => setDraft({ ...draft, value: v === "yes" })}
                        options={[
                            { value: "yes", label: t("smart.yes") },
                            { value: "no", label: t("smart.no") },
                        ]}
                    />
                ) : numeric ? (
                    <View style={{ flexDirection: "row", gap: 10 }}>
                        <View style={{ flex: 1 }}>
                            <Field
                                keyboardType="number-pad"
                                value={draft.value ? String(draft.value) : ""}
                                onChangeText={(v) => setDraft({ ...draft, value: Number(v) || 0 })}
                                placeholder={t("smart.value")}
                            />
                        </View>
                        {draft.op === "between" && (
                            <View style={{ flex: 1 }}>
                                <Field
                                    keyboardType="number-pad"
                                    value={draft.value2 ? String(draft.value2) : ""}
                                    onChangeText={(v) =>
                                        setDraft({ ...draft, value2: Number(v) || 0 })
                                    }
                                    placeholder={t("filters.to")}
                                />
                            </View>
                        )}
                    </View>
                ) : (
                    <View style={{ gap: 10 }}>
                        <Field
                            value={String(draft.value)}
                            onChangeText={(v) => setDraft({ ...draft, value: v })}
                            placeholder={t("smart.value")}
                            autoCapitalize="none"
                        />
                        {options.length > 0 && (
                            <View style={styles.wrap}>
                                {options.slice(0, 24).map((s) => (
                                    <Chip
                                        key={s}
                                        label={label(s)}
                                        selected={draft.value === s}
                                        onPress={() => setDraft({ ...draft, value: s })}
                                    />
                                ))}
                            </View>
                        )}
                    </View>
                )}
            </View>
        </Sheet>
    );
}

/** Creates or edits a smart playlist defined by conditions (REQ 51–54). */
export default function SmartPlaylistScreen() {
    const { id } = useLocalSearchParams<{ id?: string }>();
    const t = useT();
    const theme = useAppTheme();
    const conditionText = useConditionText();
    const library = usePlayerStore((s) => s.libraryTracks);
    const existing = usePlaylistStore((s) =>
        id ? s.playlists.find((p) => p.id === id) : undefined
    );

    const [name, setName] = useState(existing?.name ?? "");
    const [rules, setRules] = useState<SmartRules>(existing?.rules ?? emptyRules());
    const [sortBy, setSortBy] = useState<SortKey>(existing?.sortBy ?? "title");
    const [sortDir, setSortDir] = useState<SortDir>(existing?.sortDir ?? "asc");
    const [limit, setLimit] = useState(existing?.limitCount ? String(existing.limitCount) : "");
    const [editing, setEditing] = useState<{ g: number; c: number } | null>(null);
    const [sortOpen, setSortOpen] = useState(false);

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

    const setGroup = (g: number, conditions: SmartCondition[], match?: "all" | "any") =>
        setRules({
            ...rules,
            groups: rules.groups
                .map((group, gi) =>
                    gi === g ? { match: match ?? group.match, conditions } : group
                )
                .filter((group) => group.conditions.length > 0),
        });

    const addCondition = (g: number) => {
        const groups =
            g < rules.groups.length
                ? rules.groups.map((x, i) =>
                      i === g
                          ? {
                                ...x,
                                conditions: [
                                    ...x.conditions,
                                    { field: "genre" as const, op: "is" as const, value: "" },
                                ],
                            }
                          : x
                  )
                : [
                      ...rules.groups,
                      {
                          match: "all" as const,
                          conditions: [{ field: "genre" as const, op: "is" as const, value: "" }],
                      },
                  ];
        setRules({ ...rules, groups });
        const target = groups[g]!;
        setEditing({ g, c: target.conditions.length - 1 });
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
    const canSave = !!name.trim() && rules.groups.length > 0;
    const matchOptions = [
        { value: "all" as const, label: t("smart.all") },
        { value: "any" as const, label: t("smart.any") },
    ];
    const editingCondition = editing
        ? (rules.groups[editing.g]?.conditions[editing.c] ?? null)
        : null;

    return (
        <AppScreen>
            <View style={styles.bar}>
                <Pressable
                    accessibilityRole="button"
                    onPress={() => router.back()}
                    hitSlop={8}
                    style={styles.barBtn}
                >
                    <Text style={{ color: theme.textMuted, fontSize: 16 }}>
                        {t("common.cancel")}
                    </Text>
                </Pressable>
                <Text
                    accessibilityRole="header"
                    style={{ color: theme.text, fontSize: 17, fontWeight: "600" }}
                >
                    {t("smart.header")}
                </Text>
                <Pressable
                    accessibilityRole="button"
                    onPress={save}
                    disabled={!canSave}
                    hitSlop={8}
                    style={styles.barBtn}
                >
                    <Text
                        style={{
                            color: theme.text,
                            fontSize: 16,
                            fontWeight: "700",
                            opacity: canSave ? 1 : 0.35,
                        }}
                    >
                        {t("common.save")}
                    </Text>
                </Pressable>
            </View>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ padding: 16, paddingBottom: 200, gap: 26 }}
                    keyboardShouldPersistTaps="handled"
                >
                    <TextInput
                        value={name}
                        onChangeText={setName}
                        placeholder={t("playlist.name")}
                        placeholderTextColor={theme.textPlaceholder}
                        accessibilityLabel={t("playlist.name")}
                        style={[styles.name, { color: theme.text }]}
                    />

                    {rules.groups.length > 1 && (
                        <View style={styles.headRow}>
                            <SectionLabel>{t("smart.betweenGroups")}</SectionLabel>
                            <Segmented
                                small
                                value={rules.match}
                                onChange={(match) => setRules({ ...rules, match })}
                                options={matchOptions}
                            />
                        </View>
                    )}

                    {(rules.groups.length
                        ? rules.groups
                        : [{ match: "all" as const, conditions: [] }]
                    ).map((group, gi) => (
                        <View key={gi} style={{ gap: 10 }}>
                            <View style={styles.headRow}>
                                <SectionLabel>
                                    {rules.groups.length > 1
                                        ? t("smart.groupN", { n: gi + 1 })
                                        : t("smart.conditions")}
                                </SectionLabel>
                                {group.conditions.length > 1 && (
                                    <Segmented
                                        small
                                        value={group.match}
                                        onChange={(match) => setGroup(gi, group.conditions, match)}
                                        options={matchOptions}
                                    />
                                )}
                            </View>
                            <Card>
                                {group.conditions.map((c, ci) => (
                                    <Pressable
                                        key={ci}
                                        accessibilityRole="button"
                                        onPress={() => setEditing({ g: gi, c: ci })}
                                        style={({ pressed }) => [
                                            styles.condRow,
                                            ci > 0 && {
                                                borderTopWidth: StyleSheet.hairlineWidth,
                                                borderTopColor: theme.border,
                                            },
                                            pressed && { backgroundColor: theme.surfaceStrong },
                                        ]}
                                    >
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ color: theme.textSubtle, fontSize: 13 }}>
                                                {t(`smart.field.${c.field}` as TranslationKey)}
                                            </Text>
                                            <Text
                                                style={{
                                                    color: theme.text,
                                                    fontSize: 15,
                                                    marginTop: 2,
                                                }}
                                                numberOfLines={1}
                                            >
                                                {conditionText(c)}
                                            </Text>
                                        </View>
                                        <MaterialCommunityIcons
                                            name="chevron-right"
                                            size={20}
                                            color={theme.textSubtle}
                                        />
                                    </Pressable>
                                ))}
                                <ListRow
                                    first={group.conditions.length === 0}
                                    icon="plus"
                                    title={t("smart.addCondition")}
                                    onPress={() => addCondition(gi)}
                                />
                            </Card>
                        </View>
                    ))}

                    {rules.groups.length > 0 && (
                        <Pressable
                            accessibilityRole="button"
                            onPress={() => addCondition(rules.groups.length)}
                            hitSlop={8}
                            style={{ marginTop: -12 }}
                        >
                            <Text style={{ color: theme.textMuted, fontSize: 14 }}>
                                {t("smart.addGroup")}
                            </Text>
                        </Pressable>
                    )}

                    <View style={{ gap: 10 }}>
                        <SectionLabel>{t("smart.options")}</SectionLabel>
                        <Card>
                            <ListRow
                                first
                                title={t("smart.limit")}
                                right={
                                    <TextInput
                                        value={limit}
                                        onChangeText={setLimit}
                                        keyboardType="number-pad"
                                        placeholder={t("smart.noLimit")}
                                        placeholderTextColor={theme.textPlaceholder}
                                        accessibilityLabel={t("smart.limit")}
                                        style={[
                                            styles.limit,
                                            {
                                                color: theme.text,
                                                backgroundColor: theme.surfaceStrong,
                                            },
                                        ]}
                                    />
                                }
                            />
                            <ListRow
                                title={t("smart.sort")}
                                value={`${t(`sort.${sortBy}`)}, ${t(sortDir === "asc" ? "sort.asc" : "sort.desc").toLowerCase()}`}
                                chevron
                                onPress={() => setSortOpen(true)}
                            />
                        </Card>
                    </View>

                    <View style={{ gap: 12 }}>
                        <Text style={{ color: theme.textMuted, textAlign: "center", fontSize: 14 }}>
                            {t("smart.preview", { n: preview })}
                        </Text>
                        <AppButton label={t("common.save")} disabled={!canSave} onPress={save} />
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            <ConditionSheet
                key={editing ? `${editing.g}-${editing.c}` : "none"}
                condition={editingCondition}
                suggestions={suggestionsFor}
                onClose={() => setEditing(null)}
                onSave={(c) => {
                    if (!editing) return;
                    const group = rules.groups[editing.g]!;
                    setGroup(
                        editing.g,
                        group.conditions.map((x, i) => (i === editing.c ? c : x))
                    );
                    setEditing(null);
                }}
                onRemove={() => {
                    if (!editing) return;
                    const group = rules.groups[editing.g]!;
                    setGroup(
                        editing.g,
                        group.conditions.filter((_, i) => i !== editing.c)
                    );
                    setEditing(null);
                }}
            />

            <Sheet visible={sortOpen} onClose={() => setSortOpen(false)} title={t("smart.sort")}>
                <View style={{ gap: 16, paddingHorizontal: 4 }}>
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
                </View>
            </Sheet>
        </AppScreen>
    );
}

const styles = StyleSheet.create({
    bar: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        height: 52,
        paddingHorizontal: 6,
    },
    barBtn: {
        minWidth: 80,
        height: 44,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 10,
    },
    name: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5, paddingVertical: 4 },
    headRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        minHeight: 38,
    },
    condRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 10,
        minHeight: 58,
    },
    wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    limit: {
        minWidth: 72,
        height: 34,
        borderRadius: 8,
        paddingHorizontal: 10,
        fontSize: 15,
        textAlign: "center",
    },
});
