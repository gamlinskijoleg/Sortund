import { compareMetrics } from "../src/models/models.service";
import { hashRefreshToken, refreshTokenMatches } from "../src/sessions/sessions.service";
import { incomingWins } from "../src/sync/sync.service";
import { cosineSimilarity, monthBounds } from "../src/analysis/analysis.service";
import type { ModelMetrics } from "../src/models/entities/model-version.entity";

const metrics = (accuracy: number, macro_f1: number): ModelMetrics => ({
    accuracy,
    macro_f1,
    f1_per_genre: {},
    confusion_matrix: [],
    labels: [],
});

describe("compareMetrics (model activation rule, REQ 75)", () => {
    it("allows activation when there is no active model", () => {
        expect(compareMetrics(metrics(0.5, 0.5), null).canActivate).toBe(true);
    });

    it("allows equal or better metrics", () => {
        expect(compareMetrics(metrics(0.8, 0.8), metrics(0.8, 0.8)).canActivate).toBe(true);
        const better = compareMetrics(metrics(0.85, 0.81), metrics(0.8, 0.8));
        expect(better.canActivate).toBe(true);
        expect(better.accuracyDelta).toBeCloseTo(0.05);
    });

    it("refuses when any metric is worse", () => {
        expect(compareMetrics(metrics(0.79, 0.9), metrics(0.8, 0.8)).canActivate).toBe(false);
        expect(compareMetrics(metrics(0.9, 0.79), metrics(0.8, 0.8)).canActivate).toBe(false);
    });

    it("refuses a version without metrics", () => {
        expect(compareMetrics(null, metrics(0.8, 0.8)).canActivate).toBe(false);
    });
});

describe("incomingWins (last write wins, REQ 60)", () => {
    it("accepts new keys", () => expect(incomingWins(5, undefined)).toBe(true));
    it("accepts newer changes", () => expect(incomingWins(10, 5)).toBe(true));
    it("rejects older or equal changes", () => {
        expect(incomingWins(5, 10)).toBe(false);
        expect(incomingWins(5, 5)).toBe(false);
    });
});

describe("cosineSimilarity", () => {
    it("is 1 for identical direction and 0 for orthogonal vectors", () => {
        expect(cosineSimilarity([1, 2, 3], [2, 4, 6])).toBeCloseTo(1);
        expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
    });
    it("handles zero vectors", () => {
        expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
    });
});

describe("monthBounds", () => {
    it("returns the calendar month in UTC", () => {
        const { start, end } = monthBounds(new Date("2026-02-15T10:00:00Z"));
        expect(start.toISOString()).toBe("2026-02-01T00:00:00.000Z");
        expect(end.toISOString()).toBe("2026-03-01T00:00:00.000Z");
    });
    it("rolls over the year", () => {
        const { end } = monthBounds(new Date("2026-12-31T23:00:00Z"));
        expect(end.toISOString()).toBe("2027-01-01T00:00:00.000Z");
    });
});

describe("refresh token hashing", () => {
    // Two JWTs of one session share their first 72+ bytes (header + start of payload).
    const prefix =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTEyMzQtMTIzNC0xMjM0NTY3ODkwMTIi";
    const oldToken = `${prefix}.old-signature`;
    const newToken = `${prefix}.new-signature`;

    it("does not accept a rotated-out token that shares the first 72 bytes", async () => {
        const stored = hashRefreshToken(newToken);
        await expect(refreshTokenMatches(newToken, stored)).resolves.toBe(true);
        await expect(refreshTokenMatches(oldToken, stored)).resolves.toBe(false);
    });
});
