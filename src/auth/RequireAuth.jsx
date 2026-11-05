import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from './useAuth.js'
import SessionLoading from '../components/SessionLoading/SessionLoading.jsx'
function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <SessionLoading>Carregando sua conta…</SessionLoading>
  if (!user) return <Navigate to={'/login' + (['/entrar-grupo', '/cadastro/tag'].includes(location.pathname) ? location.hash : '')} replace />
  return <Outlet />
}
export default RequireAuth
