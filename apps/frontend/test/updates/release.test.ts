import { formatMegabytes, isNewer, parseRelease, shortNotes } from "../../src/updates/release";

const githubRelease = {
    tag_name: "android-v1.0.42",
    body: "Android APK built from abc123.\n\n**feat: smart playlists**\n\nDownload `Sortund-1.0.42.apk` on the phone",
    published_at: "2026-11-24T18:00:00Z",
    assets: [
        { name: "notes.txt", browser_download_url: "https://x/notes.txt", size: 10 },
        {
            name: "Sortund-1.0.42.apk",
            browser_download_url: "https://x/Sortund-1.0.42.apk",
            size: 42_000_000,
        },
    ],
};

describe("in-app updater: releases", () => {
    it("parses the CI release tag and picks the APK asset", () => {
        expect(parseRelease(githubRelease)).toEqual({
            versionCode: 42,
            versionName: "1.0.42",
            apkUrl: "https://x/Sortund-1.0.42.apk",
            sizeBytes: 42_000_000,
            notes: githubRelease.body,
            publishedAt: "2026-11-24T18:00:00Z",
        });
    });

    it("ignores other tags, drafts, prereleases and releases without an APK", () => {
        expect(parseRelease({ ...githubRelease, tag_name: "v2.0" })).toBeNull();
        expect(parseRelease({ ...githubRelease, draft: true })).toBeNull();
        expect(parseRelease({ ...githubRelease, prerelease: true })).toBeNull();
        expect(parseRelease({ ...githubRelease, assets: [] })).toBeNull();
    });

    it("compares with the installed versionCode", () => {
        const release = parseRelease(githubRelease)!;
        expect(isNewer(release, "41")).toBe(true);
        expect(isNewer(release, 42)).toBe(false);
        expect(isNewer(release, "50")).toBe(false);
        // Unknown installed version (e.g. development build) never prompts.
        expect(isNewer(release, null)).toBe(false);
        expect(isNewer(release, "abc")).toBe(false);
    });

    it("extracts readable notes", () => {
        expect(shortNotes(githubRelease.body)).toBe("feat: smart playlists");
        expect(shortNotes("a".repeat(300), 10)).toBe("aaaaaaaaa…");
        expect(formatMegabytes(42_000_000)).toBe("40.1 MB");
    });
});
