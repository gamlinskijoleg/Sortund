import { getDefaultConfig } from "expo/metro-config";
// Temporarily disabled Tamagui metro plugin to isolate bundling issues
// const { withTamagui } = require("@tamagui/metro-plugin");

const config = getDefaultConfig(__dirname);

module.exports = config;
