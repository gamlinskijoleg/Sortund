"""Decide which parts of the monorepo a push touches (used by .github/workflows/pipeline.yml).

Usage: detect-changes.py <base-sha> <head-sha>
Writes `frontend=`, `backend=`, `worker=` (true/false) to $GITHUB_OUTPUT (or prints them).

pnpm-lock.yaml is shared by all JS apps, so instead of "lockfile changed → rebuild everything" we
compare the lockfile's `importers` blocks: a backend-only dependency change must not ship a new APK
(phones would be offered an "update" that changes nothing) and vice versa. If only the shared
`packages:`/`snapshots:` sections changed (e.g. a transitive bump), we cannot tell who is affected
and conservatively mark every JS app as changed.
"""

import os
import re
import subprocess
import sys

ALL = ("frontend", "backend", "worker")
WORKFLOW = ".github/workflows/pipeline.yml"
SCRIPT = ".github/scripts/detect-changes.py"

# Path prefixes (or exact files) that affect each target.
PATHS = {
    "frontend": ("apps/frontend/", "packages/", "pnpm-workspace.yaml"),
    "backend": (
        "apps/backend/",
        "packages/",
        "pnpm-workspace.yaml",
        "tsconfig.base.json",
    ),
    "worker": ("apps/ai-worker/",),
}
# Lockfile importers that affect each JS target ("." is the root package.json).
IMPORTERS = {
    "frontend": ("apps/frontend", "."),
    "backend": ("apps/backend", "."),
}


def git(*args: str) -> str:
    return subprocess.run(
        ["git", *args], check=True, capture_output=True, text=True
    ).stdout


def lockfile_at(sha: str) -> str:
    try:
        return git("show", f"{sha}:pnpm-lock.yaml")
    except subprocess.CalledProcessError:
        return ""


def split_lockfile(text: str) -> tuple[dict[str, str], str]:
    """Return ({importer: block text}, everything outside `importers:`)."""
    importers: dict[str, list[str]] = {}
    rest: list[str] = []
    section = None
    current = None
    for line in text.splitlines():
        if line and not line[0].isspace():  # top-level key
            section = line.rstrip(":")
            current = None
            rest.append(line)
            continue
        if section == "importers":
            m = re.match(r"^  (\S[^:]*):\s*$", line)
            if m:
                current = m.group(1).strip("'\"")
                importers[current] = []
            elif current is not None:
                importers[current].append(line)
        else:
            rest.append(line)
    return {k: "\n".join(v) for k, v in importers.items()}, "\n".join(rest)


def detect(base: str, head: str) -> dict[str, bool]:
    if not base or set(base) == {"0"}:
        return dict.fromkeys(ALL, True)
    try:
        git("cat-file", "-e", f"{base}^{{commit}}")
    except subprocess.CalledProcessError:  # base not available (force push etc.)
        return dict.fromkeys(ALL, True)

    files = [f for f in git("diff", "--name-only", base, head).splitlines() if f]
    if WORKFLOW in files or SCRIPT in files:
        return dict.fromkeys(ALL, True)

    result = {
        t: any(f.startswith(PATHS[t]) or f in PATHS[t] for f in files) for t in ALL
    }

    if "pnpm-lock.yaml" in files:
        old_imp, old_rest = split_lockfile(lockfile_at(base))
        new_imp, new_rest = split_lockfile(lockfile_at(head))
        changed = {
            k
            for k in old_imp.keys() | new_imp.keys()
            if old_imp.get(k) != new_imp.get(k)
        }
        shared = any(k.startswith("packages/") for k in changed)
        for target, names in IMPORTERS.items():
            if shared or changed & set(names):
                result[target] = True
        if not changed and old_rest != new_rest:
            for target in IMPORTERS:
                result[target] = True
    return result


def main() -> None:
    base, head = (sys.argv[1:3] + ["", ""])[:2]
    result = detect(base, head or "HEAD")
    lines = [f"{k}={'true' if v else 'false'}" for k, v in result.items()]
    print("\n".join(lines))
    out = os.environ.get("GITHUB_OUTPUT")
    if out:
        with open(out, "a", encoding="utf-8") as fh:
            fh.write("\n".join(lines) + "\n")


if __name__ == "__main__":
    main()
