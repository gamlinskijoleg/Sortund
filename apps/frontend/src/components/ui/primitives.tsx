import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useEffect } from "react";
import {
    ActivityIndicator,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
    type StyleProp,
    type TextInputProps,
    type ViewStyle,
} from "react-native";
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useT } from "../../i18n";
import { useAppTheme } from "../../theme/app-theme";

export type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

const pressScale = (pressed: boolean) => ({ transform: [{ scale: pressed ? 0.96 : 1 }] });

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
    style?: StyleProp<ViewStyle>;
}) {
    const theme = useAppTheme();
    const bg =
        variant === "primary"
            ? theme.accent
            : variant === "secondary"
              ? theme.surfaceStrong
              : "transparent";
    const fg = variant === "primary" ? theme.inverseText : theme.text;
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !!disabled, busy: !!loading }}
            onPress={onPress}
            disabled={disabled || loading}
            style={({ pressed }) => [
                styles.button,
                compact && styles.buttonCompact,
                { backgroundColor: bg, opacity: disabled ? 0.4 : 1 },
                (variant === "ghost" || variant === "danger") && {
                    borderWidth: 1,
                    borderColor: theme.surfaceStrong,
                },
                pressScale(pressed),
                style,
            ]}
        >
            {loading ? (
                <ActivityIndicator size="small" color={fg} />
            ) : (
                icon && <MaterialCommunityIcons name={icon} size={compact ? 17 : 19} color={fg} />
            )}
            <Text
                style={[styles.buttonLabel, compact && { fontSize: 14 }, { color: fg }]}
                numberOfLines={1}
            >
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
    style,
    disabled,
}: {
    icon: IconName;
    onPress: () => void;
    label: string;
    active?: boolean;
    size?: number;
    color?: string;
    style?: StyleProp<ViewStyle>;
    disabled?: boolean;
}) {
    const theme = useAppTheme();
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: !!active, disabled: !!disabled }}
            hitSlop={4}
            disabled={disabled}
            onPress={onPress}
            style={({ pressed }) => [
                styles.iconButton,
                {
                    backgroundColor: pressed ? theme.surfaceStrong : "transparent",
                    opacity: disabled ? 0.35 : 1,
                },
                pressScale(pressed),
                style,
            ]}
        >
            <MaterialCommunityIcons name={icon} size={size} color={color ?? theme.text} />
        </Pressable>
    );
}

export function Chip({
    label,
    selected,
    onPress,
    icon,
    tone = "default",
    onRemove,
}: {
    label: string;
    selected?: boolean;
    onPress?: () => void;
    icon?: IconName;
    tone?: "default" | "muted";
    /** Shows a small cross; the whole chip removes it. */
    onRemove?: () => void;
}) {
    const theme = useAppTheme();
    const fg = selected ? theme.inverseText : tone === "muted" ? theme.textSubtle : theme.text;
    const content = (
        <>
            {icon && <MaterialCommunityIcons name={icon} size={15} color={fg} />}
            <Text style={[styles.chipLabel, { color: fg }]} numberOfLines={1}>
                {label}
            </Text>
            {onRemove && <MaterialCommunityIcons name="close" size={15} color={fg} />}
        </>
    );
    const base = [
        styles.chip,
        tone === "muted" && !selected
            ? { backgroundColor: "transparent", borderWidth: 1, borderColor: theme.surfaceStrong }
            : { backgroundColor: selected ? theme.accent : theme.surfaceStrong },
    ];
    const press = onRemove ?? onPress;
    if (!press) return <View style={base}>{content}</View>;
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: !!selected }}
            onPress={press}
            style={({ pressed }) => [...base, pressScale(pressed)]}
        >
            {content}
        </Pressable>
    );
}

export function Field({ label, ...props }: TextInputProps & { label?: string }) {
    const theme = useAppTheme();
    const [focused, setFocused] = React.useState(false);
    return (
        <View style={{ gap: 6 }}>
            {label && <Text style={[styles.fieldLabel, { color: theme.textSubtle }]}>{label}</Text>}
            <TextInput
                placeholderTextColor={theme.textPlaceholder}
                accessibilityLabel={label ?? props.placeholder}
                {...props}
                onFocus={(e) => {
                    setFocused(true);
                    props.onFocus?.(e);
                }}
                onBlur={(e) => {
                    setFocused(false);
                    props.onBlur?.(e);
                }}
                style={[
                    styles.input,
                    {
                        backgroundColor: theme.surface,
                        color: theme.text,
                        borderColor: focused ? theme.text : theme.border,
                    },
                    props.style,
                ]}
            />
        </View>
    );
}

