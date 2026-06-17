import { config } from "@tamagui/config";
import { createTamagui, createTokens } from "tamagui";

const customColors = {
    brandPink: "#ad748d",
    brandSoft: "#d9e6eb",
    brandBlue: "#2f7bb4",
};

const tokens = createTokens({
    ...config.tokens,
    color: {
        ...config.tokens.color,
        ...customColors,
    },
});

const tamaguiConfig = createTamagui({
    ...config,
    tokens,
});

type AppConfig = typeof tamaguiConfig;
declare module "tamagui" {
    // eslint-disable-next-line
    interface TamaguiCustomConfig extends AppConfig {}
}

export default tamaguiConfig;
