import baseConfig from "@repo/jest-config/index.js";

/** @type {import('jest').Config} */
export default {
    ...baseConfig,
    preset: "jest-expo",
};
