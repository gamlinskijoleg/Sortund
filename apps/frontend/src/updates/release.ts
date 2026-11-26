/** Pure helpers for the in-app updater (no React Native imports, unit-tested). */

export type ReleaseInfo = {
    versionCode: number;
    versionName: string;
    apkUrl: string;
    sizeBytes: number;
    notes: string;
    publishedAt: string;
};

type GithubRelease = {
    tag_name?: string;
    body?: string | null;
    published_at?: string;
    draft?: boolean;
    prerelease?: boolean;
    assets?: { name: string; browser_download_url: string; size: number }[];
};

/** CI tags releases as `android-v1.0.<versionCode>` (versionCode = workflow run number + 100). */
const TAG_RE = /^android-v(\d+)\.(\d+)\.(\d+)$/;

export function parseRelease(release: GithubRelease): ReleaseInfo | null {
    if (!release.tag_name || release.draft || release.prerelease) return null;
    const match = TAG_RE.exec(release.tag_name);
    if (!match) return null;
    const apk = release.assets?.find((a) => a.name.toLowerCase().endsWith(".apk"));
    if (!apk) return null;
    return {
        versionCode: Number(match[3]),
        versionName: `${match[1]}.${match[2]}.${match[3]}`,
        apkUrl: apk.browser_download_url,
        sizeBytes: apk.size,
        notes: (release.body ?? "").trim(),
        publishedAt: release.published_at ?? "",
    };
}

/** True when the release is newer than the installed build (versionCode as reported by Android). */
export function isNewer(
    release: ReleaseInfo,
    installedVersionCode: string | number | null | undefined
): boolean {
    const installed = Number(installedVersionCode);
    if (!Number.isFinite(installed) || installed <= 0) return false;
    return release.versionCode > installed;
}

/** First non-empty line of the release notes without Markdown emphasis — shown in the dialog. */
export function shortNotes(notes: string, maxLength = 200): string {
    const lines = notes
        .split(/\r?\n/)
        .map((l) => l.replace(/[*_`#>]/g, "").trim())
        .filter((l) => l && !/^android apk built from/i.test(l) && !/^download /i.test(l));
    const text = lines.join(" ").replace(/\s+/g, " ");
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

export function formatMegabytes(bytes: number): string {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
