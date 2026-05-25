module.exports = function (api) {
    api.cache(true);

    return {
        presets: ["babel-preset-expo"],
        plugins: [
            // "expo-router/babel",
            // Temporarily disabled Tamagui babel plugin to isolate bundling issues
            // [
            //     "@tamagui/babel-plugin",
            //     {
            //         config: "./tamagui.config.ts",
            //         components: ["tamagui"]
            //     }
            // ],
            "react-native-reanimated/plugin",
        ],
    };
};
