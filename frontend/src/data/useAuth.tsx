import { onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut, type User } from 'firebase/auth'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { firebaseConfigured, getFirebaseAuth, googleProvider } from '../lib/firebase'

export interface Profile {
  uid: string
  name: string
  email: string
  photo: string | null
}

interface AuthState {
  configured: boolean
  /** true until Firebase has told us whether someone is signed in */
  loading: boolean
  user: Profile | null
  signIn: () => Promise<Profile | null>
  logOut: () => Promise<void>
}

const Ctx = createContext<AuthState>({
  configured: false, loading: false, user: null, signIn: async () => null, logOut: async () => {},
})

const toProfile = (u: User): Profile => ({
  uid: u.uid, name: u.displayName ?? u.email?.split('@')[0] ?? 'You', email: u.email ?? '', photo: u.photoURL,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(firebaseConfigured)

  useEffect(() => {
    const auth = getFirebaseAuth()
    if (!auth) return
    return onAuthStateChanged(auth, (u) => {
      setUser(u ? toProfile(u) : null)
      setLoading(false)
    })
  }, [])

  const signIn = useCallback(async (): Promise<Profile | null> => {
    const auth = getFirebaseAuth()
    if (!auth) throw new Error('not-configured')
    try {
      const cred = await signInWithPopup(auth, googleProvider())
      return toProfile(cred.user)
    } catch (e) {
      const code = (e as { code?: string }).code
      // popups are unreliable in installed PWAs / mobile browsers: fall back to a full-page redirect
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        await signInWithRedirect(auth, googleProvider())
        return null
      }
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return null
      throw e
    }
  }, [])

  const logOut = useCallback(async () => {
    const auth = getFirebaseAuth()
    if (auth) await signOut(auth)
  }, [])

  const value = useMemo<AuthState>(
    () => ({ configured: firebaseConfigured, loading, user, signIn, logOut }),
    [loading, user, signIn, logOut],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
