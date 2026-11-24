import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import {
    ActivityIndicator,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
    type TextInputProps,
    type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../theme/app-theme";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

export function AppButton({
    label,
    onPress,
    icon,
    variant = "primary",
    disabled,
    loading,
    compact,
    style,
}: {
    label: string;
    onPress: () => void;
    icon?: IconName;
    variant?: "primary" | "secondary" | "ghost" | "danger";
    disabled?: boolean;
    loading?: boolean;
    compact?: boolean;
    style?: ViewStyle;
}) {
    const theme = useAppTheme();
    const bg =
        variant === "primary"
            ? theme.accent
            : variant === "secondary"
              ? theme.surfaceStrong
              : "transparent";
    const fg =
        variant === "primary"
            ? theme.inverseText
            : variant === "danger"
              ? theme.danger
              : theme.text;
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !!disabled }}
            onPress={onPress}
            disabled={disabled || loading}
            style={({ pressed }) => [
                styles.button,
                compact && styles.buttonCompact,
                { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
                variant === "ghost" && { borderWidth: 1, borderColor: theme.border },
                style,
            ]}
        >
            {loading ? (
                <ActivityIndicator size="small" color={fg} />
            ) : (
                icon && <MaterialCommunityIcons name={icon} size={compact ? 16 : 18} color={fg} />
            )}
            <Text style={[styles.buttonLabel, compact && { fontSize: 13 }, { color: fg }]}>
                {label}
            </Text>
        </Pressable>
    );
}

export function IconButton({
    icon,
    onPress,
    label,
    active,
    size = 24,
    color,
}: {
    icon: IconName;
    onPress: () => void;
    label: string;
    active?: boolean;
    size?: number;
    color?: string;
}) {
    const theme = useAppTheme();
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            hitSlop={8}
            onPress={onPress}
            style={({ pressed }) => [
                styles.iconButton,
                {
                    backgroundColor: active ? theme.accentSoft : "transparent",
                    opacity: pressed ? 0.6 : 1,
                },
            ]}
        >
            <MaterialCommunityIcons
                name={icon}
                size={size}
                color={color ?? (active ? theme.accent : theme.text)}
            />
        </Pressable>
    );
}

export function Chip({
    label,
    selected,
    onPress,
    icon,
    tone = "default",
}: {
    label: string;
    selected?: boolean;
    onPress?: () => void;
    icon?: IconName;
    tone?: "default" | "muted";
}) {
    const theme = useAppTheme();
    const content = (
        <>
            {icon && (
                <MaterialCommunityIcons
                    name={icon}
                    size={14}
                    color={selected ? theme.inverseText : theme.textMuted}
                />
            )}
            <Text
                style={[
                    styles.chipLabel,
                    {
                        color: selected
                            ? theme.inverseText
                            : tone === "muted"
                              ? theme.textSubtle
                              : theme.text,
                    },
                ]}
                numberOfLines={1}
            >
                {label}
            </Text>
        </>
    );
    const style = [
        styles.chip,
        {
            backgroundColor: selected ? theme.accent : theme.surface,
            borderColor: selected ? theme.accent : theme.border,
        },
    ];
    if (!onPress) return <View style={style}>{content}</View>;
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: !!selected }}
            onPress={onPress}
            style={({ pressed }) => [...style, { opacity: pressed ? 0.7 : 1 }]}
        >
            {content}
        </Pressable>
    );
}

export function Field({ label, ...props }: TextInputProps & { label?: string }) {
    const theme = useAppTheme();
    return (
        <View style={{ gap: 6 }}>
            {label && <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{label}</Text>}
            <TextInput
                placeholderTextColor={theme.textPlaceholder}
                {...props}
                style={[
                    styles.input,
                    {
                        backgroundColor: theme.surface,
                        color: theme.text,
                        borderColor: theme.border,
                    },
                    props.style,
                ]}
            />
        </View>
    );
}

export function Section({
    title,
    children,
    action,
}: {
    title?: string;
    children: React.ReactNode;
    action?: React.ReactNode;
}) {
    const theme = useAppTheme();
    return (
        <View style={{ gap: 10, marginBottom: 22 }}>
            {(title || action) && (
                <View style={styles.sectionHead}>
                    {title && (
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
                    )}
                    {action}
                </View>
            )}
            {children}
        </View>
    );
}

