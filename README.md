# Keepsake

A mobile-first PWA scrapbook for couples and friends. React + TypeScript + Vite + Tailwind + Framer Motion.
Everything is stored on the device (IndexedDB via Dexie); there is no backend yet.

## Layout

```
frontend/   React + Vite PWA (all app code)
backend/    Firebase config + security rules (Auth, Firestore, Storage)
```

## Run

```bash
cd frontend
npm install
npm run dev          # http://<your-LAN-ip>:5173 (reachable from your phone)
npm run dev:https    # same, over HTTPS (self-signed) for Share / clipboard / install on a phone
npm run build && npm run preview   # production build with the service worker
```

On a phone, open the LAN address printed by Vite. Use `dev:https` (accept the certificate warning) if you want
the Web Share API, copy-link fallback, camera and "Add to Home Screen" to behave like production; browsers only
allow those on secure origins.

## Layout

| Path | What |
| --- | --- |
| `frontend/src/data/repo.ts` | `Repository` interface + Dexie implementation. **Swap this file for Firebase later.** |
| `frontend/src/data/useCanvas.ts` | items, undo/redo, debounced auto-save |
| `frontend/src/lib/useGestures.ts` | pointer gestures: drag, pinch, rotate, resize handles, edge auto-scroll |
| `frontend/src/components/ThemeEngine.tsx` | category themes, cover palette, floating shapes |
| `frontend/src/components/BookCard.tsx` | the leather notebook (`BookCover`) and the home grid card |
| `frontend/src/components/Canvas.tsx` | the canvas screen; tools live in `ToolSheet` bottom sheets |
| `frontend/src/components/ShareScreen.tsx`, `frontend/src/lib/exportImage.tsx` | share screen and long-PNG export |

Item record: `{ id, type, x (% of canvas width), y (px), width, height, rotation, zIndex, props }`.
`x`/`y` are the item's centre.

## Notes

- Place search uses OpenStreetMap Nominatim and routes use the public OSRM demo server (no API keys, light use only).
- Photos are compressed in the browser (max 1400 px, JPEG 0.8) and stored as data URLs in IndexedDB.

## Google sign-in (Firebase Auth)

Sign-in is optional and only adds your name and photo (Settings sheet, book-cover avatars); memories stay local.

1. [Firebase console](https://console.firebase.google.com) → create a project → **Build → Authentication → Get started → Sign-in method → Google → Enable**.
2. **Project settings → Your apps → Web app (`</>`)** → copy the config values.
3. `cp frontend/.env.example frontend/.env.local` and fill in the four `VITE_FIREBASE_*` values, then restart `npm run dev`.
4. **Authentication → Settings → Authorized domains**: add every host you sign in from. `localhost` is allowed by default.
   Google rejects raw IP addresses (e.g. `192.168.x.x`), so to test on a phone use a tunnel hostname (ngrok / Cloudflare Tunnel)
   and add that hostname here; also add your production domain.

## Cloud sync (Firestore)

Signed-in users' books sync through Firestore (no Storage needed). One-time setup:

1. Firebase console → **Firestore Database → Rules** → replace everything with the contents of `backend/firestore.rules` → **Publish**.
2. Sign in from Settings. Existing local books upload automatically; Settings shows "Cloud sync on".

Photos are synced as compressed copies inside Firestore (free Spark plan). Full-quality originals need Storage (later).

## Original-quality photos (Supabase Storage)

Signed-in users' photos also upload the untouched original to the private-by-path `originals` bucket (free plan, no card).
Setup: create the bucket, set `VITE_SUPABASE_URL` / `VITE_SUPABASE_KEY` in `frontend/.env.local`, and run `backend/supabase.sql`
in the Supabase SQL Editor. The Frame sheet then shows **Download original quality**.
Later hardening: put uploads behind a Supabase Edge Function that verifies the Firebase ID token.
