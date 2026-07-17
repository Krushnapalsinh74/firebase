---
name: Firebase Hosting + Cloud Functions deploy from Replit
description: Three fixes required every time firebase deploy is run from this project
---

# Firebase deploy — required fixes

## The three fixes (all in firebase.json predeploy)

### 1. Empty dependencies in dist/package.json
build.mjs writes `dependencies: {}` in the generated dist/package.json.
**Why:** Cloud Build runs its own `npm install` on the uploaded source. @libsql/client's postinstall tries to download a native binary and crashes Cloud Build with "npm error Exit handler never called!" (network/memory restriction in Cloud Build asia-south1).

### 2. Install @libsql/client locally before upload
Predeploy: `npm install --prefix artifacts/api-server/dist @libsql/client`
**Why:** @libsql/client is externalized from the esbuild bundle (native .node binary can't be bundled). It must be in node_modules when the container starts. Since Replit runs on Linux x64 (same as Cloud Functions), the pre-built binary works without Cloud Build needing to reinstall.

### 3. Delete package-lock.json after local install
Predeploy: `rm -f artifacts/api-server/dist/package-lock.json`
**Why:** npm install on Replit records package URLs pointing to `package-firewall.replit.local` in the lock file. Cloud Build reads the lock file and tries to fetch from that internal Replit URL, which it cannot reach (ENOTFOUND).

## Predeploy sequence (firebase.json)
```
"predeploy": [
  "pnpm --filter @workspace/api-server run build",
  "npm install --prefix artifacts/api-server/dist @libsql/client",
  "rm -f artifacts/api-server/dist/package-lock.json",
  "cp lib/db/yunora.db artifacts/api-server/dist/yunora.db"
]
```

## Deploy command
```
firebase deploy
```
Run from workspace root after `firebase login --no-localhost`.

## Live URLs
- Hosting: https://kpark-edu.web.app
- API function: https://api-ngogm3kh4a-el.a.run.app
- Firebase project: kpark-edu (account: dalalifree.com@gmail.com)
