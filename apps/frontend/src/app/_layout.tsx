import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { TamaguiProvider, Theme } from "tamagui";

import appTamaguiConfig from "../../tamagui.config";

export default function RootLayout() {
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
                    </Theme>
                </TamaguiProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}
