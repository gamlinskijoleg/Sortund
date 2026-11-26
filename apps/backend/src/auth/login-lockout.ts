/**
 * Per-account protection against password guessing (complements the per-IP rate limit, which an
 * attacker can bypass by changing addresses).
 *
 * The first FREE_ATTEMPTS consecutive failures cost nothing; every further failure locks the
 * account for 1, 2, 4, 8 … minutes, capped at MAX_LOCK_MINUTES. While the account is locked the
 * password is not checked at all, so guesses made during the lock reveal nothing. A successful
 * login resets the counter.
 */
export const FREE_ATTEMPTS = 5;
export const MAX_LOCK_MINUTES = 60;

/** Lock duration after the `failedCount`-th consecutive failure (0 = no lock). */
export function lockDurationMs(failedCount: number): number {
    if (failedCount < FREE_ATTEMPTS) return 0;
    const minutes = Math.min(MAX_LOCK_MINUTES, 2 ** (failedCount - FREE_ATTEMPTS));
    return minutes * 60_000;
}

/** Milliseconds left until the account unlocks (0 = not locked). */
export function remainingLockMs(lockedUntil: Date | null | undefined, now: Date): number {
    if (!lockedUntil) return 0;
    return Math.max(0, lockedUntil.getTime() - now.getTime());
}
