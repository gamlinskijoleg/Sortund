import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import Animated, {
    FadeInUp,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
    Easing,
    cancelAnimation,
} from "react-native-reanimated";
import { AppScreen } from "../app-screen";
import { AppButton, Card, ListRow, SectionLabel, Segmented, TopBar } from "../ui/primitives";
import { MINI_PLAYER_SPACE } from "../music/mini-player";
import { rescanLibrary } from "../../data/music";
import { useT } from "../../i18n";
import { useAuthStore } from "../../store/useAuthStore";
import { usePlayerStore } from "../../store/usePlayerStore";
import { useSettingsStore, type Language, type ThemeMode } from "../../store/useSettingsStore";
import { lastSyncAt, syncNow } from "../../sync/sync";
import { useAppTheme } from "../../theme/app-theme";
import { installedVersion, useUpdateStore } from "../../updates/updater";

function SpinningIcon({ spinning }: { spinning: boolean }) {
    const theme = useAppTheme();
    const rotation = useSharedValue(0);
    useEffect(() => {
        if (spinning) {
            rotation.value = 0;
            rotation.value = withRepeat(
                withTiming(360, { duration: 900, easing: Easing.linear }),
                -1
            );
        } else {
            cancelAnimation(rotation);
            rotation.value = withTiming(0, { duration: 200 });
        }
    }, [spinning, rotation]);
    const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));
    return (
        <Animated.View style={style}>
            <MaterialCommunityIcons name="sync" size={21} color={theme.text} />
        </Animated.View>
    );
}

