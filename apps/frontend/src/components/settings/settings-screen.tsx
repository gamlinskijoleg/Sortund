import { router } from "expo-router";
import React, { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "../app-screen";
import { AppButton, Section, Segmented } from "../ui/primitives";
import { MINI_PLAYER_SPACE } from "../music/mini-player";
import { startLibrarySync } from "../../data/music";
import { useT } from "../../i18n";
import { useAuthStore } from "../../store/useAuthStore";
import { useSettingsStore, type Language, type ThemeMode } from "../../store/useSettingsStore";
import { lastSyncAt, syncNow } from "../../sync/sync";
import { useAppTheme } from "../../theme/app-theme";
import { installedVersion, useUpdateStore } from "../../updates/updater";

/** Interface language, theme (REQ 64–65), account and sync (REQ 8, 58–60). */
export default function SettingsScreen() {
    const t = useT();
    const theme = useAppTheme();
    const language = useSettingsStore((s) => s.language);
    const themeMode = useSettingsStore((s) => s.themeMode);
    const user = useAuthStore((s) => s.user);
    const status = useAuthStore((s) => s.status);
    const [syncing, setSyncing] = useState(false);
    const updateChecking = useUpdateStore((s) => s.status === "checking");
    const [lastSync, setLastSync] = useState(lastSyncAt());

    const sync = async () => {
        setSyncing(true);
        try {
            const result = await syncNow();
            setLastSync(lastSyncAt());
            Alert.alert(
                t("settings.sync"),
                t("settings.syncDone", { items: result.items, playlists: result.playlists })
            );
        } catch (error) {
            Alert.alert(t("common.error"), error instanceof Error ? error.message : String(error));
        } finally {
            setSyncing(false);
        }
    };

    return (
        <AppScreen edges={["top"]}>
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: MINI_PLAYER_SPACE }}>
                <Text style={[styles.h1, { color: theme.text }]}>{t("settings.title")}</Text>

                <Section title={t("settings.language")}>
                    <Segmented<Language>
                        value={language}
                        onChange={(v) => useSettingsStore.getState().setLanguage(v)}
                        options={[
                            { value: "uk", label: "Українська" },
                            { value: "en", label: "English" },
                        ]}
                    />
                </Section>

                <Section title={t("settings.theme")}>
                    <Segmented<ThemeMode>
                        value={themeMode}
                        onChange={(v) => useSettingsStore.getState().setThemeMode(v)}
                        options={[
                            { value: "system", label: t("settings.theme.system") },
                            { value: "light", label: t("settings.theme.light") },
                            { value: "dark", label: t("settings.theme.dark") },
                        ]}
                    />
                </Section>

                <Section title={t("settings.account")}>
                    {status === "signedIn" ? (
                        <View style={{ gap: 10 }}>
                            {user && (
                                <Text style={{ color: theme.textMuted }}>
                                    {t("auth.loggedInAs", { email: user.email })}
                                </Text>
                            )}
                            <AppButton
                                variant="secondary"
                                icon="logout"
                                label={t("auth.logout")}
                                onPress={() => void useAuthStore.getState().logout()}
                            />
                            <AppButton
                                variant="ghost"
                                icon="logout-variant"
                                label={t("auth.logoutAll")}
                                onPress={() => void useAuthStore.getState().logout(true)}
                            />
                        </View>
                    ) : (
                        <View style={{ gap: 10 }}>
                            <AppButton
                                icon="login"
                                label={t("auth.login")}
                                onPress={() => router.push("/auth/login")}
                            />
                            <AppButton
                                variant="secondary"
                                icon="account-plus"
                                label={t("auth.register")}
                                onPress={() => router.push("/auth/register")}
                            />
                        </View>
                    )}
                </Section>

                {status === "signedIn" && (
                    <Section title={t("settings.sync")}>
                        <Text style={{ color: theme.textMuted, fontSize: 13 }}>
                            {t("settings.syncHint")}
                        </Text>
                        <Text style={{ color: theme.textSubtle, fontSize: 12 }}>
                            {t("settings.lastSync", {
                                date: lastSync
                                    ? new Date(lastSync).toLocaleString()
                                    : t("settings.never"),
                            })}
                        </Text>
                        <AppButton
                            icon="sync"
                            label={t("settings.syncNow")}
                            loading={syncing}
                            onPress={() => void sync()}
                        />
                    </Section>
                )}

                <Section title={t("update.title")}>
                    <Text style={{ color: theme.textMuted }}>
                        {t("update.current", {
                            version: `${installedVersion().name} (${installedVersion().code ?? "dev"})`,
                        })}
                    </Text>
                    <AppButton
                        variant="secondary"
                        icon="cellphone-arrow-down"
                        label={t("update.check")}
                        loading={updateChecking}
                        onPress={() => void useUpdateStore.getState().check({ manual: true })}
                    />
                </Section>

                <Section>
                    <AppButton
                        variant="ghost"
                        icon="folder-refresh-outline"
                        label={t("settings.rescan")}
                        onPress={() => startLibrarySync(Infinity, true)}
                    />
                </Section>
            </ScrollView>
        </AppScreen>
    );
}

const styles = StyleSheet.create({ h1: { fontSize: 26, fontWeight: "800", marginBottom: 16 } });
