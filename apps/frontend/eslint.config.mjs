import { config as baseConfig } from "@repo/eslint-config/base";
import expoConfig from "eslint-config-expo/flat.js";

export default [
    ...baseConfig,
    ...expoConfig,
    {
        ignores: ["dist/*"],
    },
];
