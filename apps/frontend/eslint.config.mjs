import { config as baseConfig } from "@repo/eslint-config/base";
import expoConfig from "eslint-config-expo/flat.js";
import { configs as tsConfigs } from "typescript-eslint";

// eslint-config-expo registers `@typescript-eslint` in its own config objects,
// but baseConfig (via tseslint.configs.recommendedTypeChecked) already owns
// that plugin name. ESLint 9 flat config forbids duplicate plugin declarations,
// so we strip the `plugins["@typescript-eslint"]` key from any expo config
// entries that re-declare it, while preserving all their rules and settings.
const dedupedExpoConfig = expoConfig.map((entry) => {
    if (entry.plugins?.["@typescript-eslint"]) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { "@typescript-eslint": _removed, ...rest } = entry.plugins;
        return { ...entry, plugins: rest };
    }
    return entry;
});

export default [
    // Ignore auto-generated and build-output directories
    { ignores: ["coverage/**", ".expo/**"] },
    ...baseConfig,
    ...dedupedExpoConfig,
    // Expo config plugins are plain CommonJS run by Node at prebuild time, outside
    // tsconfig, so type-aware rules cannot run on them.
    {
        files: ["plugins/**/*.js"],
        ...tsConfigs.disableTypeChecked,
        rules: {
            ...tsConfigs.disableTypeChecked.rules,
            "@typescript-eslint/no-require-imports": "off",
        },
    },
];
