import { useEffect } from "react";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { TamaguiProvider, Theme } from "tamagui";

import appTamaguiConfig from "../../tamagui.config";
import { MusicBottomNav } from "../components/music/music-bottom-nav";
import { ensureMusicPlayerReady } from "../player/music-player";

export default function RootLayout() {
    useEffect(() => {
        void ensureMusicPlayerReady();
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
