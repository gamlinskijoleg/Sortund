/**
 * What the internet-facing port (Tailscale Funnel) may serve. Everything else — the admin API and
 * panel (`/admin`), Swagger (`/api/docs`) and any future internal route — is only reachable on the
 * admin port, which is published to the tailnet only.
 *
 * It is an allowlist on purpose: a new internal controller is private by default.
 */
export const PUBLIC_ROUTE_PREFIXES = ["auth", "users", "analysis", "sync", "corrections"] as const;

/**
 * True when `path` (the URL path without the query string) may be served on the public port.
 * Paths that try to confuse routing (dot segments, encoded slashes or dots, backslashes) are
 * rejected instead of being interpreted.
 */
export function isPublicPath(path: string): boolean {
    if (!path.startsWith("/")) return false;
    if (/\\|%2f|%5c|%2e|\/\.\.?(\/|$)/i.test(path)) return false;

    const segments = path.split("/").filter(Boolean);
    if (segments.length === 0) return true; // "/" is the health check
    const first = segments[0]!.toLowerCase();
    return (PUBLIC_ROUTE_PREFIXES as readonly string[]).includes(first);
}
