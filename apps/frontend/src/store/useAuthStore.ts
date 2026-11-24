import { create } from "zustand";
import {
    ApiError,
    NetworkError,
    loadTokens,
    saveTokens,
    setSessionExpiredHandler,
} from "../api/client";
import { authApi, type UserProfile } from "../api/endpoints";
import { log } from "@/utils/logger";

export type AuthErrorCode =
    | "invalidCredentials"
    | "emailTaken"
    | "blocked"
    | "network"
    | "weakPassword"
    | "invalidEmail"
    | "unknown";

interface AuthState {
    user: UserProfile | null;
    status: "unknown" | "signedOut" | "signedIn";
    restore: () => Promise<void>;
    login: (email: string, password: string) => Promise<AuthErrorCode | null>;
    register: (email: string, password: string) => Promise<AuthErrorCode | null>;
    logout: (everywhere?: boolean) => Promise<void>;
    refreshProfile: () => Promise<void>;
}

function toErrorCode(error: unknown): AuthErrorCode {
    if (error instanceof NetworkError) return "network";
    if (error instanceof ApiError) {
        if (error.status === 401) return "invalidCredentials";
        if (error.status === 403) return "blocked";
        if (error.status === 409) return "emailTaken";
        if (error.status === 400)
            return error.message.includes("email") ? "invalidEmail" : "weakPassword";
    }
    return "unknown";
}

let afterLoginHooks: (() => void)[] = [];

/** Callbacks run after sign-in / session restore (push registration, sync, resume polling). */
export function onSignedIn(hook: () => void) {
    afterLoginHooks.push(hook);
    return () => {
        afterLoginHooks = afterLoginHooks.filter((h) => h !== hook);
    };
}

export const useAuthStore = create<AuthState>((set, get) => {
    setSessionExpiredHandler(() => set({ user: null, status: "signedOut" }));

    const finishSignIn = async () => {
        const user = await authApi.me();
        set({ user, status: "signedIn" });
        afterLoginHooks.forEach((hook) => {
            try {
                hook();
            } catch (error) {
                log.warn("After-login hook failed", error);
            }
        });
    };

    return {
        user: null,
        status: "unknown",

        restore: async () => {
            try {
                if (!(await loadTokens())) {
                    set({ status: "signedOut" });
                    return;
                }
                await finishSignIn();
            } catch (error) {
                // Offline start: keep the session, the app works locally.
                if (error instanceof NetworkError) set({ status: "signedIn" });
                else set({ user: null, status: "signedOut" });
            }
        },

        login: async (email, password) => {
            try {
                await saveTokens(await authApi.login(email.trim().toLowerCase(), password));
                await finishSignIn();
                return null;
            } catch (error) {
                return toErrorCode(error);
            }
        },

        // Registration signs the user in immediately (REQ 3).
        register: async (email, password) => {
            try {
                await saveTokens(await authApi.register(email.trim().toLowerCase(), password));
                await finishSignIn();
                return null;
            } catch (error) {
                return toErrorCode(error);
            }
        },

        logout: async (everywhere = false) => {
            try {
                await authApi.setPushToken(null).catch(() => undefined);
                if (everywhere) await authApi.logoutAll();
                else await authApi.logout();
            } catch (error) {
                log.warn("Logout request failed", error);
            }
            await saveTokens(null);
            set({ user: null, status: "signedOut" });
        },

        refreshProfile: async () => {
            if (get().status !== "signedIn") return;
            try {
                set({ user: await authApi.me() });
            } catch (error) {
                log.warn("Profile refresh failed", error);
            }
        },
    };
});

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Client-side check mirroring the server rules (REQ 2). */
export function validateCredentials(email: string, password: string): AuthErrorCode | null {
    if (!EMAIL_RE.test(email.trim())) return "invalidEmail";
    if (
        password.length < 8 ||
        password.length > 72 ||
        !/\p{L}/u.test(password) ||
        !/\d/.test(password)
    ) {
        return "weakPassword";
    }
    return null;
}
