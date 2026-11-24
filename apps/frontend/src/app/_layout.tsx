import { Stack } from "expo-router";
import { setOptions } from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { TamaguiProvider, Theme } from "tamagui";

import appTamaguiConfig from "../tamagui.config";
import { MusicBottomNav } from "../components/music/music-bottom-nav";
import { MiniPlayer } from "../components/music/mini-player";
import { initPlayer } from "../player/music-player";
import { initDatabase } from "../data/db";
import { startLibrarySync } from "../data/music";
import { useSettingsStore } from "../store/useSettingsStore";
import { onSignedIn, useAuthStore } from "../store/useAuthStore";
import { usePlaylistStore } from "../store/usePlaylistStore";
import { startPolling, useAnalysisStore } from "../analysis/manager";
import { listenForAnalysisPushes, registerForPushNotifications } from "../notifications/push";
import { syncNow } from "../sync/sync";
import { UpdateSheet } from "../components/updates/update-sheet";
import { useUpdateStore } from "../updates/updater";
import { useAppTheme, useResolvedScheme } from "../theme/app-theme";
import { log } from "@/utils/logger";

setOptions({ duration: 1000, fade: true });

// Settings must be known before the first render (language, theme).
try {
    initDatabase();
    useSettingsStore.getState().load();
} catch (error) {
    log.error("Database init failed", error);
}

onSignedIn(() => {
    void registerForPushNotifications();
    startPolling();
    void useAnalysisStore.getState().refreshUsage();
    syncNow().catch((error) => log.warn("Initial sync failed", error));
});

export default function RootLayout() {
    const scheme = useResolvedScheme();
    const theme = useAppTheme();

    useEffect(() => {
        initPlayer();
        startLibrarySync();
        usePlaylistStore.getState().load();
        void useAuthStore.getState().restore();
        // Release builds look for a newer APK on GitHub a few seconds after start.
        const updateTimer = __DEV__
            ? undefined
            : setTimeout(() => void useUpdateStore.getState().check(), 4000);
        const unsubscribePush = listenForAnalysisPushes();
        return () => {
            if (updateTimer) clearTimeout(updateTimer);
            unsubscribePush();
        };
    }, []);

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
                <TamaguiProvider config={appTamaguiConfig} defaultTheme={scheme}>
                    <Theme name={scheme}>
                        <StatusBar style={scheme === "dark" ? "light" : "dark"} />
                        <Stack
                            screenOptions={{
                                headerShown: false,
                                contentStyle: { backgroundColor: theme.background },
                                animation: "fade",
                            }}
                        />
                        <MiniPlayer />
                        <MusicBottomNav />
                        <UpdateSheet />
                    </Theme>
                </TamaguiProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}