/** Small uppercase heading used above groups of content. */
export function SectionLabel({ children }: { children: string }) {
    const theme = useAppTheme();
    return <Text style={[styles.sectionLabel, { color: theme.textSubtle }]}>{children}</Text>;
}

export function Section({
    title,
    children,
    action,
    style,
}: {
    title?: string;
    children: React.ReactNode;
    action?: React.ReactNode;
    style?: StyleProp<ViewStyle>;
}) {
    return (
        <View style={[{ gap: 10, marginBottom: 26 }, style]}>
            {(title || action) && (
                <View style={styles.sectionHead}>
                    {title ? <SectionLabel>{title}</SectionLabel> : <View />}
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
    small,
}: {
    options: { value: T; label: string }[];
    value: T;
    onChange: (value: T) => void;
    small?: boolean;
}) {
    const theme = useAppTheme();
    return (
        <View
            accessibilityRole="radiogroup"
            style={[styles.segmented, { backgroundColor: theme.surface }]}
        >
            {options.map((o) => {
                const active = o.value === value;
                return (
                    <Pressable
                        key={o.value}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: active }}
                        onPress={() => onChange(o.value)}
                        style={[
                            styles.segment,
                            small ? { height: 30, flex: 0, paddingHorizontal: 12 } : null,
                            active && { backgroundColor: theme.accent },
                        ]}
                    >
                        <Text
                            style={{
                                color: active ? theme.inverseText : theme.textMuted,
                                fontWeight: "600",
                                fontSize: small ? 13 : 14,
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
            <View style={[styles.emptyIcon, { backgroundColor: theme.surface }]}>
                <MaterialCommunityIcons name={icon} size={30} color={theme.textMuted} />
            </View>
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
    return (
        <View
            accessibilityRole={tone === "error" ? "alert" : undefined}
            style={[styles.notice, { backgroundColor: theme.surface }]}
        >
            <MaterialCommunityIcons
                name={tone === "info" ? "information-outline" : "alert-circle-outline"}
                size={18}
                color={theme.text}
            />
            <Text style={{ color: theme.text, flex: 1, fontSize: 14, lineHeight: 20 }}>{text}</Text>
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
    scroll = true,
}: {
    visible: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    scroll?: boolean;
}) {
    const theme = useAppTheme();
    const t = useT();
    const insets = useSafeAreaInsets();
    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <Pressable
                style={[styles.backdrop, { backgroundColor: theme.overlay }]}
                onPress={onClose}
                accessibilityLabel={t("common.close")}
            />
            <View
                style={[
                    styles.sheet,
                    {
                        backgroundColor: theme.elevated,
                        paddingBottom: insets.bottom + 14,
                        borderColor: theme.border,
                    },
                ]}
            >
                <View style={[styles.grabber, { backgroundColor: theme.surfaceStrong }]} />
                <View style={styles.sheetHead}>
                    <Text style={[styles.sheetTitle, { color: theme.text }]}>{title}</Text>
                    <IconButton icon="close" label={t("common.close")} onPress={onClose} />
                </View>
                {scroll ? (
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        showsHorizontalScrollIndicator={false}
                        style={{ maxHeight: 560 }}
                        contentContainerStyle={{ paddingBottom: 8 }}
                        keyboardShouldPersistTaps="handled"
                    >
                        {children}
                    </ScrollView>
                ) : (
                    children
                )}
                {footer && <View style={{ paddingTop: 12 }}>{footer}</View>}
            </View>
        </Modal>
    );
}

export type MenuItem = { icon: IconName; label: string; onPress: () => void };

/** Small popover menu anchored to the top-right corner (for rarely used actions). */
export function PopoverMenu({
    visible,
    onClose,
    items,
    top = 56,
}: {
    visible: boolean;
    onClose: () => void;
    items: MenuItem[];
    top?: number;
}) {
    const theme = useAppTheme();
    const insets = useSafeAreaInsets();
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
            <View
                accessibilityRole="menu"
                style={[
                    styles.menu,
                    {
                        top: insets.top + top,
                        backgroundColor: theme.elevated,
                        borderColor: theme.surfaceStrong,
                    },
                ]}
            >
                {items.map((item) => (
                    <Pressable
                        key={item.label}
                        accessibilityRole="menuitem"
                        onPress={() => {
                            onClose();
                            item.onPress();
                        }}
                        style={({ pressed }) => [
                            styles.menuItem,
                            pressed && { backgroundColor: theme.surfaceStrong },
                        ]}
                    >
                        <MaterialCommunityIcons name={item.icon} size={20} color={theme.text} />
                        <Text style={{ color: theme.text, fontSize: 15 }}>{item.label}</Text>
                    </Pressable>
                ))}
            </View>
        </Modal>
    );
}

/** Thin bar that grows from zero when it appears. */
export function ConfidenceBar({ value, height = 4 }: { value: number; height?: number }) {
    const theme = useAppTheme();
    const target = Math.round(Math.max(0, Math.min(1, value)) * 100);
    const width = useSharedValue(0);
    useEffect(() => {
        width.value = withTiming(target, { duration: 700, easing: Easing.out(Easing.cubic) });
    }, [target, width]);
    const fill = useAnimatedStyle(() => ({ width: `${width.value}%` }));
    return (
        <View
            style={[
                styles.barTrack,
                { backgroundColor: theme.surfaceStrong, height, borderRadius: height / 2 },
            ]}
        >
            <Animated.View
                style={[{ height, borderRadius: height / 2, backgroundColor: theme.accent }, fill]}
            />
        </View>
    );
}

/** Large page title with an optional control on the right (tab screens). */
export function ScreenTitle({ title, right }: { title: string; right?: React.ReactNode }) {
    const theme = useAppTheme();
    return (
        <View style={styles.screenTitle}>
            <Text accessibilityRole="header" style={[styles.h1, { color: theme.text }]}>
                {title}
            </Text>
            {right && <View style={styles.titleRight}>{right}</View>}
        </View>
    );
}

/** Top bar of pushed screens: back button, optional centred title and right-side controls. */
export function TopBar({
    title,
    right,
    onBack = () => router.back(),
    backIcon = "chevron-left",
}: {
    title?: string;
    right?: React.ReactNode;
    onBack?: () => void;
    backIcon?: IconName;
}) {
    const theme = useAppTheme();
    const t = useT();
    return (
        <View style={styles.topBar}>
            <IconButton icon={backIcon} size={28} label={t("common.back")} onPress={onBack} />
            <Text
                accessibilityRole="header"
                style={[styles.topTitle, { color: theme.text }]}
                numberOfLines={1}
            >
                {title ?? ""}
            </Text>
            <View style={styles.topRight}>{right}</View>
        </View>
    );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
    const theme = useAppTheme();
    return <View style={[styles.card, { backgroundColor: theme.surface }, style]}>{children}</View>;
}

export function ListRow({
    icon,
    title,
    subtitle,
    value,
    onPress,
    chevron,
    right,
    first,
    center,
    disabled,
}: {
    icon?: IconName;
    title: string;
    subtitle?: string;
    value?: string;
    onPress?: () => void;
    chevron?: boolean;
    right?: React.ReactNode;
    first?: boolean;
    center?: boolean;
    disabled?: boolean;
}) {
    const theme = useAppTheme();
    const body = (
        <>
            {icon && <MaterialCommunityIcons name={icon} size={21} color={theme.text} />}
            <View style={{ flex: center ? 0 : 1 }}>
                <Text
                    style={{
                        color: theme.text,
                        fontSize: 15,
                        fontWeight: center ? "600" : "400",
                    }}
                    numberOfLines={1}
                >
                    {title}
                </Text>
                {subtitle && (
                    <Text
                        style={{ color: theme.textSubtle, fontSize: 13, marginTop: 2 }}
                        numberOfLines={2}
                    >
                        {subtitle}
                    </Text>
                )}
            </View>
            {value && (
                <Text style={{ color: theme.textMuted, fontSize: 14 }} numberOfLines={1}>
                    {value}
                </Text>
            )}
            {right}
            {chevron && (
                <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textSubtle} />
            )}
        </>
    );
    const style = [
        styles.listRow,
        center && { justifyContent: "center" as const },
        !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
        disabled && { opacity: 0.4 },
    ];
    if (!onPress) return <View style={style}>{body}</View>;
    return (
        <Pressable
            accessibilityRole="button"
            disabled={disabled}
            onPress={onPress}
            style={({ pressed }) => [...style, pressed && { backgroundColor: theme.surfaceStrong }]}
        >
            {body}
        </Pressable>
    );
}

export function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
    const theme = useAppTheme();
    const x = useSharedValue(value ? 20 : 0);
    useEffect(() => {
        x.value = withTiming(value ? 20 : 0, { duration: 180 });
    }, [value, x]);
    const knob = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
    return (
        <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: value }}
            onPress={() => onChange(!value)}
            hitSlop={8}
            style={[styles.toggle, { backgroundColor: value ? theme.accent : theme.surfaceStrong }]}
        >
            <Animated.View
                style={[
                    styles.knob,
                    { backgroundColor: value ? theme.inverseText : theme.textSubtle },
                    knob,
                ]}
            />
        </Pressable>
    );
}

/** Album art or a neutral placeholder (never coloured). */
export function Cover({
    uri,
    size,
    radius = 6,
    style,
}: {
    uri?: string;
    size: number;
    radius?: number;
    style?: StyleProp<ViewStyle>;
}) {
    const theme = useAppTheme();
    return (
        <View
            style={[
                {
                    width: size,
                    height: size,
                    borderRadius: radius,
                    backgroundColor: theme.surfaceStrong,
                    overflow: "hidden",
                    alignItems: "center",
                    justifyContent: "center",
                },
                style,
            ]}
        >
            {uri ? (
                <Image
                    source={{ uri }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={150}
                />
            ) : (
                <MaterialCommunityIcons
                    name="music-note"
                    size={Math.max(14, size * 0.38)}
                    color={theme.textSubtle}
                />
            )}
        </View>
    );
}

/** 2×2 grid of covers for playlists. */
export function Mosaic({
    uris,
    size,
    radius = 8,
}: {
    uris: (string | undefined)[];
    size: number;
    radius?: number;
}) {
    const half = size / 2;
    const cells = [0, 1, 2, 3].map((i) => uris[i % Math.max(1, uris.length)]);
    if (uris.length < 2) return <Cover uri={uris[0]} size={size} radius={radius} />;
    return (
        <View
            style={{
                width: size,
                height: size,
                borderRadius: radius,
                overflow: "hidden",
                flexDirection: "row",
                flexWrap: "wrap",
            }}
        >
            {cells.map((uri, i) => (
                <Cover key={i} uri={uri} size={half} radius={0} />
            ))}
        </View>
    );
}

function EqBar({ delay, color, paused }: { delay: number; color: string; paused?: boolean }) {
    const h = useSharedValue(4);
    useEffect(() => {
        if (paused) {
            h.value = withTiming(4, { duration: 200 });
            return;
        }
        h.value = withDelay(
            delay,
            withRepeat(
                withSequence(
                    withTiming(14, { duration: 380, easing: Easing.inOut(Easing.quad) }),
                    withTiming(4, { duration: 380, easing: Easing.inOut(Easing.quad) })
                ),
                -1
            )
        );
    }, [paused, delay, h]);
    const style = useAnimatedStyle(() => ({ height: h.value }));
    return <Animated.View style={[{ width: 3, borderRadius: 1, backgroundColor: color }, style]} />;
}

/** Animated equaliser shown next to the track that is playing. */
export function Equalizer({ paused }: { paused?: boolean }) {
    const theme = useAppTheme();
    return (
        <View style={styles.eq} accessibilityLabel="Now playing">
            <EqBar delay={0} color={theme.text} paused={paused} />
            <EqBar delay={250} color={theme.text} paused={paused} />
            <EqBar delay={500} color={theme.text} paused={paused} />
        </View>
    );
}

/** Round avatar with the first letter of the account e-mail; opens settings. */
export function ProfileButton({ email }: { email?: string }) {
    const theme = useAppTheme();
    const t = useT();
    const letter = email?.trim()[0]?.toUpperCase();
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("settings.title")}
            onPress={() => router.push("/settings")}
            hitSlop={6}
            style={({ pressed }) => [
                styles.avatar,
                { backgroundColor: theme.surfaceStrong },
                pressScale(pressed),
            ]}
        >
            {letter ? (
                <Text style={{ color: theme.text, fontWeight: "700", fontSize: 15 }}>{letter}</Text>
            ) : (
                <MaterialCommunityIcons name="account-outline" size={20} color={theme.text} />
            )}
        </Pressable>
    );
}

