import { logger, consoleTransport } from "react-native-logs";

export const log = logger.createLogger({
    // If __DEV__ is true, show debug logs.
    // If false (Gradle release build), require a non-existent level like "silent" to suppress everything.
    severity: __DEV__ ? "debug" : "silent",

    levels: {
        debug: 0,
        info: 1,
        warn: 2,
        error: 3,
        silent: 4,
    },

    // Only attach the console transport if we are in development
    transport: __DEV__ ? consoleTransport : () => {},

    transportOptions: {
        colors: {
            debug: "whiteBright",
            info: "blueBright",
            warn: "yellowBright",
            error: "redBright",
        },
    },
});
