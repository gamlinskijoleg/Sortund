import * as Application from "expo-application";
import { Directory, File, Paths } from "expo-file-system";
import * as IntentLauncher from "expo-intent-launcher";
import { Platform } from "react-native";
import { create } from "zustand";
import { kvGet, kvSet } from "../data/db";
import { log } from "@/utils/logger";
import { isNewer, parseRelease, type ReleaseInfo } from "./release";

/** GitHub repository whose "latest" release holds the APK built by CI. */
const REPO = process.env.EXPO_PUBLIC_UPDATE_REPO ?? "gamlinskijoleg/Sortund";
const SKIP_KEY = "update.skippedVersionCode";
const FLAG_GRANT_READ_URI_PERMISSION = 1;

type Status = "idle" | "checking" | "available" | "upToDate" | "downloading" | "error";

interface UpdateState {
    status: Status;
    release: ReleaseInfo | null;
    progress: number;
    error: string | null;
    /** Whether the update dialog is shown. */
    visible: boolean;
    check: (options?: { manual?: boolean }) => Promise<void>;
    install: () => Promise<void>;
    dismiss: (skipThisVersion?: boolean) => void;
}

export function installedVersion(): { name: string; code: string | null } {
    return {
        name: Application.nativeApplicationVersion ?? "dev",
        code: Application.nativeBuildVersion,
    };
}

async function fetchLatestRelease(): Promise<ReleaseInfo | null> {
    const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
        headers: { Accept: "application/vnd.github+json" },
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`GitHub responded ${response.status}`);
    return parseRelease((await response.json()) as Parameters<typeof parseRelease>[0]);
}

/**
 * In-app updater: compares the installed versionCode with the latest GitHub release and, on
 * confirmation, downloads the APK and opens the system installer (the user confirms it there).
 */
export const useUpdateStore = create<UpdateState>((set, get) => ({
    status: "idle",
    release: null,
    progress: 0,
    error: null,
    visible: false,

    check: async ({ manual = false } = {}) => {
        if (
            Platform.OS !== "android" ||
            get().status === "checking" ||
            get().status === "downloading"
        ) {
            return;
        }
        set({ status: "checking", error: null });
        try {
            const release = await fetchLatestRelease();
            const { code } = installedVersion();
            if (!release || !isNewer(release, code)) {
                set({ status: "upToDate", release, visible: manual });
                return;
            }
            // Automatic checks respect "skip this version"; a manual check always shows it.
            const skipped = Number(kvGet(SKIP_KEY) ?? 0);
            set({
                status: "available",
                release,
                visible: manual || release.versionCode !== skipped,
            });
        } catch (error) {
            log.warn("Update check failed", error);
            set({ status: "error", error: String(error), visible: manual });
        }
    },

    install: async () => {
        const { release } = get();
        if (!release) return;
        set({ status: "downloading", progress: 0, error: null });
        try {
            const dir = new Directory(Paths.cache, "updates");
            if (dir.exists) dir.delete();
            dir.create({ intermediates: true });
            const target = new File(dir, `Sortund-${release.versionName}.apk`);

            const task = File.createDownloadTask(release.apkUrl, target, {
                onProgress: ({ bytesWritten, totalBytes }) => {
                    const total = totalBytes > 0 ? totalBytes : release.sizeBytes;
                    if (total > 0) set({ progress: Math.min(1, bytesWritten / total) });
                },
            });
            const file = await task.downloadAsync();
            if (!file) throw new Error("Download was cancelled");

            await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
                data: file.contentUri,
                type: "application/vnd.android.package-archive",
                flags: FLAG_GRANT_READ_URI_PERMISSION,
            });
            // The installer is now in front; if the user cancels it the dialog can be reopened.
            set({ status: "available", progress: 1 });
        } catch (error) {
            log.warn("Update install failed", error);
            set({ status: "error", error: error instanceof Error ? error.message : String(error) });
        }
    },

    dismiss: (skipThisVersion = false) => {
        const { release } = get();
        if (skipThisVersion && release) kvSet(SKIP_KEY, String(release.versionCode));
        set({ visible: false, status: get().status === "downloading" ? "downloading" : "idle" });
    },
}));
