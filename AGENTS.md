# AGENTS.md — rules for coding agents working on Sortund

Sortund is a diploma project: a mobile music manager that analyses a local music library with ML.
Read `README.md` for the architecture and `docs/requirements.md` for how each functional requirement
(REQ 1–77) is implemented. App-specific notes: `apps/frontend/AGENTS.md`.

```
apps/frontend   Expo SDK 58 / React Native app (TypeScript, SQLite, expo-router)
apps/backend    NestJS + PostgreSQL (TypeORM migrations), admin panel in apps/backend/public/admin
apps/ai-worker  FastAPI + ONNX (AST tagger, NLI text model), own genre model, Whisper
packages/*      shared ESLint / Jest config
```

## 1. Versioning — automatic, do not touch

- The APK version is set by CI (`.github/workflows/pipeline.yml`, job `android-build`):
  `1.0.<run number + 100>`, and that number is also the Android `versionCode`. Every build therefore installs over the previous one.
  **Do not** set `android.versionCode` / `expo.version` by hand and do not bump versions in commits.
- Do not change the release tag format `android-vX.Y.Z` (`.github/workflows/pipeline.yml`): the
  in-app updater (`apps/frontend/src/updates/release.ts`) parses it and uses `Z` as the versionCode.
- Genre-model versions (`apps/ai-worker/app/ml/genre_models/vN.*`) are created by training; never
  overwrite an existing `vN`.

## 2. Before committing

```bash
pnpm check-types && pnpm lint && pnpm test      # whole monorepo (Turborepo)
cd apps/ai-worker && uv run black . && uv run pytest
```

- The husky pre-push hook runs all tests; lint-staged formats staged files (Prettier, Black).
- Commit messages: Conventional Commits (`feat(frontend): …`, `fix(backend): …`, `ci: …`).
- **Never** add `Co-Authored-By` or any AI attribution to commits, PRs or files.
- The owner commits straight to `main`. A push to `main` **deploys** (see §6) — do not push unless asked.
- Never commit secrets: `.env`, keystores (`*.jks`), tokens. `apps/ai-worker/data/` (GTZAN) and
  `apps/ai-worker/app/ml/model/` (ONNX models) are git-ignored on purpose.

## 3. Dependencies (pnpm 11, hoisted node_modules)

- Every dependency must be declared in the right `package.json` **and** in `pnpm-lock.yaml`. CI and the
  Docker build use `--frozen-lockfile`; a package that only exists in your local `node_modules`
  compiles locally and breaks the deploy (this already happened with `@types/multer`).
- Add Expo packages with `npx expo install <pkg>` from `apps/frontend` (picks SDK-compatible versions).
- Known Windows glitch: `ERR_PNPM_ENOENT … eslint-module-utils_tmp_*` → delete
  `node_modules/eslint-module-utils*` and run `pnpm install` again; then check that `package.json`
  really contains the new dependency.
- Python: `uv add <pkg>` in `apps/ai-worker` (updates `uv.lock`).

## 4. Frontend rules

- Expo SDK 58 APIs changed a lot — check the installed `.d.ts` files or the v58 docs, not memory.
  File I/O uses the new `expo-file-system` API (`File`, `Directory`, `Paths`); `File.write()` is async —
  use `writeSync` when the file is read right after.
- `android/` is generated (`expo prebuild`) and git-ignored. Native changes go into `app.json` or a config
  plugin in `apps/frontend/plugins/` (e.g. `with-release-signing.js`).
- Adding a native module (anything with Android code) requires a new APK — mention it to the user.
- After adding/renaming routes in `src/app`, typed routes in `.expo/types` are stale; they regenerate on
  `expo start`. CI type-checks without them, so routes must still type-check as plain strings.
- Every UI string goes through `useT()` / `t()`; add the key to **both** `src/i18n/en.ts` and
  `src/i18n/uk.ts` (the Ukrainian dictionary is type-checked against the English keys).
