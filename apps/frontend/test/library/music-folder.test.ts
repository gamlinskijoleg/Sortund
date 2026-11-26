import { isInMusicFolder, pathFromUri } from "../../src/library/music-folder";

describe("isInMusicFolder", () => {
    it("accepts files directly in Music", () => {
        expect(isInMusicFolder("file:///storage/emulated/0/Music/song.mp3")).toBe(true);
    });

    it("accepts files in subfolders of Music", () => {
        expect(isInMusicFolder("file:///storage/emulated/0/Music/Telegram%20Music/a.mp3")).toBe(
            true
        );
        expect(isInMusicFolder("/storage/emulated/0/Music/Rock/2010/b.flac")).toBe(true);
    });

    it("accepts the Music folder of an SD card and of another user profile", () => {
        expect(isInMusicFolder("file:///storage/1A2B-3C4D/Music/c.ogg")).toBe(true);
        expect(isInMusicFolder("file:///storage/emulated/10/music/d.m4a")).toBe(true);
    });

    it("rejects other folders, including nested folders named Music", () => {
        expect(isInMusicFolder("file:///storage/emulated/0/Download/Music/e.mp3")).toBe(false);
        expect(isInMusicFolder("file:///storage/emulated/0/Recordings/f.m4a")).toBe(false);
        expect(isInMusicFolder("file:///storage/emulated/0/Musical/g.mp3")).toBe(false);
    });
});

describe("pathFromUri", () => {
    it("strips the scheme and decodes the path", () => {
        expect(pathFromUri("file:///storage/emulated/0/Music/A%20B.mp3")).toBe(
            "/storage/emulated/0/Music/A B.mp3"
        );
    });

    it("keeps paths with an invalid escape as they are", () => {
        expect(pathFromUri("file:///storage/emulated/0/Music/100%.mp3")).toBe(
            "/storage/emulated/0/Music/100%.mp3"
        );
    });
});
