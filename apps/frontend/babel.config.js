module.exports = function (api) {
    // eslint-disable-next-line
    api.cache(true);

    return {
        presets: ["babel-preset-expo"],
        plugins: ["react-native-reanimated/plugin"],
    };
};
