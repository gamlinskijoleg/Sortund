import { Stack } from "expo-router";
import { TamaguiProvider, Theme } from "tamagui";

import appTamaguiConfig from "../../tamagui.config";

export default function RootLayout() {
  return (
    <TamaguiProvider config={appTamaguiConfig} defaultTheme="light">
      <Theme name="light">
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: "#0b1220" },
            headerTintColor: "#f8fafc",
            contentStyle: { backgroundColor: "#050816" },
          }}
        />
      </Theme>
    </TamaguiProvider>
  );
}