export function CountBadge({ n, inverse }: { n: number; inverse?: boolean }) {
    const theme = useAppTheme();
    return (
        <View style={[styles.badge, { backgroundColor: inverse ? theme.inverseText : theme.text }]}>
            <Text
                style={{
                    color: inverse ? theme.text : theme.inverseText,
                    fontSize: 11,
                    fontWeight: "700",
                }}
            >
                {n}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    button: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        borderRadius: 26,
        paddingHorizontal: 20,
        minHeight: 50,
    },
    buttonCompact: { minHeight: 40, paddingHorizontal: 16, borderRadius: 20 },
    buttonLabel: { fontSize: 15, fontWeight: "700" },
    iconButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
    },
    chip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        borderRadius: 17,
        paddingHorizontal: 13,
        height: 34,
        maxWidth: 260,
    },
    chipLabel: { fontSize: 14, fontWeight: "500" },
    fieldLabel: { fontSize: 13 },
    input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 48, fontSize: 16 },
    sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    sectionLabel: {
        fontSize: 13,
        fontWeight: "600",
        letterSpacing: 0.8,
        textTransform: "uppercase",
    },
    segmented: { flexDirection: "row", borderRadius: 12, padding: 4, gap: 4 },
    segment: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        height: 38,
        borderRadius: 9,
    },
    empty: { alignItems: "center", gap: 14, paddingVertical: 48, paddingHorizontal: 32 },
    emptyIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: "center",
        justifyContent: "center",
    },
    notice: { flexDirection: "row", gap: 10, alignItems: "center", borderRadius: 14, padding: 14 },
    backdrop: { flex: 1 },
    sheet: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderTopWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: 16,
        paddingTop: 8,
    },
    grabber: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, marginBottom: 4 },
    sheetHead: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 6,
        paddingLeft: 4,
    },
    sheetTitle: { fontSize: 20, fontWeight: "700" },
    menu: {
        position: "absolute",
        right: 12,
        minWidth: 240,
        borderRadius: 14,
        borderWidth: 1,
        padding: 6,
        elevation: 12,
        shadowColor: "#000",
        shadowOpacity: 0.35,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 10 },
    },
    menuItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        height: 48,
        paddingHorizontal: 12,
        borderRadius: 10,
    },
    // Fixed height, stretches only across: a row parent must give it width (e.g. a flex: 1 wrapper).
    barTrack: { overflow: "hidden", alignSelf: "stretch" },
    screenTitle: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingTop: 8,
        minHeight: 52,
    },
    titleRight: { flexDirection: "row", alignItems: "center", gap: 6 },
    h1: { fontSize: 32, fontWeight: "800", letterSpacing: -0.8 },
    topBar: { flexDirection: "row", alignItems: "center", height: 52, gap: 4 },
    topTitle: { flex: 1, fontSize: 17, fontWeight: "600", textAlign: "center" },
    topRight: {
        minWidth: 44,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
    },
    card: { borderRadius: 16, overflow: "hidden" },
    listRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        minHeight: 54,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    toggle: { width: 50, height: 30, borderRadius: 15, padding: 3, justifyContent: "center" },
    knob: { width: 24, height: 24, borderRadius: 12 },
    eq: { flexDirection: "row", alignItems: "flex-end", gap: 2, height: 14, width: 14 },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
    },
    badge: {
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        paddingHorizontal: 5,
        alignItems: "center",
        justifyContent: "center",
    },
});
