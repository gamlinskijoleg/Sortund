import type { MusicTrack, SmartRules } from "../../src/data/types";
import {
    activeFilterCount,
    applyFilters,
    collectFacets,
    emptyFilters,
    matchesQuery,
    sortTracks,
} from "../../src/library/filters";
import { evaluateSmartPlaylist, matchesCondition } from "../../src/library/smart";
import { buildM3U, matchM3UEntries, parseM3U } from "../../src/library/m3u";
import { decadeOf, effectiveTags, syncKey, trackYear } from "../../src/library/track-utils";

const t = (over: Partial<MusicTrack>): MusicTrack => ({
    assetId: over.assetId ?? Math.random().toString(),
    sourceUri: over.sourceUri ?? `file:///music/${over.assetId}.mp3`,
    title: "Song",
    artist: "Artist",
    color: "#000",
    duration: 180000,
    ...over,
});

const lib: MusicTrack[] = [
    t({
        assetId: "1",
        title: "Thunder",
        artist: "AC/DC",
        genre: "rock",
        mood: "energetic",
        year: 1990,
        bpm: 133,
        language: "en",
        tags: ["rock", "Electric guitar"],
        addedAt: 3,
        musicalKey: "E minor",
    }),
    t({
        assetId: "2",
        title: "Stefania",
        artist: "Kalush",
        genre: "hiphop",
        mood: "happy",
        date: "2022",
        bpm: 100,
        language: "uk",
        themes: ["homeland"],
        tags: ["hiphop", "rap"],
        addedAt: 1,
    }),
    t({
        assetId: "3",
        title: "Clair de lune",
        artist: "Debussy",
        genre: "classical",
        mood: "calm",
        year: 1905,
        bpm: 60,
        language: "instrumental",
        tags: ["Piano"],
        addedAt: 2,
        isFavourite: true,
    }),
    t({ assetId: "4", title: "Untagged", artist: "Unknown" }),
];

describe("track utils", () => {
    it("derives year from date and decade", () => {
        expect(trackYear({ date: "2022-05-01" })).toBe(2022);
        expect(trackYear({ year: 1999, date: "2001" })).toBe(1999);
        expect(decadeOf(1987)).toBe("1980s");
    });

    it("combines AI and user tags", () => {
        const tags = effectiveTags(
            [
                { label: "rock", category: "genre", confidence: 0.9 },
                { label: "Piano", category: "instrument", confidence: 0.3 },
            ],
            ["road trip", "ROCK"],
            ["piano"]
        );
        expect(tags).toEqual(["rock", "road trip"]);
    });

    it("builds sync keys", () => {
        expect(syncKey({ fingerprint: "shz:1", artist: "a", title: "b" })).toBe("shz:1");
        expect(syncKey({ artist: "Ác/DC", title: "Thunder!" })).toBe("meta:ac dc|thunder");
    });
});

describe("search, filters and sorting", () => {
    it("searches title, artist, album and tags", () => {
        expect(lib.filter((x) => matchesQuery(x, "kalush")).map((x) => x.assetId)).toEqual(["2"]);
        expect(lib.filter((x) => matchesQuery(x, "guitar")).map((x) => x.assetId)).toEqual(["1"]);
        expect(lib.filter((x) => matchesQuery(x, "")).length).toBe(4);
    });

    it("ORs values within a group and ANDs groups", () => {
        const f = { ...emptyFilters, genres: ["rock", "hiphop"], languages: ["uk"] };
        expect(activeFilterCount(f)).toBe(3);
        expect(applyFilters(lib, f).map((x) => x.assetId)).toEqual(["2"]);
        expect(
            applyFilters(lib, { ...emptyFilters, yearFrom: 1950 }).map((x) => x.assetId)
        ).toEqual(["1", "2"]);
        expect(
            applyFilters(lib, { ...emptyFilters, bpmFrom: 90, bpmTo: 110 }).map((x) => x.assetId)
        ).toEqual(["2"]);
        expect(applyFilters(lib, { ...emptyFilters, themes: ["homeland"] })).toHaveLength(1);
        expect(applyFilters(lib, emptyFilters)).toBe(lib);
    });

    it("sorts with missing values last", () => {
        expect(sortTracks(lib, "year", "asc").map((x) => x.assetId)).toEqual(["3", "1", "2", "4"]);
        expect(sortTracks(lib, "bpm", "desc").map((x) => x.assetId)).toEqual(["1", "2", "3", "4"]);
        expect(sortTracks(lib, "title", "asc")[0]!.title).toBe("Clair de lune");
        expect(sortTracks(lib, "addedAt", "desc").map((x) => x.assetId)).toEqual([
            "1",
            "3",
            "2",
            "4",
        ]);
    });

    it("collects facets", () => {
        const f = collectFacets(lib);
        expect(f.genres.map((g) => g.value)).toEqual(["classical", "hiphop", "rock"]);
        expect(f.years).toEqual({ min: 1905, max: 2022 });
        expect(f.bpm).toEqual({ min: 60, max: 133 });
    });
});

