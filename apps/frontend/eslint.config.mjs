import { config as baseConfig } from "@repo/eslint-config/base";
import expoConfig from "eslint-config-expo/flat.js";

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
];
