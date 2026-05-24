import { createTamagui } from "tamagui";
import { defaultConfig as baseConfig } from "@tamagui/config/v4";

export const tamaguiConfig = createTamagui(baseConfig);

export default tamaguiConfig;

type AppConfig = typeof tamaguiConfig;

declare module "tamagui" {
  interface TamaguiCustomConfig extends AppConfig {}
}