import { router } from "expo-router";
import React, { useState } from "react";
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { AppScreen } from "../app-screen";
import { PageHeader } from "../shared/page-header";
import { AppButton, Field, Notice } from "../ui/primitives";
import { useT, type TranslationKey } from "../../i18n";
import { useAuthStore, validateCredentials, type AuthErrorCode } from "../../store/useAuthStore";
import { useAppTheme } from "../../theme/app-theme";

const ERROR_KEYS: Record<AuthErrorCode, TranslationKey> = {
    invalidCredentials: "auth.invalidCredentials",
    emailTaken: "auth.emailTaken",
    blocked: "auth.blocked",
    network: "auth.network",
    weakPassword: "auth.weakPassword",
    invalidEmail: "auth.invalidEmail",
    unknown: "common.error",
};

/** Sign-in and registration (REQ 1–6). */
export default function AuthScreen({ mode }: { mode: "login" | "register" }) {
    const t = useT();
    const theme = useAppTheme();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [repeat, setRepeat] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const isRegister = mode === "register";

    const submit = async () => {
        setError(null);
        if (isRegister) {
            const invalid = validateCredentials(email, password);
            if (invalid) return setError(t(ERROR_KEYS[invalid]));
            if (password !== repeat) return setError(t("auth.passwordsMismatch"));
        } else if (!email.trim() || !password) {
            return setError(t("auth.invalidCredentials"));
        }
        setBusy(true);
        const store = useAuthStore.getState();
        const code = isRegister
            ? await store.register(email, password)
            : await store.login(email, password);
        setBusy(false);
        if (code) setError(t(ERROR_KEYS[code]));
        else if (router.canGoBack()) router.back();
        else router.replace("/");
    };

    return (
        <AppScreen>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <ScrollView
                    contentContainerStyle={{ padding: 20, gap: 14 }}
                    keyboardShouldPersistTaps="handled"
                >
                    <PageHeader title={t(isRegister ? "auth.register" : "auth.login")} />
                    <Field
                        label={t("auth.email")}
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        autoComplete="email"
                        keyboardType="email-address"
                        textContentType="emailAddress"
                    />
                    <Field
                        label={t("auth.password")}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        autoComplete={isRegister ? "new-password" : "current-password"}
                        textContentType={isRegister ? "newPassword" : "password"}
                    />
                    {isRegister && (
                        <>
                            <Field
                                label={t("auth.passwordRepeat")}
                                value={repeat}
                                onChangeText={setRepeat}
                                secureTextEntry
                                autoComplete="new-password"
                            />
                            <Text style={{ color: theme.textSubtle, fontSize: 12 }}>
                                {t("auth.passwordHint")}
                            </Text>
                        </>
                    )}
                    {error && <Notice tone="error" text={error} />}
                    <AppButton
                        label={t(isRegister ? "auth.register" : "auth.login")}
                        loading={busy}
                        onPress={() => void submit()}
                    />
                    <Pressable
                        accessibilityRole="link"
                        onPress={() =>
                            router.replace(isRegister ? "/auth/login" : "/auth/register")
                        }
                        style={styles.switch}
                    >
                        <Text style={{ color: theme.accent, fontWeight: "600" }}>
                            {t(isRegister ? "auth.haveAccount" : "auth.noAccount")}
                        </Text>
                    </Pressable>
                    <View />
                </ScrollView>
            </KeyboardAvoidingView>
        </AppScreen>
    );
}

const styles = StyleSheet.create({ switch: { alignItems: "center", paddingVertical: 12 } });
