import { Stack } from "expo-router";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { TamaguiProvider, Theme } from "tamagui";

import appTamaguiConfig from "../tamagui.config";
import { MusicBottomNav } from "../components/music/music-bottom-nav";
import { initPlayer } from "../player/music-player";
import * as SplashScreen from "expo-splash-screen";
import { log } from "@/utils/logger";

SplashScreen.setOptions({
    duration: 1000,
    fade: true,
});

export default function RootLayout() {
    useEffect(() => {
        initPlayer()
            .then(() => log.debug("Audio service successfully ready for work"))
            .catch((err) => log.error("Failed to initialize audio mode:", err));
    }, []);

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
                <TamaguiProvider config={appTamaguiConfig} defaultTheme="light">
                    <Theme name="light">
                        <Stack
                            screenOptions={{
                                headerShown: false,
                                contentStyle: { backgroundColor: "#ffffff" },
                            }}
                        />
                        <MusicBottomNav />
                    </Theme>
                </TamaguiProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}
