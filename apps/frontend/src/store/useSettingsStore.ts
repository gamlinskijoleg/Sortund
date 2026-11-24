import { create } from "zustand";
import { kvGet, kvSet } from "../data/db";

export type Language = "uk" | "en";
export type ThemeMode = "system" | "light" | "dark";

interface SettingsState {
    language: Language;
    themeMode: ThemeMode;
    loaded: boolean;
    load: () => void;
    setLanguage: (language: Language) => void;
    setThemeMode: (mode: ThemeMode) => void;
}

/** Interface language and theme (REQ 64–65), persisted in the local SQLite database. */
export const useSettingsStore = create<SettingsState>((set) => ({
    language: "uk",
    themeMode: "system",
    loaded: false,
    load: () => {
        try {
            const language = kvGet("settings.language");
            const themeMode = kvGet("settings.theme");
            set({
                language: language === "en" ? "en" : "uk",
                themeMode: themeMode === "light" || themeMode === "dark" ? themeMode : "system",
                loaded: true,
            });
        } catch {
            set({ loaded: true });
        }
    },
    setLanguage: (language) => {
        kvSet("settings.language", language);
        set({ language });
    },
    setThemeMode: (themeMode) => {
        kvSet("settings.theme", themeMode);
        set({ themeMode });
    },
}));