/** Account, sync (REQ 8, 58–60), library rescan (REQ 12), theme and language (REQ 64–65). */
export default function SettingsScreen() {
    const t = useT();
    const theme = useAppTheme();
    const language = useSettingsStore((s) => s.language);
    const themeMode = useSettingsStore((s) => s.themeMode);
    const user = useAuthStore((s) => s.user);
    const status = useAuthStore((s) => s.status);
    const trackCount = usePlayerStore((s) => s.libraryTracks.length);
    const scanning = usePlayerStore((s) => s.isLibraryLoading);
    const updateChecking = useUpdateStore((s) => s.status === "checking");
    const [syncing, setSyncing] = useState(false);
    const [lastSync, setLastSync] = useState(lastSyncAt());
    const [rescanOpen, setRescanOpen] = useState(false);
    const [rescanNote, setRescanNote] = useState<string | null>(null);

    const sync = async () => {
        setSyncing(true);
        try {
            await syncNow();
            setLastSync(lastSyncAt());
        } catch (error) {
            Alert.alert(t("common.error"), error instanceof Error ? error.message : String(error));
        } finally {
            setSyncing(false);
        }
    };
    const rescan = (full: boolean) => {
        setRescanOpen(false);
        setRescanNote(t(full ? "settings.scanningAll" : "settings.scanningNew"));
        rescanLibrary(full);
        setTimeout(() => setRescanNote(null), 6000);
    };

    const signedIn = status === "signedIn";
    const letter = user?.email.trim()[0]?.toUpperCase();

    return (
        <AppScreen>
            <View style={{ paddingHorizontal: 8 }}>
                <TopBar title={t("settings.title")} />
            </View>
            <ScrollView
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                    padding: 16,
                    paddingTop: 8,
                    paddingBottom: MINI_PLAYER_SPACE,
                    gap: 26,
                }}
            >
                {signedIn ? (
                    <Card>
                        <View style={styles.account}>
                            <View style={[styles.avatar, { backgroundColor: theme.text }]}>
                                <Text
                                    style={{
                                        color: theme.inverseText,
                                        fontSize: 20,
                                        fontWeight: "700",
                                    }}
                                >
                                    {letter}
                                </Text>
                            </View>
                            <Text
                                style={{
                                    color: theme.text,
                                    fontSize: 16,
                                    fontWeight: "600",
                                    flex: 1,
                                }}
                                numberOfLines={1}
                            >
                                {user?.email}
                            </Text>
                        </View>
                        <ListRow
                            title={t("settings.syncNow")}
                            subtitle={
                                syncing
                                    ? t("settings.syncing")
                                    : t("settings.lastSync", {
                                          date: lastSync
                                              ? new Date(lastSync).toLocaleString()
                                              : t("settings.never"),
                                      })
                            }
                            right={<SpinningIcon spinning={syncing} />}
                            onPress={() => void sync()}
                            disabled={syncing}
                        />
                    </Card>
                ) : (
                    <Card style={{ padding: 16, gap: 10 }}>
                        <Text style={{ color: theme.textMuted, fontSize: 14, marginBottom: 4 }}>
                            {t("settings.signInHint")}
                        </Text>
                        <AppButton
                            label={t("auth.login")}
                            onPress={() => router.push("/auth/login")}
                        />
                        <AppButton
                            variant="secondary"
                            label={t("auth.register")}
                            onPress={() => router.push("/auth/register")}
                        />
                    </Card>
                )}

                <View style={{ gap: 10 }}>
                    <SectionLabel>{t("settings.theme")}</SectionLabel>
                    <Segmented<ThemeMode>
                        value={themeMode}
                        onChange={(v) => useSettingsStore.getState().setThemeMode(v)}
                        options={[
                            { value: "light", label: t("settings.theme.light") },
                            { value: "dark", label: t("settings.theme.dark") },
                            { value: "system", label: t("settings.theme.system") },
                        ]}
                    />
                </View>

                <View style={{ gap: 10 }}>
                    <SectionLabel>{t("settings.language")}</SectionLabel>
                    <Segmented<Language>
                        value={language}
                        onChange={(v) => useSettingsStore.getState().setLanguage(v)}
                        options={[
                            { value: "uk", label: "Українська" },
                            { value: "en", label: "English" },
                        ]}
                    />
                </View>

                <View style={{ gap: 10 }}>
                    <SectionLabel>{t("settings.library")}</SectionLabel>
                    <Card>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityState={{ expanded: rescanOpen }}
                            onPress={() => setRescanOpen(!rescanOpen)}
                            style={({ pressed }) => [
                                styles.rescan,
                                pressed && { backgroundColor: theme.surfaceStrong },
                            ]}
                        >
                            <MaterialCommunityIcons
                                name="folder-refresh-outline"
                                size={21}
                                color={theme.text}
                            />
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: theme.text, fontSize: 15 }}>
                                    {t("settings.rescan")}
                                </Text>
                                <Text
                                    style={{ color: theme.textSubtle, fontSize: 13, marginTop: 2 }}
                                >
                                    {rescanNote ?? t("common.tracks", { n: trackCount })}
                                </Text>
                            </View>
                            {scanning && rescanNote ? (
                                <ActivityIndicator color={theme.text} />
                            ) : (
                                <MaterialCommunityIcons
                                    name={rescanOpen ? "chevron-up" : "chevron-down"}
                                    size={20}
                                    color={theme.textSubtle}
                                />
                            )}
                        </Pressable>
                        {rescanOpen && (
                            <Animated.View
                                entering={FadeInUp.duration(200)}
                                style={styles.rescanOptions}
                            >
                                {([false, true] as const).map((full) => (
                                    <Pressable
                                        key={String(full)}
                                        accessibilityRole="button"
                                        onPress={() => rescan(full)}
                                        style={({ pressed }) => [
                                            styles.option,
                                            {
                                                backgroundColor: pressed
                                                    ? theme.surfaceStrong
                                                    : theme.background,
                                            },
                                        ]}
                                    >
                                        <Text
                                            style={{
                                                color: theme.text,
                                                fontSize: 15,
                                                fontWeight: "600",
                                            }}
                                        >
                                            {t(
                                                full
                                                    ? "settings.rescanFull"
                                                    : "settings.rescanQuick"
                                            )}
                                        </Text>
                                        <Text
                                            style={{
                                                color: theme.textSubtle,
                                                fontSize: 13,
                                                marginTop: 2,
                                            }}
                                        >
                                            {t(
                                                full
                                                    ? "settings.rescanFullHint"
                                                    : "settings.rescanQuickHint"
                                            )}
                                        </Text>
                                    </Pressable>
                                ))}
                            </Animated.View>
                        )}
                    </Card>
                </View>

                <View style={{ gap: 10 }}>
                    <SectionLabel>{t("settings.app")}</SectionLabel>
                    <Card>
                        <ListRow
                            first
                            icon="cellphone-arrow-down"
                            title={t("update.check")}
                            value={installedVersion().name}
                            right={
                                updateChecking ? (
                                    <ActivityIndicator color={theme.text} />
                                ) : undefined
                            }
                            onPress={() => void useUpdateStore.getState().check({ manual: true })}
                            disabled={updateChecking}
                        />
                    </Card>
                </View>

                {signedIn && (
                    <Card>
                        <ListRow
                            first
                            center
                            title={t("auth.logout")}
                            onPress={() => void useAuthStore.getState().logout()}
                        />
                        <Pressable
                            accessibilityRole="button"
                            onPress={() => void useAuthStore.getState().logout(true)}
                            style={({ pressed }) => [
                                styles.logoutAll,
                                { borderTopColor: theme.border },
                                pressed && { backgroundColor: theme.surfaceStrong },
                            ]}
                        >
                            <Text style={{ color: theme.textMuted, fontSize: 15 }}>
                                {t("auth.logoutAll")}
                            </Text>
                        </Pressable>
                    </Card>
                )}
            </ScrollView>
        </AppScreen>
    );
}

const styles = StyleSheet.create({
    account: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16 },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: "center",
        justifyContent: "center",
    },
    rescan: {
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        paddingHorizontal: 16,
        minHeight: 64,
        paddingVertical: 10,
    },
    rescanOptions: { paddingLeft: 51, paddingRight: 12, paddingBottom: 12, gap: 6 },
    option: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
    logoutAll: {
        minHeight: 54,
        alignItems: "center",
        justifyContent: "center",
        borderTopWidth: StyleSheet.hairlineWidth,
    },
});
