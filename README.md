# Sortund

**Sortund** is an innovative mobile music manager that uses AI to automatically tag and organize your local media library. Forget about messy tracks — we analyze music on your device and structure it by genres, mood, and other parameters.

## Project Architecture

The project is built on the principles of a monorepo and microservices architecture.

- **Frontend (Expo/React Native):** Client-side application that works with the device's media library and a local database (SQLite).
- **Backend (NestJS):** Central API for authorization, profile synchronization, and user data management.
- **AI Worker (FastAPI on Hugging Face):** Service for audio classification based on neural networks.

## Key Components

### 1. Mobile Client (Expo)

- **Local-First:** All music data is stored in local SQLite.
- **Scan Engine:** Uses `expo-media-library` and `react-native-audio-metadata` for scanning and background analysis.
- **Smart Upload:** Sends only compressed audio fragments (30 sec) to minimize user traffic.

### 2. AI Service (FastAPI @ Hugging Face)

- **On-Demand Processing:** Analyzes audio fragments via `multipart/form-data` requests.
- **Stateless:** Does not store user files; processing occurs in memory (RAM).
- **Scalable:** Easily scalable and replaceable with more powerful models without client-side changes.

### 3. Backend (NestJS)

- **Auth & Data:** Account management and metadata storage.
- **Orchestrator:** Coordinates requests between the mobile app and the AI worker.

---

## Tech Stack

- **Monorepo:** Turborepo
- **Frontend:** Expo, React Native, TypeScript, SQLite
- **Backend:** NestJS, PostgreSQL (via Render)
- **AI:** FastAPI, Python, Hugging Face models

---

## How Scanning Works

1. **Scanning:** User uploads a track.
2. **Analysis:** The app selects track fragments and sends them to the AI worker.
3. **Storage:** The received tags are written to the local DB.
4. **Offline:** After the first scan, the app works entirely offline.

---

## Development Setup

```bash
# Install dependencies
npm install

# Run entire project (Turborepo)
npm run dev

# Run specific worker
turbo run dev --filter=ai-worker

```

---

_Created using the "Serverless AI Inference" architectural approach._

---
