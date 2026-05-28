import { config } from "@tamagui/config";
import { createTamagui } from "tamagui";

const tamaguiConfig = createTamagui(config);

type AppConfig = typeof tamaguiConfig;

declare module "tamagui" {
    // eslint-disable-next-line
    interface TamaguiCustomConfig extends AppConfig {}
}

export default tamaguiConfig;
