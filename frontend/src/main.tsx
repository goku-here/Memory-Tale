import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './data/useAuth'
import { registerSW } from 'virtual:pwa-register'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)

// Pick up new versions quickly: check on open, when the app comes back to the foreground and every minute,
// and reload as soon as the new version is ready, so phones never keep running an old copy.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() { void updateSW(true) },
  onRegisteredSW(_url, reg) {
    if (!reg) return
    const check = () => { void reg.update().catch(() => {}) }
    setInterval(check, 60_000)
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check() })
  },
})

// iOS Safari ignores user-scalable=no; block pinch-zoom of the whole page so item pinches work.
document.addEventListener('gesturestart', (e) => e.preventDefault())
document.addEventListener('gesturechange', (e) => e.preventDefault())
