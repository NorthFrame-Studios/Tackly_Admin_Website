import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { LoadingState } from '../../components/States'
import { useAuth } from './authContext'

export function ProtectedRoute() {
  const auth = useAuth()
  const location = useLocation()
  if (auth.loading) return <LoadingState label="Kontrollerer adgang…" fullPage />
  if (!auth.isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (!auth.hasRole(['moderator', 'admin'])) {
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}

export function RoleProtectedRoute({ adminOnly = false }: { adminOnly?: boolean }) {
  const auth = useAuth()
  if (adminOnly && !auth.isAdmin) return <Navigate to="/forbidden" replace />
  return <Outlet />
}
