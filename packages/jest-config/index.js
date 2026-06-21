module.exports = {
    clearMocks: true,
    collectCoverage: true,
    testMatch: ["<rootDir>/**/*.spec.ts", "<rootDir>/**/*.test.ts"],
    collectCoverageFrom: ["src/**/*.(t|j)s"],
    coverageDirectory: "coverage",
    testEnvironment: "node",
};
