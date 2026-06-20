module.exports = {
    moduleFileExtensions: ["js", "json", "ts"],
    rootDir: "./",
    testMatch: ["<rootDir>/src/**/*.spec.ts", "<rootDir>/src/**/*.test.ts"],
    transform: {
        "^.+\\.(t|j)s$": "ts-jest",
    },
    collectCoverageFrom: ["src/**/*.(t|j)s"],
    coverageDirectory: "coverage",
    testEnvironment: "node",
};
