# Sortund

**Sortund** is a mobile music manager that analyses the user's local music library with machine learning
and organises it by genre, mood, language, themes, tempo and key.

## Architecture

```
Mobile app (Expo) ──HTTPS──► Backend (NestJS + PostgreSQL) ──HTTP──► AI worker (FastAPI)
  SQLite library              auth, queue, limits, cache,              fingerprint, Shazam, MusicBrainz,
  player, playlists           sync, admin panel, Swagger               AST + own genre model, Whisper
```

- **Mobile app** (`apps/frontend`) — scans the device's _Music_ folder into local SQLite (works offline),
  plays music, cuts a ≤ 30 s fragment of each track and sends it to the backend for analysis. Search,
  filters, sorting, playlists, smart playlists, statistics and settings all run on the device.
- **Backend** (`apps/backend`) — JWT auth with one-time refresh tokens and per-device sessions, roles,
  monthly analysis limits, a PostgreSQL-backed analysis queue, a result cache keyed by acoustic
  fingerprint + model version, similarity search, cross-device sync, push notifications, the genre-model
  registry and the admin web panel (`/admin`). OpenAPI docs at `/api/docs`.
- **AI worker** (`apps/ai-worker`) — recognises the track (Shazam fingerprint → MusicBrainz / TheAudioDB /
  YouTube Music; file-name parsing as fallback), runs the AST AudioSet tagger, DSP (BPM, key), the **own
  genre classifier** (logistic regression on AST + DSP features, trained on GTZAN), a zero-shot NLI text
  model, LRCLIB lyrics with a Whisper fallback and language detection.

## Analysis flow

1. The app cuts a fragment (MP3/FLAC/Ogg by byte range, WAV with a patched header; M4A is sent whole if
   ≤ 12 MB) and uploads it to `POST /analysis/jobs`. The backend checks the monthly limit and queues it.
2. The queue consumer asks the worker for the fingerprint. If the same recording was already analysed
   with the active model, the cached result is returned and **does not count towards the limit**.
3. Otherwise the worker runs the full pipeline; the result, the embedding and the feature vector are cached.
4. The app polls job statuses (_queued / processing / done / error_); when the user's queue is empty the
   backend sends an Expo push notification.

## Genre model

|                      |                                                                               |
| -------------------- | ----------------------------------------------------------------------------- |
| Features             | 527 AudioSet probabilities (AST, averaged over 3 × 10 s) + 67 DSP descriptors |
| Classifier           | multinomial logistic regression, C = 0.01 (chosen by validation)              |
| Data                 | GTZAN, 999 tracks, 10 genres; fixed stratified 80/20 split                    |
| v1 on the test split | **accuracy 0.88, macro-F1 0.88** (`app/ml/genre_models/v1.json`)              |

GTZAN repeats some artists, so a random split is known to overestimate accuracy on unseen music.

Retraining: users' genre fixes are reviewed in the admin panel; approved ones are added to the training
set and a new version is evaluated on the same test split. A version can be activated only if its accuracy
and macro-F1 are not worse than the active one.

```bash
# rebuild the feature dataset (needs data/genres/<genre>/*.wav) and retrain v1
cd apps/ai-worker
uv run python -m scripts.build_genre_dataset --source data/genres
uv run python -m scripts.train_genre_model --version v1 --tune
```

## Development

```bash
pnpm install
pnpm dev                       # all apps (Turborepo)
pnpm check-types && pnpm lint && pnpm test
```

Environment examples: `apps/backend/.env.example`, `apps/ai-worker/.env.example`,
`apps/frontend/.env.example` (`EXPO_PUBLIC_API_URL` must point to the backend).

The mobile app uses native modules (secure store, notifications, document picker, sharing), so the dev
client must be rebuilt after pulling: `pnpm --filter frontend android`.

Admin access: list the e-mail in `ADMIN_EMAILS` of the backend, register in the app (or sign in) and open
`http://<backend>/admin/`.

## Deployment (GitHub Actions)

| Workflow               | Trigger (push to `main`) | Result                                                                                |
| ---------------------- | ------------------------ | ------------------------------------------------------------------------------------- |
| `release-android.yml`  | `apps/frontend/**`       | Signed release APK published on the **Releases** page (`android-v1.0.<run>`)          |
| `deploy-backend.yml`   | `apps/backend/**`        | Docker image → Docker Hub → `sortund-backend` restarted on the server, health-checked |
| `deploy-ai-worker.yml` | `apps/ai-worker/**`      | Docker image → Docker Hub → `ai-worker` restarted on the server, health-checked       |

Server layout (`olegserver`): containers `sortund-backend`, `sortund-postgres` and `ai-worker` share the
`sortund-net` Docker network; only the backend is public, through Tailscale Funnel
(`https://olegserver.tailc406cc.ts.net`). Runtime secrets are kept on the server in
`~/sortund/{backend,postgres,worker}.env` (chmod 600) and are not stored in GitHub.

APK signing uses the repository secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
`ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD`; without them the APK is signed with the debug key.
The version code is the workflow run number, so each APK installs over the previous one.

See [docs/requirements.md](docs/requirements.md) for how each functional requirement is implemented.
