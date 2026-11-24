import { parseId3, readId3Text, writeId3 } from "../../src/library/id3";
import {
    compressedRange,
    concatBytes,
    containerOf,
    flacLayout,
    mp3AudioStart,
    parseWavHeader,
    wavDataLength,
    wavFragment,
} from "../../src/analysis/fragment";

const audio = new Uint8Array([0xff, 0xfb, 0x90, 0x00, 1, 2, 3, 4, 5]);

describe("ID3 writer", () => {
    it("adds a tag to a file without one", () => {
        const out = writeId3(audio, {
            title: "Пісня",
            artist: "Гурт",
            album: "LP",
            year: 2024,
            genre: "rock",
            mood: "calm",
            tags: ["a", "b"],
        });
        const text = readId3Text(out);
        expect(text.TIT2).toBe("Пісня");
        expect(text.TPE1).toBe("Гурт");
        expect(text.TYER).toBe("2024");
        expect(text["TXXX:MOOD"]).toBe("calm");
        expect(text["TXXX:SORTUND_TAGS"]).toBe("a; b");
        const parsed = parseId3(out)!;
        expect(Array.from(out.subarray(parsed.audioStart))).toEqual(Array.from(audio));
    });

    it("replaces managed frames and keeps unknown ones (e.g. cover art)", () => {
        const first = writeId3(audio, { title: "Old", genre: "pop" });
        // Inject a fake APIC frame by building a tag manually through a second write: append frame bytes.
        const parsed = parseId3(first)!;
        const apicBody = [
            0, 0x69, 0x6d, 0x61, 0x67, 0x65, 0x2f, 0x6a, 0x70, 0x67, 0, 3, 0, 9, 9, 9,
        ];
        const apic = new Uint8Array([
            0x41,
            0x50,
            0x49,
            0x43,
            0,
            0,
            0,
            apicBody.length,
            0,
            0,
            ...apicBody,
        ]);
        const frames = concatBytes(...parsed.frames.map((f) => f.bytes), apic);
        const size = frames.length;
        const header = new Uint8Array([
            0x49,
            0x44,
            0x33,
            3,
            0,
            0,
            (size >> 21) & 0x7f,
            (size >> 14) & 0x7f,
            (size >> 7) & 0x7f,
            size & 0x7f,
        ]);
        const withCover = concatBytes(header, frames, audio);

        const out = writeId3(withCover, { title: "New", year: 1999 });
        const text = readId3Text(out);
        expect(text.TIT2).toBe("New");
        expect(text.TCON).toBeUndefined();
        expect(parseId3(out)!.frames.some((f) => f.id === "APIC")).toBe(true);
        expect(Array.from(out.subarray(parseId3(out)!.audioStart))).toEqual(Array.from(audio));
        expect(mp3AudioStart(out)).toBe(parseId3(out)!.audioStart);
    });

    it("keeps v2.4 and uses TDRC for the year", () => {
        const v4 = new Uint8Array([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 0, ...audio]);
        const out = writeId3(v4, { year: 2001 });
        expect(out[3]).toBe(4);
        expect(readId3Text(out).TDRC).toBe("2001");
    });
});

describe("fragment cutting", () => {
    it("detects containers", () => {
        expect(containerOf("a.MP3")).toBe("mp3");
        expect(containerOf("a.m4a")).toBe("m4a");
        expect(containerOf("a.opus")).toBe("ogg");
    });

    it("estimates the byte range of 30 s", () => {
        expect(compressedRange(1_000_000 + 1000, 1000, 300_000)).toEqual({
            start: 1000,
            length: 100_000,
        });
        expect(compressedRange(5000, 0, 20_000)).toEqual({ start: 0, length: 5000 });
    });

    function wav(seconds: number): Uint8Array {
        const byteRate = 8000 * 2;
        const dataSize = byteRate * seconds;
        const out = new Uint8Array(44 + dataSize);
        const dv = new DataView(out.buffer);
        out.set([0x52, 0x49, 0x46, 0x46], 0);
        dv.setUint32(4, 36 + dataSize, true);
        out.set([0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20], 8);
        dv.setUint32(16, 16, true);
        dv.setUint16(20, 1, true);
        dv.setUint16(22, 1, true);
        dv.setUint32(24, 8000, true);
        dv.setUint32(28, byteRate, true);
        dv.setUint16(32, 2, true);
        dv.setUint16(34, 16, true);
        out.set([0x64, 0x61, 0x74, 0x61], 36);
        dv.setUint32(40, dataSize, true);
        return out;
    }

    it("cuts a valid WAV with patched sizes", () => {
        const file = wav(60);
        const layout = parseWavHeader(file.subarray(0, 64))!;
        expect(layout).toEqual({
            headerEnd: 44,
            dataSize: 16000 * 60,
            byteRate: 16000,
            blockAlign: 2,
        });
        const length = wavDataLength(layout);
        expect(length).toBe(16000 * 30);
        const frag = wavFragment(file, layout, file.subarray(44, 44 + length));
        const dv = new DataView(frag.buffer);
        expect(frag.length).toBe(44 + length);
        expect(dv.getUint32(4, true)).toBe(frag.length - 8);
        expect(dv.getUint32(40, true)).toBe(length);
    });

    it("finds FLAC audio start and keeps only STREAMINFO", () => {
        const streamInfo = new Uint8Array(4 + 34);
        streamInfo[0] = 0x00;
        streamInfo[3] = 34;
        const picture = new Uint8Array(4 + 10);
        picture[0] = 0x80 | 6;
        picture[3] = 10;
        const file = concatBytes(
            new Uint8Array([0x66, 0x4c, 0x61, 0x43]),
            streamInfo,
            picture,
            new Uint8Array([0xff, 0xf8])
        );
        const layout = flacLayout(file)!;
        expect(layout.audioStart).toBe(4 + 38 + 14);
        expect(layout.streamInfo[0]).toBe(0x80);
        expect(layout.streamInfo.length).toBe(38);
        expect(flacLayout(new Uint8Array([1, 2, 3, 4]))).toBeNull();
    });
});
