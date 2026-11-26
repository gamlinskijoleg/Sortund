import type { MusicTrack } from "../../src/data/types";
import {
    audioSignature,
    findDuplicates,
    folderOf,
    hashBytes,
    id3v1Length,
} from "../../src/library/duplicates";

const track = (assetId: string, path: string, contentHash?: string, addedAt = 0): MusicTrack => ({
    assetId,
    sourceUri: `file:///storage/emulated/0/${path}`,
    title: assetId,
    artist: "",
    color: "#000",
    duration: 0,
    contentHash,
    addedAt,
});

describe("hashBytes", () => {
    it("is stable and sensitive to content", () => {
        const a = new Uint8Array([1, 2, 3]);
        expect(hashBytes(a)).toBe(hashBytes(new Uint8Array([1, 2, 3])));
        expect(hashBytes(a)).not.toBe(hashBytes(new Uint8Array([1, 2, 4])));
        expect(hashBytes(a)).toMatch(/^[0-9a-f]{16}$/);
    });

    it("builds a signature from length and both ends", () => {
        const s = audioSignature(10, new Uint8Array([1]), new Uint8Array([2]));
        expect(s.startsWith("10:")).toBe(true);
        expect(s).not.toBe(audioSignature(11, new Uint8Array([1]), new Uint8Array([2])));
    });
});

describe("id3v1Length", () => {
    it("detects a trailing ID3v1 tag", () => {
        const bytes = new Uint8Array(200);
        bytes.set([0x54, 0x41, 0x47], 72);
        expect(id3v1Length(bytes)).toBe(128);
        expect(id3v1Length(new Uint8Array(200))).toBe(0);
        expect(id3v1Length(new Uint8Array(10))).toBe(0);
    });
});

describe("folderOf", () => {
    it("returns the folder relative to the storage root", () => {
        expect(folderOf("file:///storage/emulated/0/Music/Telegram%20Music/a.mp3")).toBe(
            "Music/Telegram Music"
        );
        expect(folderOf("file:///storage/1A2B-3C4D/Music/a.mp3")).toBe("Music");
    });
});

describe("findDuplicates", () => {
    it("keeps unique tracks and tracks without a signature", () => {
        const tracks = [track("a", "Music/a.mp3", "x"), track("b", "Music/b.mp3")];
        const result = findDuplicates(tracks);
        expect(result.visible).toEqual(tracks);
        expect(result.groups).toHaveLength(0);
    });

    it("shows the copy closest to the Music root and hides the others", () => {
        const deep = track("deep", "Music/Telegram Music/song (1).mp3", "x");
        const root = track("root", "Music/song.mp3", "x", 5);
        const other = track("other", "Music/other.mp3", "y");
        const { visible, groups } = findDuplicates([deep, other, root]);
        expect(visible.map((t) => t.assetId)).toEqual(["other", "root"]);
        expect(groups).toHaveLength(1);
        expect(groups[0]!.primary.assetId).toBe("root");
        expect(groups[0]!.copies.map((t) => t.assetId)).toEqual(["root", "deep"]);
    });

    it("prefers the earlier added copy in the same folder depth", () => {
        const late = track("late", "Music/a.mp3", "x", 20);
        const early = track("early", "Music/b.mp3", "x", 10);
        expect(findDuplicates([late, early]).groups[0]!.primary.assetId).toBe("early");
    });
});