- Colours come from `useAppTheme()` (light/dark/system) — no hard-coded colours in screens.
- Local SQLite schema changes: append a new entry to `MIGRATIONS` in `src/data/db.ts`
  (never edit an existing migration — installed apps have already run it).
- Pure logic (filters, smart playlists, M3U, ID3, fragment cutting, release parsing) lives outside React
  components and has Jest tests in `apps/frontend/test/`; keep it that way.
- The API base URL comes from `EXPO_PUBLIC_API_URL` (build time). Production:
  `https://olegserver.tailc406cc.ts.net` (Tailscale Funnel → backend).

## 5. Backend and AI worker rules

- Backend: `synchronize` is off. Every entity change needs a new migration in
  `apps/backend/src/database/migrations/` (they run automatically on startup).
- New backend env variables: add to `src/config/env.validation.ts`, `apps/backend/.env.example`
  **and** to `~/sortund/backend.env` on the server (otherwise the deployed container fails validation).
  Same for the worker: `app/core/settings.py`, `.env.example`, `~/sortund/worker.env`.
- The worker is called only by the backend (`AI_WORKER_URL`, shared `WORKER_TOKEN`/`AI_WORKER_TOKEN`).
- Analysis results are cached per (fingerprint, genre-model version); changing the result format
  usually means old cache rows lack new fields — handle missing fields on the client.
- Genre model: features are produced by `app/ml/features.py` for both training and inference; if the
  feature vector changes, rebuild `base_dataset.npz` and retrain (`apps/ai-worker/scripts/`) and bump
  the model version. Activation is allowed only if accuracy and macro-F1 are not worse (REQ 75).
- Thresholds in `app/core/settings.py` were calibrated on GTZAN — re-check on real tracks when changing.

## 6. CI/CD and the server

Single workflow `.github/workflows/pipeline.yml` (push to `main`; PRs run only `changes` + `ci`):

| Push to `main` touching                                      | Jobs                                | Result                                                                     |
| ------------------------------------------------------------ | ----------------------------------- | -------------------------------------------------------------------------- |
| anything                                                     | `ci`                                | lint, `black --check`, type-check, tests                                   |
| `apps/frontend/**`, `packages/**`, frontend deps in lockfile | `android-build` → `android-release` | Signed APK → GitHub Releases `android-vX.Y.Z` (in-app updater picks it up) |
| `apps/backend/**`, `packages/**`, backend deps in lockfile   | `backend-build` → `backend-deploy`  | Image `:<sha>` → `sortund-backend` on the server, health-checked           |
| `apps/ai-worker/**`                                          | `worker-build` → `worker-deploy`    | Image `:<sha>` → `ai-worker` on the server, health-checked                 |

- Release/deploy jobs `need: ci` — a red CI means no APK release and no deploy (the APK is still
  attached to the run as an artifact). Change detection: `.github/scripts/detect-changes.py`.
- A deploy whose container fails the health check restarts the previous image (rollback). Backend
  migrations have already run at that point — keep them backward compatible with the previous release.
- Editing `pipeline.yml` or `detect-changes.py` rebuilds and redeploys everything.
- The backend is bound to `127.0.0.1:3000`; the only public entry point is Tailscale Funnel.
- Pin third-party actions that receive secrets (e.g. `appleboy/ssh-action`) to a release SHA.
- Server `olegserver` (SSH alias): containers `sortund-backend`, `sortund-postgres`, `ai-worker` on the
  Docker network `sortund-net`. Runtime secrets: `~/sortund/{backend,postgres,worker}.env` (chmod 600,
  never print their values). ONNX models: `~/sortund/models` (mounted read-only into the worker).
- APK signing key: repository secrets `ANDROID_KEYSTORE_*` / `ANDROID_KEY_*`. **Never replace the key** —
  phones would refuse to update the app.
- Unauthenticated GitHub API calls are limited to 60/hour — poll workflow runs at most every few minutes.

## 7. Documentation

- When a functional requirement changes status or gains a limitation, update `docs/requirements.md`.
- Keep `README.md` in sync with the architecture, deployment and versioning described here.
