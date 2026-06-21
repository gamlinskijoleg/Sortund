import baseConfig from "@repo/jest-config/index.js";

export default {
    ...baseConfig,
    transform: {
        "^.+\\.(t|j)s$": "ts-jest",
    },
};
