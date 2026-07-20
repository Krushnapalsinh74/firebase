---
name: Firebase Hosting + Cloud Functions deploy from Replit
description: How to deploy this project to Firebase from Replit, including the clock-skew workaround
---

# Firebase deploy

## Clock skew — MUST deploy from local machine
Replit's system clock runs ~9 minutes fast. `firebase deploy` uses a service-account JWT
for auth; Google rejects it with `invalid_grant: Invalid JWT Signature` because the `iat`
claim appears to be in the future. **Cannot be fixed on Replit** (clock cannot be set, gcloud not available).

**Workaround:** run `firebase deploy` from a local machine (correct clock) using the service account file
or after `firebase login:ci`.

## Predeploy (firebase.json) — current working sequence
```
functions predeploy:
  pnpm --filter @workspace/api-server run build
  npm install --prefix artifacts/api-server/dist firebase-admin
  rm -f artifacts/api-server/dist/package-lock.json
  echo 'FIRESTORE_DATABASE_ID=kp73' > artifacts/api-server/dist/.env

hosting predeploy:
  pnpm --filter @workspace/yunora-admin run build
```

**Why firebase-admin is pre-installed:** build.mjs externalizes `firebase-admin` and
`@google-cloud/firestore` from the esbuild bundle. They must be in `dist/node_modules`
when the Cloud Function container starts. Cloud Build's own npm-install is a no-op
because `dist/package.json` intentionally has `dependencies: {}`.

**Why package-lock.json is deleted:** npm install on Replit records Replit-internal
registry URLs (`package-firewall.replit.local`). Cloud Build cannot reach those URLs.

## Service account file
`kpark-edu-firebase-adminsdk-fbsvc-465cb297c2.json` — in repo root (do not delete).

## Live URLs
- Hosting: https://kpark-edu.web.app
- API function: https://api-ngogm3kh4a-el.a.run.app
- Firebase project: kpark-edu (account: dalalifree.com@gmail.com)