export function Segmented<T extends string>({
    options,
    value,
    onChange,
}: {
    options: { value: T; label: string }[];
    value: T;
    onChange: (value: T) => void;
}) {
    const theme = useAppTheme();
    return (
        <View style={[styles.segmented, { backgroundColor: theme.surface }]}>
            {options.map((o) => {
                const active = o.value === value;
                return (
                    <Pressable
                        key={o.value}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        onPress={() => onChange(o.value)}
                        style={[styles.segment, active && { backgroundColor: theme.background }]}
                    >
                        <Text
                            style={{
                                color: active ? theme.text : theme.textMuted,
                                fontWeight: active ? "700" : "500",
                                fontSize: 13,
                            }}
                            numberOfLines={1}
                        >
                            {o.label}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

export function EmptyState({
    icon,
    text,
    action,
}: {
    icon: IconName;
    text: string;
    action?: React.ReactNode;
}) {
    const theme = useAppTheme();
    return (
        <View style={styles.empty}>
            <MaterialCommunityIcons name={icon} size={40} color={theme.textSubtle} />
            <Text style={{ color: theme.textMuted, textAlign: "center", fontSize: 15 }}>
                {text}
            </Text>
            {action}
        </View>
    );
}

export function Notice({
    text,
    tone = "info",
}: {
    text: string;
    tone?: "info" | "warning" | "error";
}) {
    const theme = useAppTheme();
    const color =
        tone === "error" ? theme.danger : tone === "warning" ? theme.warning : theme.accentStrong;
    return (
        <View style={[styles.notice, { borderColor: color, backgroundColor: theme.surface }]}>
            <MaterialCommunityIcons
                name={tone === "info" ? "information-outline" : "alert-circle-outline"}
                size={18}
                color={color}
            />
            <Text style={{ color: theme.text, flex: 1, fontSize: 14 }}>{text}</Text>
        </View>
    );
}

/** Bottom sheet built on the native Modal. */
export function Sheet({
    visible,
    onClose,
    title,
    children,
    footer,
}: {
    visible: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
}) {
    const theme = useAppTheme();
    const insets = useSafeAreaInsets();
    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
            <View
                style={[
                    styles.sheet,
                    { backgroundColor: theme.background, paddingBottom: insets.bottom + 12 },
                ]}
            >
                <View style={styles.sheetHead}>
                    <Text style={[styles.sheetTitle, { color: theme.text }]}>{title}</Text>
                    <IconButton icon="close" label="Close" onPress={onClose} />
                </View>
                <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ paddingBottom: 8 }}>
                    {children}
                </ScrollView>
                {footer && <View style={{ paddingTop: 12 }}>{footer}</View>}
            </View>
        </Modal>
    );
}

export function ConfidenceBar({ value }: { value: number }) {
    const theme = useAppTheme();
    return (
        <View style={[styles.barTrack, { backgroundColor: theme.surfaceStrong }]}>
            <View
                style={[
                    styles.barFill,
                    {
                        backgroundColor: theme.accent,
                        width: `${Math.round(Math.min(1, value) * 100)}%`,
                    },
                ]}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    button: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        borderRadius: 14,
        paddingHorizontal: 16,
        minHeight: 46,
    },
    buttonCompact: { minHeight: 34, paddingHorizontal: 12, borderRadius: 10 },
    buttonLabel: { fontSize: 15, fontWeight: "600" },
    iconButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
    },
    chip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        borderRadius: 16,
        borderWidth: 1,
        paddingHorizontal: 12,
        height: 32,
        maxWidth: 240,
    },
    chipLabel: { fontSize: 13, fontWeight: "500" },
    fieldLabel: { fontSize: 13, fontWeight: "600" },
    input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 46, fontSize: 15 },
    sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    sectionTitle: { fontSize: 17, fontWeight: "700" },
    segmented: { flexDirection: "row", borderRadius: 12, padding: 3 },
    segment: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        height: 34,
        borderRadius: 9,
    },
    empty: { alignItems: "center", gap: 12, paddingVertical: 40, paddingHorizontal: 24 },
    notice: {
        flexDirection: "row",
        gap: 10,
        alignItems: "center",
        borderLeftWidth: 3,
        borderRadius: 10,
        padding: 12,
    },
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
    sheet: {
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        paddingHorizontal: 16,
        paddingTop: 8,
    },
    sheetHead: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 6,
    },
    sheetTitle: { fontSize: 18, fontWeight: "700" },
    barTrack: { height: 6, borderRadius: 3, overflow: "hidden", flex: 1 },
    barFill: { height: 6, borderRadius: 3 },
});
