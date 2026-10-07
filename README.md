# Keepsake

A mobile-first PWA scrapbook for couples and friends. React + TypeScript + Vite + Tailwind + Framer Motion.
Everything is stored on the device (IndexedDB via Dexie); there is no backend yet.

## Run

```bash
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
| `src/data/repo.ts` | `Repository` interface + Dexie implementation. **Swap this file for Firebase later.** |
| `src/data/useCanvas.ts` | items, undo/redo, debounced auto-save |
| `src/lib/useGestures.ts` | pointer gestures: drag, pinch, rotate, resize handles, edge auto-scroll |
| `src/components/ThemeEngine.tsx` | category themes, cover palette, floating shapes |
| `src/components/BookCard.tsx` | the leather notebook (`BookCover`) and the home grid card |
| `src/components/Canvas.tsx` | the canvas screen; tools live in `ToolSheet` bottom sheets |
| `src/components/ShareScreen.tsx`, `src/lib/exportImage.tsx` | share screen and long-PNG export |

Item record: `{ id, type, x (% of canvas width), y (px), width, height, rotation, zIndex, props }`.
`x`/`y` are the item's centre.

## Notes

- Place search uses OpenStreetMap Nominatim and routes use the public OSRM demo server (no API keys, light use only).
- Photos are compressed in the browser (max 1400 px, JPEG 0.8) and stored as data URLs in IndexedDB.

## Google sign-in (Firebase Auth)

Sign-in is optional and only adds your name and photo (Settings sheet, book-cover avatars); memories stay local.

1. [Firebase console](https://console.firebase.google.com) → create a project → **Build → Authentication → Get started → Sign-in method → Google → Enable**.
2. **Project settings → Your apps → Web app (`</>`)** → copy the config values.
3. `cp .env.example .env.local` and fill in the four `VITE_FIREBASE_*` values, then restart `npm run dev`.
4. **Authentication → Settings → Authorized domains**: add every host you sign in from. `localhost` is allowed by default.
   Google rejects raw IP addresses (e.g. `192.168.x.x`), so to test on a phone use a tunnel hostname (ngrok / Cloudflare Tunnel)
   and add that hostname here; also add your production domain.
