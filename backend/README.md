# Backend (Firebase)

There is no server code to run: the backend is Firebase (Auth, Firestore, Storage).
This folder holds its configuration.

| File | Purpose |
| --- | --- |
| `firebase.json`, `.firebaserc` | Firebase CLI config (project `memory-tale`) |
| `firestore.rules` | Who can read/write memories and canvas items (draft) |
| `storage.rules` | Who can read/write photos (draft) |
| `firestore.indexes.json` | Query indexes (none yet) |

Deploy the rules once sync is built:

```bash
npm i -g firebase-tools
firebase login
cd backend && firebase deploy --only firestore:rules,storage
```

Later, server-side code (e.g. Cloud Functions for invite links) would go in `backend/functions/`.
