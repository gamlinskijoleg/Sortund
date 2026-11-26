import { isPublicPath } from "../src/common/http/public-surface";
import {
    FREE_ATTEMPTS,
    MAX_LOCK_MINUTES,
    lockDurationMs,
    remainingLockMs,
} from "../src/auth/login-lockout";

describe("isPublicPath", () => {
    it.each([
        "/",
        "/auth/login",
        "/auth/refresh",
        "/AUTH/login",
        "/users/me",
        "/users/me/push-token",
        "/analysis/jobs",
        "/analysis/usage",
        "/sync",
        "/corrections",
        "/auth//login",
    ])("allows %s", (path) => {
        expect(isPublicPath(path)).toBe(true);
    });

    it.each([
        "/admin",
        "/admin/",
        "/admin/index.html",
        "/admin/users",
        "/ADMIN/users",
        "/Admin/users",
        "//admin/users",
        "/api/docs",
        "/api/docs-json",
        "/api/docs/swagger-ui.css",
        "/models",
        "/auth/../admin/users",
        "/auth/./x",
        "/auth/%2e%2e/admin/users",
        "/auth%2fadmin",
        "/auth%2Fadmin",
        "/%61dmin/users",
        "/auth\\..\\admin",
        "admin",
        "",
    ])("blocks %s", (path) => {
        expect(isPublicPath(path)).toBe(false);
    });
});

describe("login lockout", () => {
    it("does not lock before the free attempts are used", () => {
        for (let n = 0; n < FREE_ATTEMPTS; n++) expect(lockDurationMs(n)).toBe(0);
    });

    it("doubles the lock with every further failure", () => {
        expect(lockDurationMs(FREE_ATTEMPTS)).toBe(60_000);
        expect(lockDurationMs(FREE_ATTEMPTS + 1)).toBe(2 * 60_000);
        expect(lockDurationMs(FREE_ATTEMPTS + 3)).toBe(8 * 60_000);
    });

    it("caps the lock", () => {
        expect(lockDurationMs(FREE_ATTEMPTS + 20)).toBe(MAX_LOCK_MINUTES * 60_000);
        expect(lockDurationMs(10_000)).toBe(MAX_LOCK_MINUTES * 60_000);
    });

    it("computes the remaining lock time", () => {
        const now = new Date("2026-01-01T00:00:00Z");
        expect(remainingLockMs(null, now)).toBe(0);
        expect(remainingLockMs(new Date("2025-12-31T23:59:00Z"), now)).toBe(0);
        expect(remainingLockMs(new Date("2026-01-01T00:01:30Z"), now)).toBe(90_000);
    });
});
