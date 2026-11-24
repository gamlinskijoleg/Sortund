import { useCallback } from "react";
import { useSettingsStore, type Language } from "../store/useSettingsStore";
import { en } from "./en";
import { uk } from "./uk";

export type TranslationKey = keyof typeof en;

const dictionaries: Record<Language, Record<TranslationKey, string>> = { en, uk };

export function translate(
    language: Language,
    key: TranslationKey,
    params?: Record<string, string | number>
): string {
    let text = dictionaries[language][key] ?? en[key] ?? key;
    if (params) {
        for (const [name, value] of Object.entries(params)) {
            text = text.replaceAll(`{${name}}`, String(value));
        }
    }
    return text;
}

/** Translation outside React (e.g. alerts in async code). */
export function t(key: TranslationKey, params?: Record<string, string | number>): string {
    return translate(useSettingsStore.getState().language, key, params);
}

export function useT() {
    const language = useSettingsStore((s) => s.language);
    return useCallback(
        (key: TranslationKey, params?: Record<string, string | number>) =>
            translate(language, key, params),
        [language]
    );
}

const LANGUAGE_NAMES: Record<Language, Record<string, string>> = {
    uk: {
        instrumental: "Інструментал",
        uk: "Українська",
        en: "Англійська",
        pl: "Польська",
        de: "Німецька",
        fr: "Французька",
        es: "Іспанська",
        it: "Італійська",
        ja: "Японська",
        ko: "Корейська",
        pt: "Португальська",
        ru: "Російська",
    },
    en: {
        instrumental: "Instrumental",
        uk: "Ukrainian",
        en: "English",
        pl: "Polish",
        de: "German",
        fr: "French",
        es: "Spanish",
        it: "Italian",
        ja: "Japanese",
        ko: "Korean",
        pt: "Portuguese",
        ru: "Russian",
    },
};

const VALUE_LABELS: Record<Language, Record<string, string>> = {
    uk: {
        energetic: "енергійний",
        happy: "радісний",
        calm: "спокійний",
        sad: "сумний",
        romantic: "романтичний",
        aggressive: "агресивний",
        dark: "похмурий",
        male: "чоловічий вокал",
        female: "жіночий вокал",
        rap: "реп",
        love: "кохання",
        heartbreak: "розставання",
        party: "вечірка",
        friendship: "дружба",
        freedom: "свобода",
        struggle: "боротьба",
        war: "війна",
        homeland: "батьківщина",
        nature: "природа",
        nostalgia: "ностальгія",
        success: "успіх",
        faith: "віра",
        society: "суспільство",
        loneliness: "самотність",
        "self-confidence": "впевненість",
    },
    en: {},
};

/** Human-readable label of a tag value (mood, theme, language code…). */
export function useValueLabel() {
    const language = useSettingsStore((s) => s.language);
    return useCallback(
        (value: string | undefined): string => {
            if (!value) return "";
            return LANGUAGE_NAMES[language][value] ?? VALUE_LABELS[language][value] ?? value;
        },
        [language]
    );
}
