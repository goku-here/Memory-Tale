import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore } from 'firebase/firestore'

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
}

/** true once the VITE_FIREBASE_* values are present in .env.local */
export const firebaseConfigured = Boolean(cfg.apiKey && cfg.authDomain && cfg.projectId && cfg.appId)

let app: FirebaseApp | null = null
let auth: Auth | null = null
let fs: Firestore | null = null

export function getFirebaseAuth(): Auth | null {
  if (!firebaseConfigured) return null
  if (!app) {
    app = initializeApp(cfg as Required<typeof cfg>)
    auth = getAuth(app)
  }
  return auth
}

/** Firestore with an offline cache, so edits made without a connection sync later. */
export function getDb(): Firestore | null {
  if (!firebaseConfigured) return null
  getFirebaseAuth() // makes sure the app is initialised
  if (!fs && app) {
    fs = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })
  }
  return fs
}

export const googleProvider = () => {
  const p = new GoogleAuthProvider()
  p.setCustomParameters({ prompt: 'select_account' })
  return p
}
