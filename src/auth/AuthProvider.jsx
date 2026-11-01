import { startTransition, useCallback, useEffect, useRef, useState } from 'react'
import { getSession, logoutAccount } from '../services/accountApi.js'
import { AuthContext } from './AuthContext.js'

function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const generation = useRef(0)
  const invalidate = useCallback(() => ++generation.current, [])
  const acceptUser = useCallback(value => { invalidate(); setUser(value); setLoading(false); setError('') }, [invalidate])
  const refresh = useCallback(async () => {
    const current = invalidate()
    try {
      const data = await getSession()
      if (current === generation.current) { setUser(data.user); setError('') }
      return data.user
    } catch (error) { if (current === generation.current) setError(error.message); throw error }
    finally { if (current === generation.current) setLoading(false) }
  }, [invalidate])
  useEffect(() => {
    const update = () => { void refresh().catch(() => {}) }
    update()
    const timer = setInterval(update, 60_000)
    window.addEventListener('focus', update)
    return () => { invalidate(); clearInterval(timer); window.removeEventListener('focus', update) }
  }, [refresh, invalidate])
  async function logout(onLoggedOut) {
    await logoutAccount()
    try { localStorage.removeItem('x1:group') } catch { /* Seleção não sensível. */ }
    startTransition(() => { acceptUser(null); onLoggedOut?.() })
  }
  return <AuthContext.Provider value={{ user, loading, error, acceptUser, refresh, logout }}>{children}</AuthContext.Provider>
}
export default AuthProvider
