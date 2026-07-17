# Yunora AI Admin Panel

An AI-powered educational assessment admin panel for managing curriculum, standards, question banks, and AI content generation.

## Stack

- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui (`artifacts/yunora-admin`)
- **Backend**: Express.js API server (`artifacts/api-server`)
- **Database**: Firebase Firestore (via `lib/db`)
- **Auth**: JWT + Firebase Auth
- **Shared libs**: `lib/api-spec`, `lib/api-zod`, `lib/api-client-react`, `lib/db`
- **Package manager**: pnpm workspaces

## Running locally

Both services start automatically via the configured workflows:

| Service | Workflow | Port |
|---------|----------|------|
| Frontend | `artifacts/yunora-admin: web` | 25736 |
| API server | `artifacts/api-server: API Server` | 8080 |

## Firebase / Firestore

The API server connects to Firebase Firestore using the `FIREBASE_SERVICE_ACCOUNT_JSON` secret (set in Replit Secrets). This must be the full JSON of a valid service account key for the `kpark-edu` Firebase project.

To get a new key: Firebase Console → kpark-edu → ⚙️ Project settings → Service accounts → Generate new private key.

The `FIREBASE_SERVICE_ACCOUNT_JSON` code path in `lib/db/src/firestore.ts` automatically fixes escaped `\n` in the private key, which can occur when pasting JSON into secrets forms.

## Environment variables

- `FIREBASE_SERVICE_ACCOUNT_JSON` — Firebase Admin SDK service account key JSON (Replit Secret)
- `GOOGLE_APPLICATION_CREDENTIALS` — set to the path of the committed service account key file as a fallback
- `JWT_SECRET`, `GOOGLE_TRANSLATION_API_KEY` — in `artifacts/api-server/.env`

## User preferences
