// @ts-check
import { config as baseConfig } from "@repo/eslint-config/base";

export default [
    ...baseConfig,
    {
        languageOptions: {
            parserOptions: {
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },
];
