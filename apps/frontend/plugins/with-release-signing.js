// Release signing and versioning for CI builds.
//
// The generated android/app/build.gradle signs release builds with the debug keystore. This plugin
// adds a "release" signing config that is used when these environment variables are set at
// Gradle time (GitHub Actions passes them from repository secrets):
//
//   SORTUND_KEYSTORE_PATH, SORTUND_KEYSTORE_PASSWORD, SORTUND_KEY_ALIAS, SORTUND_KEY_PASSWORD
//
// Without them the debug keystore is used, so local `assembleRelease` keeps working.
// SORTUND_VERSION_CODE / SORTUND_VERSION_NAME override the version, so every CI build can be
// installed over the previous one.
const { withAppBuildGradle } = require("expo/config-plugins");

const MARKER = "// with-release-signing";

module.exports = function withReleaseSigning(config) {
    return withAppBuildGradle(config, (cfg) => {
        let gradle = cfg.modResults.contents;
        if (gradle.includes(MARKER)) return cfg;

        gradle = gradle.replace(
            /versionCode \d+/,
            `versionCode((System.getenv("SORTUND_VERSION_CODE") ?: "${config.android?.versionCode ?? 1}").toInteger())`
        );
        gradle = gradle.replace(
            /versionName "([^"]*)"/,
            (_, name) => `versionName(System.getenv("SORTUND_VERSION_NAME") ?: "${name}")`
        );

        gradle = gradle.replace(
            /signingConfigs \{\n/,
            `signingConfigs {
        ${MARKER}
        release {
            if (System.getenv("SORTUND_KEYSTORE_PATH")) {
                storeFile file(System.getenv("SORTUND_KEYSTORE_PATH"))
                storePassword System.getenv("SORTUND_KEYSTORE_PASSWORD")
                keyAlias System.getenv("SORTUND_KEY_ALIAS")
                keyPassword System.getenv("SORTUND_KEY_PASSWORD")
            }
        }
`
        );

        // Only the release build type: its signingConfig line follows the "release {" header comments.
        gradle = gradle.replace(
            /(buildTypes \{[\s\S]*?release \{[\s\S]*?)signingConfig signingConfigs\.debug/,
            `$1signingConfig(System.getenv("SORTUND_KEYSTORE_PATH") ? signingConfigs.release : signingConfigs.debug)`
        );

        if (!gradle.includes('System.getenv("SORTUND_KEYSTORE_PATH") ? signingConfigs.release')) {
            throw new Error("with-release-signing: could not patch android/app/build.gradle");
        }
        cfg.modResults.contents = gradle;
        return cfg;
    });
};
