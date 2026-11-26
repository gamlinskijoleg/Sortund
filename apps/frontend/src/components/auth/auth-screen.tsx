import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import Animated, {
    Easing,
    FadeIn,
    FadeInDown,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withTiming,
} from "react-native-reanimated";
import { AppScreen } from "../app-screen";
import { AppButton, Field } from "../ui/primitives";
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
    tooManyAttempts: "auth.tooManyAttempts",
    unknown: "common.error",
};

function WaveBar({ delay }: { delay: number }) {
    const theme = useAppTheme();
    const h = useSharedValue(10);
    useEffect(() => {
        h.value = withDelay(
            delay,
            withRepeat(
                withSequence(
                    withTiming(44, { duration: 600, easing: Easing.inOut(Easing.quad) }),
                    withTiming(10, { duration: 600, easing: Easing.inOut(Easing.quad) })
                ),
                -1
            )
        );
    }, [delay, h]);
    const style = useAnimatedStyle(() => ({
        height: h.value,
        opacity: 0.4 + (h.value / 44) * 0.6,
    }));
    return (
        <Animated.View
            style={[{ width: 5, borderRadius: 3, backgroundColor: theme.text }, style]}
        />
    );
}

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

    const leave = () => (router.canGoBack() ? router.back() : router.replace("/"));

    return (
        <AppScreen>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.brand}>
                        <View
                            style={styles.wave}
                            accessibilityElementsHidden
                            importantForAccessibility="no-hide-descendants"
                        >
                            {[0, 150, 300, 450, 600, 750].map((d) => (
                                <WaveBar key={d} delay={d} />
                            ))}
                        </View>
                        <Text style={[styles.logo, { color: theme.text }]}>Sortund</Text>
                        <Animated.Text
                            key={mode}
                            entering={FadeIn.duration(250)}
                            style={{
                                color: theme.textMuted,
                                fontSize: 15,
                                lineHeight: 22,
                                marginTop: 6,
                            }}
                        >
                            {t(isRegister ? "auth.registerTagline" : "auth.loginTagline")}
                        </Animated.Text>
                    </View>

                    <Animated.View
                        key={`f${mode}`}
                        entering={FadeInDown.duration(300)}
                        style={{ gap: 14 }}
                    >
                        <Field
                            label={t("auth.email")}
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            autoComplete="email"
                            keyboardType="email-address"
                            textContentType="emailAddress"
                        />
                        <View style={{ gap: 6 }}>
                            <Field
                                label={t("auth.password")}
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                                autoComplete={isRegister ? "new-password" : "current-password"}
                                textContentType={isRegister ? "newPassword" : "password"}
                            />
                            {isRegister && (
                                <Text style={{ color: theme.textSubtle, fontSize: 12 }}>
                                    {t("auth.passwordHint")}
                                </Text>
                            )}
                        </View>
                        {isRegister && (
                            <Field
                                label={t("auth.passwordRepeat")}
                                value={repeat}
                                onChangeText={setRepeat}
                                secureTextEntry
                                autoComplete="new-password"
                            />
                        )}
                        {error && (
                            <Animated.View
                                entering={FadeIn}
                                accessibilityRole="alert"
                                accessibilityLiveRegion="polite"
                                style={styles.error}
                            >
                                <MaterialCommunityIcons
                                    name="alert-circle-outline"
                                    size={16}
                                    color={theme.text}
                                />
                                <Text style={{ color: theme.text, fontSize: 14, flex: 1 }}>
                                    {error}
                                </Text>
                            </Animated.View>
                        )}
                        <AppButton
                            label={t(isRegister ? "auth.register" : "auth.login")}
                            loading={busy}
                            onPress={() => void submit()}
                            style={{ marginTop: 6 }}
                        />
                    </Animated.View>

                    <View style={styles.switch}>
                        <Text style={{ color: theme.textMuted, fontSize: 14 }}>
                            {t(isRegister ? "auth.haveAccountQ" : "auth.noAccountQ")}
                        </Text>
                        <Pressable
                            accessibilityRole="link"
                            hitSlop={10}
                            onPress={() =>
                                router.replace(isRegister ? "/auth/login" : "/auth/register")
                            }
                        >
                            <Text style={{ color: theme.text, fontWeight: "700", fontSize: 14 }}>
                                {t(isRegister ? "auth.login" : "auth.registerShort")}
                            </Text>
                        </Pressable>
                    </View>

                    <View style={{ flex: 1 }} />
                    <Pressable accessibilityRole="button" onPress={leave} style={styles.skip}>
                        <Text style={{ color: theme.textSubtle, fontSize: 14 }}>
                            {t("auth.skip")}
                        </Text>
                    </Pressable>
                </ScrollView>
            </KeyboardAvoidingView>
        </AppScreen>
    );
}

const styles = StyleSheet.create({
    content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 56, gap: 32 },
    brand: { gap: 4 },
    wave: { flexDirection: "row", alignItems: "center", gap: 4, height: 48, marginBottom: 14 },
    logo: { fontSize: 36, fontWeight: "800", letterSpacing: -1.4 },
    error: { flexDirection: "row", alignItems: "center", gap: 8 },
    switch: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: 6,
        marginTop: -10,
    },
    skip: { height: 48, alignItems: "center", justifyContent: "center", marginBottom: 12 },
});