describe("smart playlists", () => {
    it("evaluates nested AND / OR groups with limit and sort", () => {
        const rules: SmartRules = {
            match: "all",
            groups: [
                {
                    match: "any",
                    conditions: [
                        { field: "genre", op: "is", value: "rock" },
                        { field: "mood", op: "is", value: "happy" },
                    ],
                },
                { match: "all", conditions: [{ field: "year", op: "gte", value: 1980 }] },
            ],
        };
        expect(evaluateSmartPlaylist(lib, rules).map((x) => x.assetId)).toEqual(["1", "2"]);
        expect(
            evaluateSmartPlaylist(lib, rules, { sortBy: "year", sortDir: "desc", limit: 1 }).map(
                (x) => x.assetId
            )
        ).toEqual(["2"]);
        expect(
            evaluateSmartPlaylist(lib, { ...rules, match: "any" }).map((x) => x.assetId)
        ).toEqual(["1", "2"]);
    });

    it("supports all operators", () => {
        const track = lib[0]!;
        expect(
            matchesCondition(track, { field: "bpm", op: "between", value: 120, value2: 140 })
        ).toBe(true);
        expect(matchesCondition(track, { field: "tag", op: "contains", value: "guitar" })).toBe(
            true
        );
        expect(matchesCondition(track, { field: "genre", op: "isNot", value: "rock" })).toBe(false);
        expect(matchesCondition(lib[2]!, { field: "favourite", op: "is", value: true })).toBe(true);
        expect(matchesCondition(track, { field: "key", op: "is", value: "e minor" })).toBe(true);
    });

    it("updates automatically when the library changes", () => {
        const rules: SmartRules = {
            match: "all",
            groups: [{ match: "all", conditions: [{ field: "genre", op: "is", value: "jazz" }] }],
        };
        expect(evaluateSmartPlaylist(lib, rules)).toHaveLength(0);
        const updated = [...lib, t({ assetId: "5", genre: "jazz" })];
        expect(evaluateSmartPlaylist(updated, rules).map((x) => x.assetId)).toEqual(["5"]);
    });
});

describe("M3U", () => {
    it("round-trips and matches tracks", () => {
        const tracks = [
            t({
                assetId: "a",
                title: "One",
                artist: "X",
                sourceUri: "file:///storage/Music/One%20Song.mp3",
                duration: 61000,
            }),
            t({
                assetId: "b",
                title: "Two",
                artist: "Y",
                sourceUri: "file:///storage/Music/two.mp3",
            }),
        ];
        const text = buildM3U("My mix", tracks);
        expect(text).toContain("#EXTINF:61,X - One\n/storage/Music/One Song.mp3");
        const parsed = parseM3U(text);
        expect(parsed.name).toBe("My mix");
        expect(parsed.entries[0]).toEqual({
            path: "/storage/Music/One Song.mp3",
            durationSec: 61,
            artist: "X",
            title: "One",
        });
        expect(matchM3UEntries(parsed.entries, tracks).assetIds).toEqual(["a", "b"]);
    });

    it("matches foreign playlists by file name and by artist - title", () => {
        const tracks = [
            t({
                assetId: "a",
                title: "One",
                artist: "X",
                sourceUri: "file:///sdcard/Music/one.mp3",
            }),
            t({
                assetId: "b",
                title: "Two",
                artist: "Y",
                sourceUri: "file:///sdcard/Music/zzz.mp3",
            }),
        ];
        const text =
            "#EXTM3U\r\nC:\\Users\\me\\Music\\ONE.mp3\r\n#EXTINF:100,Y - Two\r\nD:/other/name.mp3\r\nmissing.mp3\r\n";
        const result = matchM3UEntries(parseM3U(text).entries, tracks);
        expect(result.assetIds).toEqual(["a", "b"]);
        expect(result.unmatched.map((e) => e.path)).toEqual(["missing.mp3"]);
    });
});
