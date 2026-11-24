// Pins the CMake used for the app's native (C++) build.
//
// The SDK's default CMake 3.22.1 ships ninja 1.10, which cannot handle Windows
// paths longer than 260 chars. react-native-gesture-handler 3.x generates
// object paths past that limit, so the build fails with "ninja: error: mkdir(...)".
// CMake 3.31.x ships ninja 1.12, which supports long paths.
//
// Requires: `sdkmanager "cmake;3.31.6"` and Windows LongPathsEnabled=1.
// Applied on Windows only — Linux CI runners do not have this problem (or this CMake version).
const { withAppBuildGradle } = require("expo/config-plugins");

const CMAKE_VERSION = "3.31.6";
const MARKER = "// with-cmake-version";

module.exports = function withCmakeVersion(config) {
    if (process.platform !== "win32") return config;
    return withAppBuildGradle(config, (cfg) => {
        if (cfg.modResults.contents.includes(MARKER)) return cfg;
        cfg.modResults.contents = cfg.modResults.contents.replace(
            /^android \{$/m,
            `android {\n    ${MARKER}\n    externalNativeBuild { cmake { version "${CMAKE_VERSION}" } }`
        );
        return cfg;
    });
};
