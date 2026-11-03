import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from './useAuth.js'
function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <p className="session-loading" role="status">Carregando sua conta…</p>
  if (!user) return <Navigate to={'/login' + (['/entrar-grupo', '/cadastro/tag'].includes(location.pathname) ? location.hash : '')} replace />
  return <Outlet />
}
export default RequireAuth
